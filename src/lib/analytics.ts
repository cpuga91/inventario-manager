/**
 * Analytics engine: computes replenishment metrics, transfer and discount recommendations.
 */
import { prisma } from "./prisma";
import { RecommendationType } from "@prisma/client";

const EPSILON = 0.001;

export interface SkuLocationMetrics {
  variantId: string;
  tenantLocationId: string;
  sku: string | null;
  title: string;
  onHand: number;
  avgDailySales7: number;
  avgDailySales14: number;
  avgDailySales30: number;
  daysOfCover: number;
  stockoutRisk: boolean;
  overstockRisk: boolean;
  deadStock: boolean;
  capitalTied: number | null;
  cogs: number | null;
  lastSaleDate: Date | null;
  daysSinceLastSale: number | null;
}

export interface TransferRecommendation {
  variantId: string;
  sku: string | null;
  title: string;
  destinationLocationId: string;
  destinationName: string;
  warehouseOnHand: number;
  destOnHand: number;
  avgDailySales30: number;
  daysOfCover: number;
  targetOnHand: number;
  needQty: number;
  transferQty: number;
  priority: number;
  capitalTied: number | null;
}

export interface DiscountRecommendation {
  variantId: string;
  sku: string | null;
  title: string;
  locationName: string;
  tenantLocationId: string;
  onHand: number;
  daysOfCover: number;
  daysSinceLastSale: number | null;
  capitalTied: number | null;
  discountBucket: number;
  rationale: string;
}

interface Rules {
  leadTimeDays: number;
  safetyDays: number;
  reviewCycleDays: number;
  overstockThresholdDays: number;
  deadStockDays: number;
  warehouseBufferQty: number;
  targetCoverDays: number;
}

/**
 * Compute average daily sales for a variant+location over N days.
 */
export function computeAvgDailySales(
  dailySales: Array<{ date: Date; qty: number }>,
  days: number,
  asOfDate: Date = new Date()
): number {
  const cutoff = new Date(asOfDate);
  cutoff.setDate(cutoff.getDate() - days);
  const relevant = dailySales.filter((s) => s.date >= cutoff && s.date <= asOfDate);
  const totalQty = relevant.reduce((sum, s) => sum + s.qty, 0);
  return totalQty / days;
}

/**
 * Compute days of cover.
 */
export function computeDaysOfCover(onHand: number, avgDailySales: number): number {
  return onHand / Math.max(avgDailySales, EPSILON);
}

/**
 * Determine if there's stockout risk.
 */
export function isStockoutRisk(
  daysOfCover: number,
  leadTimeDays: number,
  safetyDays: number,
  reviewCycleDays: number
): boolean {
  return daysOfCover < leadTimeDays + safetyDays + reviewCycleDays;
}

/**
 * Determine if there's overstock risk.
 */
export function isOverstockRisk(daysOfCover: number, thresholdDays: number): boolean {
  return daysOfCover > thresholdDays;
}

/**
 * Determine if item is dead stock: no sales in N days AND on_hand > 0.
 */
export function isDeadStock(
  onHand: number,
  lastSaleDate: Date | null,
  deadStockDays: number,
  asOfDate: Date = new Date()
): boolean {
  if (onHand <= 0) return false;
  if (!lastSaleDate) return true; // never sold = dead
  const daysSince = Math.floor((asOfDate.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24));
  return daysSince >= deadStockDays;
}

/**
 * Compute transfer quantity from warehouse to a destination.
 */
export function computeTransferQty(
  targetCoverDays: number,
  avgDailySales30: number,
  destOnHand: number,
  warehouseOnHand: number,
  warehouseBufferQty: number
): number {
  const targetOnHand = targetCoverDays * avgDailySales30;
  const needQty = Math.max(0, Math.ceil(targetOnHand - destOnHand));
  const availableFromWarehouse = Math.max(0, warehouseOnHand - warehouseBufferQty);
  return Math.min(needQty, availableFromWarehouse);
}

/**
 * Determine discount bucket based on inventory age/risk.
 */
