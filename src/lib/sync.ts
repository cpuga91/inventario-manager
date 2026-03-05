/**
 * Data sync service: backfill + incremental from Shopify.
 * All operations are idempotent (upsert-based).
 */
import { prisma } from "./prisma";
import { ShopifyClient } from "./shopify";

/** Strip Shopify GID prefix to get numeric id */
function gidToId(gid: string): string {
  return gid;  // Keep full GID for uniqueness
}

export interface SyncStats {
  products: number;
  variants: number;
  inventoryLevels: number;
  orders: number;
  orderLines: number;
}

export class SyncService {
  private client: ShopifyClient;
  private tenantId: string;

  constructor(client: ShopifyClient, tenantId: string) {
    this.client = client;
    this.tenantId = tenantId;
  }

  /**
   * Full backfill: variants, inventory, and orders for the last N months.
   * Idempotent via upserts.
   */
  async backfill(months: number = 12): Promise<SyncStats> {
    const stats: SyncStats = { products: 0, variants: 0, inventoryLevels: 0, orders: 0, orderLines: 0 };

    // 1. Sync variants (includes products and COGS metafield)
    const variantStats = await this.syncVariants();
    stats.products = variantStats.products;
    stats.variants = variantStats.variants;

    // 2. Sync inventory levels
    stats.inventoryLevels = await this.syncInventoryLevels();

    // 3. Sync orders
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    const sinceStr = since.toISOString().split("T")[0];
    const orderStats = await this.syncOrders(sinceStr);
    stats.orders = orderStats.orders;
    stats.orderLines = orderStats.orderLines;

    // Update sync cursor
    await this.updateCursor("last_backfill", new Date().toISOString());

    return stats;
  }

  /**
   * Incremental sync: new orders since last sync + refresh inventory.
   */
  async incrementalSync(): Promise<SyncStats> {
    const stats: SyncStats = { products: 0, variants: 0, inventoryLevels: 0, orders: 0, orderLines: 0 };

    // Get last sync time
    const cursor = await prisma.syncCursor.findUnique({
      where: { tenantId_cursorType: { tenantId: this.tenantId, cursorType: "last_order_sync" } },
    });
    const since = cursor?.cursorValue || new Date(Date.now() - 15 * 60 * 1000).toISOString();

    // Sync new orders
    const orderStats = await this.syncOrders(since.split("T")[0]);
    stats.orders = orderStats.orders;
    stats.orderLines = orderStats.orderLines;

    // Refresh inventory levels
    stats.inventoryLevels = await this.syncInventoryLevels();

    await this.updateCursor("last_order_sync", new Date().toISOString());

    return stats;
  }

  private async syncVariants(): Promise<{ products: number; variants: number }> {
    const seenProducts = new Set<string>();
    let variantCount = 0;

    // Get tenant locations for mapping
    const tenantLocations = await prisma.tenantLocation.findMany({
      where: { tenantId: this.tenantId },
    });
    const _locationMap = new Map(tenantLocations.map((l) => [l.shopifyLocationId, l.id]));

    for await (const batch of this.client.paginateVariants()) {
      for (const v of batch) {
        const productGid = gidToId(v.product.id);
        const variantGid = gidToId(v.id);

        // Upsert product
        if (!seenProducts.has(productGid)) {
          await prisma.product.upsert({
            where: { tenantId_shopifyProductId: { tenantId: this.tenantId, shopifyProductId: productGid } },
            update: {
              title: v.product.title,
              vendor: v.product.vendor,
              tags: v.product.tags.join(","),
            },
            create: {
              tenantId: this.tenantId,
              shopifyProductId: productGid,
              title: v.product.title,
              vendor: v.product.vendor,
              tags: v.product.tags.join(","),
            },
          });
          seenProducts.add(productGid);
        }

        // Upsert variant
        const variant = await prisma.variant.upsert({
          where: { tenantId_shopifyVariantId: { tenantId: this.tenantId, shopifyVariantId: variantGid } },
          update: {
            sku: v.sku,
            title: v.title,
            price: parseFloat(v.price) || 0,
            shopifyInventoryItemId: gidToId(v.inventoryItem.id),
          },
          create: {
            tenantId: this.tenantId,
            shopifyVariantId: variantGid,
            shopifyProductId: productGid,
            sku: v.sku,
            title: v.title,
            price: parseFloat(v.price) || 0,
            shopifyInventoryItemId: gidToId(v.inventoryItem.id),
          },
        });
        variantCount++;

        // Upsert COGS from metafield
        if (v.metafield?.value) {
          const cogsVal = parseFloat(v.metafield.value);
          if (!isNaN(cogsVal)) {
            await prisma.variantCost.upsert({
              where: { tenantId_variantId: { tenantId: this.tenantId, variantId: variant.id } },
              update: { cogsValue: cogsVal, sku: v.sku, source: "metafield" },
              create: {
                tenantId: this.tenantId,
                variantId: variant.id,
                sku: v.sku,
                cogsValue: cogsVal,
                source: "metafield",
              },
            });
          }
        }
      }
    }

    return { products: seenProducts.size, variants: variantCount };
  }

