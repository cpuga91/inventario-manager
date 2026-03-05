import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getShopifyClient } from "@/lib/shopify";

export async function GET() {
  try {
    const user = await requireAuth(["ADMIN"]);
    const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

    return NextResponse.json({
      wizardStep: tenant.wizardStep,
      wizardComplete: tenant.wizardComplete,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(["ADMIN"]);
    const body = await req.json();
    const { step, data } = body;

    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      include: { locations: true },
    });
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

    switch (step) {
      case 1: {
        // Test Shopify connection
        const client = getShopifyClient(tenant.shopDomain, tenant.accessToken);
        const shop = await client.testConnection();
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { wizardStep: Math.max(tenant.wizardStep, 1) },
        });
        return NextResponse.json({ success: true, shopName: shop.name });
      }

      case 2: {
        // Save location mapping
        const { warehouseId, storeIds, onlineStrategy, onlineLocationId } = data;
        if (!warehouseId) return NextResponse.json({ error: "Warehouse location required" }, { status: 400 });

        // Fetch locations from Shopify for names
        const client = getShopifyClient(tenant.shopDomain, tenant.accessToken);
        const shopifyLocations = await client.listLocations();
        const locMap = new Map(shopifyLocations.map((l) => [l.id, l.name]));

        // Clear existing locations
        await prisma.tenantLocation.deleteMany({ where: { tenantId: tenant.id } });

        // Create warehouse
        await prisma.tenantLocation.create({
          data: {
            tenantId: tenant.id,
            shopifyLocationId: warehouseId,
            name: locMap.get(warehouseId) || "Warehouse",
            isWarehouse: true,
          },
        });

        // Create stores
        for (const sid of storeIds || []) {
          await prisma.tenantLocation.create({
            data: {
              tenantId: tenant.id,
              shopifyLocationId: sid,
              name: locMap.get(sid) || "Store",
              isStore: true,
            },
          });
        }

        // Create online mapping
        if (onlineStrategy === "real" && onlineLocationId) {
          await prisma.tenantLocation.create({
            data: {
              tenantId: tenant.id,
              shopifyLocationId: onlineLocationId,
              name: "Online",
              isOnline: true,
            },
          });
        } else if (onlineStrategy === "virtual") {
          await prisma.tenantLocation.create({
            data: {
              tenantId: tenant.id,
              shopifyLocationId: onlineLocationId || null,
              name: "Online (Virtual)",
              isOnline: true,
              isVirtual: true,
            },
          });
        }

        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { wizardStep: Math.max(tenant.wizardStep, 2) },
        });
        return NextResponse.json({ success: true });
      }

      case 3: {
        // Save business rules
        const {
          leadTimeDays = 3,
          safetyDays = 2,
          reviewCycleDays = 7,
          overstockThresholdDays = 90,
          deadStockDays = 180,
          warehouseBufferQty = 5,
          targetCoverDays = 30,
        } = data;

        // Upsert global rule
        const existing = await prisma.replenishmentRule.findFirst({
          where: { tenantId: tenant.id, isGlobal: true },
        });

        if (existing) {
          await prisma.replenishmentRule.update({
            where: { id: existing.id },
            data: { leadTimeDays, safetyDays, reviewCycleDays, overstockThresholdDays, deadStockDays, warehouseBufferQty, targetCoverDays },
          });
        } else {
          await prisma.replenishmentRule.create({
            data: { tenantId: tenant.id, isGlobal: true, leadTimeDays, safetyDays, reviewCycleDays, overstockThresholdDays, deadStockDays, warehouseBufferQty, targetCoverDays },
          });
        }

        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { wizardStep: Math.max(tenant.wizardStep, 3) },
        });
        return NextResponse.json({ success: true });
      }

      case 4: {
        // Trigger backfill + analytics (this is a long operation)
        // In production this would be a background job; for MVP we run inline
        return NextResponse.json({ success: true, message: "Use /api/sync/backfill to start" });
      }

      default:
        return NextResponse.json({ error: "Invalid step" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
