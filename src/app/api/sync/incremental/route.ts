import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ShopifyClient } from "@/lib/shopify";
import { SyncService } from "@/lib/sync";

export async function POST() {
  try {
    const user = await requireAuth(["ADMIN", "MANAGER"]);
    const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

    const client = new ShopifyClient({
      shop: tenant.shopDomain,
      accessToken: tenant.accessToken,
    });

    const sync = new SyncService(client, tenant.id);
    const stats = await sync.incrementalSync();
    await sync.aggregateDailySales();

    return NextResponse.json({ success: true, stats });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