  private async syncInventoryLevels(): Promise<number> {
    const tenantLocations = await prisma.tenantLocation.findMany({
      where: { tenantId: this.tenantId },
    });
    const locationMap = new Map(tenantLocations.map((l) => [l.shopifyLocationId, l.id]));

    let count = 0;

    for await (const batch of this.client.paginateInventoryLevels()) {
      for (const item of batch) {
        if (!item.variantId) continue;

        // Find our variant
        const variant = await prisma.variant.findUnique({
          where: { tenantId_shopifyVariantId: { tenantId: this.tenantId, shopifyVariantId: item.variantId } },
        });
        if (!variant) continue;

        for (const level of item.levels) {
          const tenantLocationId = locationMap.get(level.locationId);
          if (!tenantLocationId) continue;

          await prisma.inventoryLevel.upsert({
            where: {
              tenantId_variantId_tenantLocationId: {
                tenantId: this.tenantId,
                variantId: variant.id,
                tenantLocationId,
              },
            },
            update: { onHand: level.available },
            create: {
              tenantId: this.tenantId,
              variantId: variant.id,
              tenantLocationId,
              onHand: level.available,
            },
          });
          count++;
        }
      }
    }

    return count;
  }

  private async syncOrders(since: string): Promise<{ orders: number; orderLines: number }> {
    let orderCount = 0;
    let lineCount = 0;

    for await (const batch of this.client.paginateOrders(since)) {
      for (const o of batch) {
        const orderGid = gidToId(o.id);

        const order = await prisma.order.upsert({
          where: { tenantId_shopifyOrderId: { tenantId: this.tenantId, shopifyOrderId: orderGid } },
          update: {
            totalPrice: parseFloat(o.totalPrice) || 0,
            shopifyLocationId: o.locationId,
          },
          create: {
            tenantId: this.tenantId,
            shopifyOrderId: orderGid,
            orderName: o.name,
            createdAt: new Date(o.createdAt),
            totalPrice: parseFloat(o.totalPrice) || 0,
            channel: o.locationId ? "pos" : "online",
            shopifyLocationId: o.locationId,
          },
        });
        orderCount++;

        // Delete existing lines for idempotency, then re-create
        await prisma.orderLine.deleteMany({ where: { orderId: order.id } });

        for (const li of o.lineItems) {
          let variantId: string | null = null;
          if (li.variantId) {
            const variant = await prisma.variant.findUnique({
              where: { tenantId_shopifyVariantId: { tenantId: this.tenantId, shopifyVariantId: li.variantId } },
            });
            variantId = variant?.id || null;
          }

          await prisma.orderLine.create({
            data: {
              orderId: order.id,
              variantId,
              sku: li.sku,
              quantity: li.quantity,
              unitPrice: parseFloat(li.unitPrice) || 0,
            },
          });
          lineCount++;
        }
      }
    }

    return { orders: orderCount, orderLines: lineCount };
  }

