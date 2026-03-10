import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CONFIRM_SOFT = "RESET WIZARD";
const CONFIRM_HARD = "DELETE TENANT DATA";

export async function GET() {
  try {
    const user = await requireAuth(["ADMIN"]);
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { wizardStep: true, wizardComplete: true, updatedAt: true },
    });
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

    return NextResponse.json({
      wizardStep: tenant.wizardStep,
      wizardComplete: tenant.wizardComplete,
      lastUpdated: tenant.updatedAt,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    const status = msg === "Unauthorized" || msg === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(["ADMIN"]);
    const body = await req.json();
    const { mode, confirmText } = body;

    if (!mode || !["SOFT", "HARD"].includes(mode)) {
      return NextResponse.json({ error: "Invalid mode. Must be SOFT or HARD." }, { status: 400 });
    }

    const expectedConfirm = mode === "SOFT" ? CONFIRM_SOFT : CONFIRM_HARD;
    if (confirmText !== expectedConfirm) {
      return NextResponse.json({
        error: `Confirmation text must be exactly: "${expectedConfirm}"`,
      }, { status: 400 });
    }

    const tenantId = user.tenantId;

    if (mode === "SOFT") {
      await prisma.$transaction(async (tx) => {
        await tx.tenant.update({
          where: { id: tenantId },
          data: { wizardStep: 0, wizardComplete: false },
        });

        await tx.syncCursor.deleteMany({ where: { tenantId } });

        await tx.auditLog.create({
          data: {
            tenantId,
            actorUserId: user.id,
            action: "WIZARD_SOFT_RESET",
            detailsJson: JSON.stringify({
              message: "Wizard state reset to step 0. Historical data preserved.",
            }),
          },
        });
      });

      return NextResponse.json({ ok: true, mode: "SOFT" });
    }

    // HARD reset — delete in FK-safe order, no interactive transaction to avoid timeout
    const counts: Record<string, number> = {};

    // Phase 1: delete leaf tables (no FK dependents)
    const aiRuns = await prisma.aiRun.deleteMany({ where: { tenantId } });
    counts.aiRuns = aiRuns.count;

    const notifications = await prisma.notification.deleteMany({ where: { tenantId } });
    counts.notifications = notifications.count;

    const recommendations = await prisma.recommendation.deleteMany({ where: { tenantId } });
    counts.recommendations = recommendations.count;

    const alerts = await prisma.alert.deleteMany({ where: { tenantId } });
    counts.alerts = alerts.count;

    const dailySales = await prisma.dailySale.deleteMany({ where: { tenantId } });
    counts.dailySales = dailySales.count;

    // Phase 2: orders (must delete lines first)
    const orders = await prisma.order.findMany({
      where: { tenantId },
      select: { id: true },
    });
    const orderIds = orders.map((o) => o.id);
    if (orderIds.length > 0) {
      const orderLines = await prisma.orderLine.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      counts.orderLines = orderLines.count;
    } else {
      counts.orderLines = 0;
    }
    const ordersDeleted = await prisma.order.deleteMany({ where: { tenantId } });
    counts.orders = ordersDeleted.count;

    // Phase 3: inventory and variants
    const inventoryLevels = await prisma.inventoryLevel.deleteMany({ where: { tenantId } });
    counts.inventoryLevels = inventoryLevels.count;

    const variantCosts = await prisma.variantCost.deleteMany({ where: { tenantId } });
    counts.variantCosts = variantCosts.count;

    const variants = await prisma.variant.deleteMany({ where: { tenantId } });
    counts.variants = variants.count;

    const products = await prisma.product.deleteMany({ where: { tenantId } });
    counts.products = products.count;

    // Phase 4: config and locations
    const syncCursors = await prisma.syncCursor.deleteMany({ where: { tenantId } });
    counts.syncCursors = syncCursors.count;

    const locations = await prisma.tenantLocation.deleteMany({ where: { tenantId } });
    counts.locations = locations.count;

    const rules = await prisma.replenishmentRule.deleteMany({ where: { tenantId } });
    counts.rules = rules.count;

    const openAi = await prisma.openAiSettings.deleteMany({ where: { tenantId } });
    counts.openAiSettings = openAi.count;

    // Phase 5: reset wizard state and log
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { wizardStep: 0, wizardComplete: false },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        actorUserId: user.id,
        action: "WIZARD_HARD_RESET",
        detailsJson: JSON.stringify({
          message: "Full tenant data purge and wizard reset.",
          deletedCounts: counts,
        }),
      },
    });

    const deletedCounts = counts;

    return NextResponse.json({ ok: true, mode: "HARD", deletedCounts });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    const status = msg === "Unauthorized" || msg === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
