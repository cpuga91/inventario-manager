import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ShopifyClient } from "@/lib/shopify";
import { SyncService } from "@/lib/sync";
import { runAnalytics } from "@/lib/analytics";
import { generateAlertsFromRecommendations } from "@/lib/notifications";

export async function POST() {
  try {
    const user = await requireAuth(["ADMIN"]);
    const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

    const client = new ShopifyClient({
      shop: tenant.shopDomain,
      accessToken: tenant.accessToken,
    });

    const sync = new SyncService(client, tenant.id);

    // Run backfill
    const stats = await sync.backfill(12);

    // Aggregate daily sales
    const dailySalesCount = await sync.aggregateDailySales();

    // Run analytics
    const analyticsResult = await runAnalytics(tenant.id);

    // Generate alerts
    await generateAlertsFromRecommendations(tenant.id);

    // Mark wizard complete
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { wizardStep: 4, wizardComplete: true },
    });

    return NextResponse.json({
      success: true,
      sync: stats,
      dailySales: dailySalesCount,
      analytics: analyticsResult,
    });
  } catch (err: unknown) {
    console.error("Backfill error:", err);
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
