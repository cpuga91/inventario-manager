import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: current settings (global rule + tenant config)
export async function GET() {
  try {
    const user = await requireAuth();
    const tenantId = user.tenantId;

    const globalRule = await prisma.replenishmentRule.findFirst({
      where: { tenantId, isGlobal: true },
    });

    const overrides = await prisma.replenishmentRule.findMany({
      where: { tenantId, isGlobal: false },
    });

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { locations: true },
    });

    return NextResponse.json({
      globalRule,
      overrides,
      tenant: {
        id: tenant?.id,
        name: tenant?.name,
        shopDomain: tenant?.shopDomain,
        locations: tenant?.locations,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

// PUT: update global thresholds
export async function PUT(req: NextRequest) {
  try {
    const user = await requireAuth(["ADMIN"]);
    const tenantId = user.tenantId;
    const data = await req.json();

    const existing = await prisma.replenishmentRule.findFirst({
      where: { tenantId, isGlobal: true },
    });

    if (existing) {
      await prisma.replenishmentRule.update({
        where: { id: existing.id },
        data: {
          leadTimeDays: data.leadTimeDays,
          safetyDays: data.safetyDays,
          reviewCycleDays: data.reviewCycleDays,
          overstockThresholdDays: data.overstockThresholdDays,
          deadStockDays: data.deadStockDays,
          warehouseBufferQty: data.warehouseBufferQty,
          targetCoverDays: data.targetCoverDays,
        },
      });
    } else {
      await prisma.replenishmentRule.create({
        data: { tenantId, isGlobal: true, ...data },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