export function computeDiscountBucket(
  daysOfCover: number,
  daysSinceLastSale: number | null,
  overstockThresholdDays: number,
  deadStockDays: number
): { bucket: number; rationale: string } {
  const noSaleDays = daysSinceLastSale ?? Infinity;

  if (noSaleDays >= deadStockDays || daysOfCover > deadStockDays * 1.5) {
    return { bucket: 30, rationale: `Dead stock: no sales in ${noSaleDays} days, ${Math.round(daysOfCover)} days of cover. Deep discount recommended.` };
  }
  if (noSaleDays >= deadStockDays * 0.5 || daysOfCover > overstockThresholdDays * 1.5) {
    return { bucket: 20, rationale: `Slow mover: ${noSaleDays} days since last sale, ${Math.round(daysOfCover)} days of cover. Moderate discount recommended.` };
  }
  return { bucket: 10, rationale: `Overstock: ${Math.round(daysOfCover)} days of cover exceeds threshold of ${overstockThresholdDays}. Light discount recommended.` };
}

/**
 * Compute transfer priority score (higher = more urgent).
 */
export function computeTransferPriority(
  stockoutRisk: boolean,
  avgDailySales30: number,
  capitalTied: number | null
): number {
  let score = 0;
  if (stockoutRisk) score += 1000;
  score += avgDailySales30 * 100;
  if (capitalTied !== null) score += capitalTied * 0.01;
  return score;
}

/**
 * Run full analytics for a tenant. Idempotent (replaces recommendations).
 */
