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
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { wizardStep: 0, wizardComplete: false },
      });
      await prisma.syncCursor.deleteMany({ where: { tenantId } });
      try {
        await prisma.auditLog.create({
          data: {
            tenantId,
            actorUserId: user.id,
            action: "WIZARD_SOFT_RESET",
            detailsJson: JSON.stringify({
              message: "Wizard state reset to step 0. Historical data preserved.",
            }),
          },
        });
      } catch (e) {
        console.error("[wizard-reset] Audit log failed:", e);
      }

      return NextResponse.json({ ok: true, mode: "SOFT" });
    }

    // HARD reset — delete all tenant data in FK-safe order using raw SQL for reliability
    console.log("[wizard-reset] Starting HARD reset for tenant:", tenantId);

    const counts: Record<string, number> = {};

    // Use raw SQL to delete in bulk — more reliable than Prisma deleteMany chain
    // which can hit issues with connection pooling or model resolution
    counts.aiRuns = await prisma.$executeRaw`DELETE FROM ai_runs WHERE tenant_id = ${tenantId}`;
    counts.notifications = await prisma.$executeRaw`DELETE FROM notifications WHERE tenant_id = ${tenantId}`;
    counts.recommendations = await prisma.$executeRaw`DELETE FROM recommendations WHERE tenant_id = ${tenantId}`;
    counts.alerts = await prisma.$executeRaw`DELETE FROM alerts WHERE tenant_id = ${tenantId}`;
    counts.dailySales = await prisma.$executeRaw`DELETE FROM daily_sales WHERE tenant_id = ${tenantId}`;

    // Order lines via subquery (no tenant_id column)
    counts.orderLines = await prisma.$executeRaw`
      DELETE FROM order_lines WHERE order_id IN (
        SELECT id FROM orders WHERE tenant_id = ${tenantId}
      )`;
    counts.orders = await prisma.$executeRaw`DELETE FROM orders WHERE tenant_id = ${tenantId}`;

    counts.inventoryLevels = await prisma.$executeRaw`DELETE FROM inventory_levels WHERE tenant_id = ${tenantId}`;
    counts.variantCosts = await prisma.$executeRaw`DELETE FROM variant_costs WHERE tenant_id = ${tenantId}`;
    counts.variants = await prisma.$executeRaw`DELETE FROM variants WHERE tenant_id = ${tenantId}`;
    counts.products = await prisma.$executeRaw`DELETE FROM products WHERE tenant_id = ${tenantId}`;
    counts.syncCursors = await prisma.$executeRaw`DELETE FROM sync_cursors WHERE tenant_id = ${tenantId}`;
    counts.locations = await prisma.$executeRaw`DELETE FROM tenant_locations WHERE tenant_id = ${tenantId}`;
    counts.rules = await prisma.$executeRaw`DELETE FROM replenishment_rules WHERE tenant_id = ${tenantId}`;
    counts.openAiSettings = await prisma.$executeRaw`DELETE FROM openai_settings WHERE tenant_id = ${tenantId}`;

    // Reset wizard state
    await prisma.$executeRaw`
      UPDATE tenants SET wizard_step = 0, wizard_complete = false WHERE id = ${tenantId}`;

    // Audit log (non-blocking)
    try {
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
    } catch (auditErr) {
      console.error("[wizard-reset] Audit log failed (non-blocking):", auditErr);
    }

    console.log("[wizard-reset] HARD reset complete:", counts);
    return NextResponse.json({ ok: true, mode: "HARD", deletedCounts: counts });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    const stack = err instanceof Error ? err.stack : "";
    console.error("[wizard-reset] Error:", msg, "\n", stack);
    const status = msg === "Unauthorized" || msg === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
