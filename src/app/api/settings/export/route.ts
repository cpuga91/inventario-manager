import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireAuth(["ADMIN"]);
    const tenantId = user.tenantId;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { locations: true },
    });

    const globalRule = await prisma.replenishmentRule.findFirst({
      where: { tenantId, isGlobal: true },
    });

    const overrides = await prisma.replenishmentRule.findMany({
      where: { tenantId, isGlobal: false },
    });

    const config = {
      exportedAt: new Date().toISOString(),
      tenant: {
        name: tenant?.name,
        shopDomain: tenant?.shopDomain,
      },
      locations: tenant?.locations.map((l) => ({
        name: l.name,
        shopifyLocationId: l.shopifyLocationId,
        isWarehouse: l.isWarehouse,
        isStore: l.isStore,
        isOnline: l.isOnline,
        isVirtual: l.isVirtual,
      })),
      globalRule: globalRule
        ? {
            leadTimeDays: globalRule.leadTimeDays,
            safetyDays: globalRule.safetyDays,
            reviewCycleDays: globalRule.reviewCycleDays,
            overstockThresholdDays: globalRule.overstockThresholdDays,
            deadStockDays: globalRule.deadStockDays,
            warehouseBufferQty: globalRule.warehouseBufferQty,
            targetCoverDays: globalRule.targetCoverDays,
          }
        : null,
      overrides: overrides.map((o) => ({
        variantId: o.variantId,
        tenantLocationId: o.tenantLocationId,
        leadTimeDays: o.leadTimeDays,
        safetyDays: o.safetyDays,
        reviewCycleDays: o.reviewCycleDays,
        overstockThresholdDays: o.overstockThresholdDays,
        deadStockDays: o.deadStockDays,
        warehouseBufferQty: o.warehouseBufferQty,
        targetCoverDays: o.targetCoverDays,
        minQty: o.minQty,
        maxQty: o.maxQty,
        excludeDiscount: o.excludeDiscount,
        excludeTransfer: o.excludeTransfer,
      })),
    };

    return new NextResponse(JSON.stringify(config, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="tenant-config-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
