import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getShopifyClient } from "@/lib/shopify";

export async function GET() {
  try {
    const user = await requireAuth(["ADMIN"]);
    const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

    const client = getShopifyClient(tenant.shopDomain, tenant.accessToken);
    const locations = await client.listLocations();

    return NextResponse.json({ locations });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