export async function runAnalytics(tenantId: string): Promise<{
  metricsCount: number;
  transferCount: number;
  discountCount: number;
  reorderFlags: number;
}> {
  // Load global rules
  const globalRule = await prisma.replenishmentRule.findFirst({
    where: { tenantId, isGlobal: true },
  });

  const rules: Rules = {
    leadTimeDays: globalRule?.leadTimeDays ?? 3,
    safetyDays: globalRule?.safetyDays ?? 2,
    reviewCycleDays: globalRule?.reviewCycleDays ?? 7,
    overstockThresholdDays: globalRule?.overstockThresholdDays ?? 90,
    deadStockDays: globalRule?.deadStockDays ?? 180,
    warehouseBufferQty: globalRule?.warehouseBufferQty ?? 5,
    targetCoverDays: globalRule?.targetCoverDays ?? 30,
  };

  // Load locations
  const locations = await prisma.tenantLocation.findMany({ where: { tenantId } });
  const warehouseLoc = locations.find((l) => l.isWarehouse);
  const storeLocs = locations.filter((l) => l.isStore || l.isOnline);

  if (!warehouseLoc) {
    throw new Error("No warehouse location configured");
  }

  // Load all variants for tenant
  const variants = await prisma.variant.findMany({
    where: { tenantId },
    include: { costs: { where: { tenantId } } },
  });

  // Load all inventory
  const inventoryLevels = await prisma.inventoryLevel.findMany({ where: { tenantId } });
  const invMap = new Map<string, number>(); // key: variantId|locationId
  for (const il of inventoryLevels) {
    invMap.set(`${il.variantId}|${il.tenantLocationId}`, il.onHand);
  }

  // Load daily sales (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dailySales = await prisma.dailySale.findMany({
    where: { tenantId, date: { gte: thirtyDaysAgo } },
  });

  // Group daily sales by variant+location
  const salesMap = new Map<string, Array<{ date: Date; qty: number }>>();
  for (const ds of dailySales) {
    const key = `${ds.variantId}|${ds.tenantLocationId}`;
    if (!salesMap.has(key)) salesMap.set(key, []);
    salesMap.get(key)!.push({ date: ds.date, qty: ds.qty });
  }

  // Clear old recommendations
  await prisma.recommendation.deleteMany({ where: { tenantId } });

  let metricsCount = 0;
  let transferCount = 0;
  let discountCount = 0;
  let reorderFlags = 0;

  const now = new Date();

  // Per-SKU overrides map
  const overrides = await prisma.replenishmentRule.findMany({
    where: { tenantId, isGlobal: false },
  });
  const overrideMap = new Map<string, typeof overrides[0]>();
  for (const o of overrides) {
    if (o.variantId && o.tenantLocationId) {
      overrideMap.set(`${o.variantId}|${o.tenantLocationId}`, o);
    } else if (o.variantId) {
      overrideMap.set(o.variantId, o);
    }
  }

  // Aggregate warehouse outbound demand for reorder flags
  let totalWarehouseOutboundDemand = 0;

  for (const variant of variants) {
    const cogs = variant.costs[0]?.cogsValue ?? null;
    const warehouseOnHand = invMap.get(`${variant.id}|${warehouseLoc.id}`) ?? 0;

    // Compute for each store/online location
    for (const storeLoc of storeLocs) {
      const key = `${variant.id}|${storeLoc.id}`;
      const sales = salesMap.get(key) || [];
      const onHand = invMap.get(key) ?? 0;

      // Get override rules if any
      const override = overrideMap.get(key) || overrideMap.get(variant.id);
      const effectiveRules = override
        ? { ...rules, ...Object.fromEntries(Object.entries(override).filter(([, v]) => v !== null)) }
        : rules;

      const avgDaily7 = computeAvgDailySales(sales, 7, now);
      const avgDaily14 = computeAvgDailySales(sales, 14, now);
      const avgDaily30 = computeAvgDailySales(sales, 30, now);
      const doc = computeDaysOfCover(onHand, avgDaily30);
      const stockout = isStockoutRisk(doc, effectiveRules.leadTimeDays, effectiveRules.safetyDays, effectiveRules.reviewCycleDays);
      const overstock = isOverstockRisk(doc, effectiveRules.overstockThresholdDays);

      // Find last sale date
      const sortedSales = sales.filter((s) => s.qty > 0).sort((a, b) => b.date.getTime() - a.date.getTime());
      const lastSaleDate = sortedSales[0]?.date || null;
      const daysSinceLastSale = lastSaleDate
        ? Math.floor((now.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const dead = isDeadStock(onHand, lastSaleDate, effectiveRules.deadStockDays, now);
      const capitalTied = cogs !== null ? onHand * cogs : null;

      metricsCount++;

      // Transfer recommendation
      if (!override?.excludeTransfer && (stockout || onHand < effectiveRules.targetCoverDays * avgDaily30)) {
        const transferQty = computeTransferQty(
          effectiveRules.targetCoverDays,
          avgDaily30,
          onHand,
          warehouseOnHand,
          effectiveRules.warehouseBufferQty
        );

        if (transferQty > 0) {
          const priority = computeTransferPriority(stockout, avgDaily30, capitalTied);
          totalWarehouseOutboundDemand += avgDaily30;

          await prisma.recommendation.create({
            data: {
              tenantId,
              type: RecommendationType.TRANSFER,
              variantId: variant.id,
              tenantLocationId: storeLoc.id,
              priority,
              payload: JSON.stringify({
                sku: variant.sku,
                title: variant.title,
                destinationName: storeLoc.name,
                warehouseOnHand,
                destOnHand: onHand,
                avgDailySales30: avgDaily30,
                daysOfCover: doc,
                targetOnHand: effectiveRules.targetCoverDays * avgDaily30,
                transferQty,
                stockoutRisk: stockout,
                capitalTied,
              }),
            },
          });
          transferCount++;
        }
      }

      // Discount recommendation
      if (!override?.excludeDiscount && (overstock || dead)) {
        const { bucket, rationale } = computeDiscountBucket(
          doc,
          daysSinceLastSale,
          effectiveRules.overstockThresholdDays,
          effectiveRules.deadStockDays
        );

        await prisma.recommendation.create({
          data: {
            tenantId,
            type: RecommendationType.DISCOUNT,
            variantId: variant.id,
            tenantLocationId: storeLoc.id,
            priority: doc,
            payload: JSON.stringify({
              sku: variant.sku,
              title: variant.title,
              locationName: storeLoc.name,
              onHand,
              daysOfCover: doc,
              daysSinceLastSale,
              capitalTied,
              discountBucket: bucket,
              rationale,
            }),
          },
        });
        discountCount++;
      }
    }

    // Warehouse reorder flag
    const warehouseSales = salesMap.get(`${variant.id}|${warehouseLoc.id}`) || [];
    const warehouseAvgDaily30 = computeAvgDailySales(warehouseSales, 30, now);
    // Include aggregate outbound demand
    const totalDemand = Math.max(warehouseAvgDaily30, totalWarehouseOutboundDemand);
    const warehouseDoc = computeDaysOfCover(warehouseOnHand, totalDemand);

    if (warehouseDoc < rules.leadTimeDays + rules.safetyDays) {
      await prisma.recommendation.create({
        data: {
          tenantId,
          type: RecommendationType.REORDER_EXTERNAL_FLAG,
          variantId: variant.id,
          priority: 500 + (1 / Math.max(warehouseDoc, EPSILON)),
          payload: JSON.stringify({
            sku: variant.sku,
            title: variant.title,
            warehouseOnHand,
            warehouseDaysOfCover: warehouseDoc,
            estimatedDailyDemand: totalDemand,
          }),
        },
      });
      reorderFlags++;
    }
  }

  return { metricsCount, transferCount, discountCount, reorderFlags };
}