  /**
   * Aggregate orders into daily_sales table. Idempotent via upsert.
   */
  async aggregateDailySales(): Promise<number> {
    const tenantLocations = await prisma.tenantLocation.findMany({
      where: { tenantId: this.tenantId },
    });
    const shopifyLocMap = new Map(tenantLocations.map((l) => [l.shopifyLocationId, l.id]));
    const onlineLocation = tenantLocations.find((l) => l.isOnline);

    // Get all orders with lines
    const orders = await prisma.order.findMany({
      where: { tenantId: this.tenantId },
      include: { lines: true },
    });

    let count = 0;

    for (const order of orders) {
      const dateStr = order.createdAt.toISOString().split("T")[0];
      const date = new Date(dateStr);

      // Determine tenant location
      let tenantLocationId: string | null = null;
      if (order.shopifyLocationId) {
        tenantLocationId = shopifyLocMap.get(order.shopifyLocationId) || null;
      }
      if (!tenantLocationId && onlineLocation) {
        tenantLocationId = onlineLocation.id;
      }
      if (!tenantLocationId) continue;

      for (const line of order.lines) {
        if (!line.variantId) continue;

        await prisma.dailySale.upsert({
          where: {
            tenantId_date_variantId_tenantLocationId: {
              tenantId: this.tenantId,
              date,
              variantId: line.variantId,
              tenantLocationId,
            },
          },
          update: {
            qty: { increment: 0 }, // no-op on upsert update; we recalculate below
          },
          create: {
            tenantId: this.tenantId,
            date,
            variantId: line.variantId,
            tenantLocationId,
            qty: 0,
            grossSales: 0,
            netSales: 0,
          },
        });
      }
    }

    // Now recalculate aggregates from order lines
    // Group by date + variant + location
    const aggregates = new Map<string, { qty: number; gross: number }>();

    for (const order of orders) {
      const dateStr = order.createdAt.toISOString().split("T")[0];
      let tenantLocationId: string | null = null;
      if (order.shopifyLocationId) {
        tenantLocationId = shopifyLocMap.get(order.shopifyLocationId) || null;
      }
      if (!tenantLocationId && onlineLocation) {
        tenantLocationId = onlineLocation.id;
      }
      if (!tenantLocationId) continue;

      for (const line of order.lines) {
        if (!line.variantId) continue;
        const key = `${dateStr}|${line.variantId}|${tenantLocationId}`;
        const cur = aggregates.get(key) || { qty: 0, gross: 0 };
        cur.qty += line.quantity;
        cur.gross += line.quantity * line.unitPrice;
        aggregates.set(key, cur);
      }
    }

    for (const [key, val] of aggregates) {
      const [dateStr, variantId, tenantLocationId] = key.split("|");
      const date = new Date(dateStr);

      await prisma.dailySale.upsert({
        where: {
          tenantId_date_variantId_tenantLocationId: {
            tenantId: this.tenantId,
            date,
            variantId,
            tenantLocationId,
          },
        },
        update: {
          qty: val.qty,
          grossSales: val.gross,
          netSales: val.gross,
        },
        create: {
          tenantId: this.tenantId,
          date,
          variantId,
          tenantLocationId,
          qty: val.qty,
          grossSales: val.gross,
          netSales: val.gross,
        },
      });
      count++;
    }

    return count;
  }

  private async updateCursor(type: string, value: string) {
    await prisma.syncCursor.upsert({
      where: { tenantId_cursorType: { tenantId: this.tenantId, cursorType: type } },
      update: { cursorValue: value },
      create: { tenantId: this.tenantId, cursorType: type, cursorValue: value },
    });
  }
}
