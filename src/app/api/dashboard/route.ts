import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireAuth();
    const tenantId = user.tenantId;

    // Top stockout risks (transfers with highest priority)
    const stockoutRisks = await prisma.recommendation.findMany({
      where: { tenantId, type: "TRANSFER", status: "pending" },
      orderBy: { priority: "desc" },
      take: 10,
      include: { variant: true, location: true },
    });

    // Top overstock/dead stock
    const overstockRisks = await prisma.recommendation.findMany({
      where: { tenantId, type: "DISCOUNT", status: "pending" },
      orderBy: { priority: "desc" },
      take: 10,
      include: { variant: true, location: true },
    });

    // Warehouse reorder flags
    const reorderFlags = await prisma.recommendation.findMany({
      where: { tenantId, type: "REORDER_EXTERNAL_FLAG", status: "pending" },
      orderBy: { priority: "desc" },
      take: 10,
      include: { variant: true },
    });

    // Summary counts
    const [variantCount, orderCount, inventoryCount] = await Promise.all([
      prisma.variant.count({ where: { tenantId } }),
      prisma.order.count({ where: { tenantId } }),
      prisma.inventoryLevel.count({ where: { tenantId } }),
    ]);

    // Warehouse health
    const warehouseLoc = await prisma.tenantLocation.findFirst({
      where: { tenantId, isWarehouse: true },
    });

    let warehouseHealth = null;
    if (warehouseLoc) {
      const warehouseInv = await prisma.inventoryLevel.aggregate({
        where: { tenantId, tenantLocationId: warehouseLoc.id },
        _sum: { onHand: true },
        _count: true,
      });
      warehouseHealth = {
        totalOnHand: warehouseInv._sum.onHand || 0,
        skuCount: warehouseInv._count,
        reorderFlags: reorderFlags.length,
      };
    }

    // Recent alerts
    const alerts = await prisma.alert.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      stockoutRisks: stockoutRisks.map((r) => ({ ...JSON.parse(r.payload), id: r.id, variantId: r.variantId, priority: r.priority })),
      overstockRisks: overstockRisks.map((r) => ({ ...JSON.parse(r.payload), id: r.id, variantId: r.variantId, priority: r.priority })),
      reorderFlags: reorderFlags.map((r) => ({ ...JSON.parse(r.payload), id: r.id, variantId: r.variantId })),
      summary: { variantCount, orderCount, inventoryCount },
      warehouseHealth,
      alerts,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
