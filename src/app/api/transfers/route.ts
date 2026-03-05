import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = user.tenantId;
    const { searchParams } = new URL(req.url);

    const locationId = searchParams.get("locationId");
    const vendor = searchParams.get("vendor");
    const search = searchParams.get("search");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { tenantId, type: "TRANSFER", status: "pending" };
    if (locationId) where.tenantLocationId = locationId;

    let recs = await prisma.recommendation.findMany({
      where,
      orderBy: { priority: "desc" },
      include: { variant: { include: { product: true } }, location: true },
    });

    // Filter by vendor/search in application layer
    if (vendor) {
      recs = recs.filter((r) => r.variant.product.vendor?.toLowerCase().includes(vendor.toLowerCase()));
    }
    if (search) {
      const s = search.toLowerCase();
      recs = recs.filter((r) =>
        (r.variant.sku?.toLowerCase().includes(s)) ||
        r.variant.title.toLowerCase().includes(s) ||
        r.variant.product.title.toLowerCase().includes(s)
      );
    }

    const transfers = recs.map((r) => {
      const payload = JSON.parse(r.payload);
      return {
        id: r.id,
        variantId: r.variantId,
        sku: r.variant.sku,
        title: r.variant.title,
        productTitle: r.variant.product.title,
        vendor: r.variant.product.vendor,
        destinationName: r.location?.name || payload.destinationName,
        destinationLocationId: r.tenantLocationId,
        warehouseOnHand: payload.warehouseOnHand,
        destOnHand: payload.destOnHand,
        avgDailySales30: payload.avgDailySales30,
        daysOfCover: payload.daysOfCover,
        targetOnHand: payload.targetOnHand,
        transferQty: payload.transferQty,
        stockoutRisk: payload.stockoutRisk,
        capitalTied: payload.capitalTied,
        priority: r.priority,
        status: r.status,
      };
    });

    // Locations for filter dropdown
    const locations = await prisma.tenantLocation.findMany({
      where: { tenantId, OR: [{ isStore: true }, { isOnline: true }] },
    });

    return NextResponse.json({ transfers, locations });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

// Update transfer status (picked/shipped/received)
export async function PATCH(req: NextRequest) {
  try {
    await requireAuth(["ADMIN", "MANAGER"]);
    const { ids, status } = await req.json();

    if (!ids?.length || !["picked", "shipped", "received", "pending"].includes(status)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    await prisma.recommendation.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
