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

    // HARD reset
    const deletedCounts = await prisma.$transaction(async (tx) => {
      const counts: Record<string, number> = {};

      // Delete in FK-safe order
      const aiRuns = await tx.aiRun.deleteMany({ where: { tenantId } });
      counts.aiRuns = aiRuns.count;

      const notifications = await tx.notification.deleteMany({ where: { tenantId } });
      counts.notifications = notifications.count;

      const recommendations = await tx.recommendation.deleteMany({ where: { tenantId } });
      counts.recommendations = recommendations.count;

      const alerts = await tx.alert.deleteMany({ where: { tenantId } });
      counts.alerts = alerts.count;

      const dailySales = await tx.dailySale.deleteMany({ where: { tenantId } });
      counts.dailySales = dailySales.count;

      // OrderLines don't have tenantId — delete via orders
      const orders = await tx.order.findMany({
        where: { tenantId },
        select: { id: true },
      });
      const orderIds = orders.map((o) => o.id);
      if (orderIds.length > 0) {
        const orderLines = await tx.orderLine.deleteMany({
          where: { orderId: { in: orderIds } },
        });
        counts.orderLines = orderLines.count;
      } else {
        counts.orderLines = 0;
      }

      const ordersDeleted = await tx.order.deleteMany({ where: { tenantId } });
      counts.orders = ordersDeleted.count;

      const inventoryLevels = await tx.inventoryLevel.deleteMany({ where: { tenantId } });
      counts.inventoryLevels = inventoryLevels.count;

      const variantCosts = await tx.variantCost.deleteMany({ where: { tenantId } });
      counts.variantCosts = variantCosts.count;

      const variants = await tx.variant.deleteMany({ where: { tenantId } });
      counts.variants = variants.count;

      const products = await tx.product.deleteMany({ where: { tenantId } });
      counts.products = products.count;

      const syncCursors = await tx.syncCursor.deleteMany({ where: { tenantId } });
      counts.syncCursors = syncCursors.count;

      const locations = await tx.tenantLocation.deleteMany({ where: { tenantId } });
      counts.locations = locations.count;

      const rules = await tx.replenishmentRule.deleteMany({ where: { tenantId } });
      counts.rules = rules.count;

      const openAi = await tx.openAiSettings.deleteMany({ where: { tenantId } });
      counts.openAiSettings = openAi.count;

      // Reset wizard state (keep tenant record)
      await tx.tenant.update({
        where: { id: tenantId },
        data: { wizardStep: 0, wizardComplete: false },
      });

      // Audit log
      await tx.auditLog.create({
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

      return counts;
    });

    return NextResponse.json({ ok: true, mode: "HARD", deletedCounts });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    const status = msg === "Unauthorized" || msg === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
