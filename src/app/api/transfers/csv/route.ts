import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stringify } from "csv-stringify/sync";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = user.tenantId;
    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get("locationId");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { tenantId, type: "TRANSFER", status: "pending" };
    if (locationId) where.tenantLocationId = locationId;

    const recs = await prisma.recommendation.findMany({
      where,
      orderBy: { priority: "desc" },
      include: { variant: { include: { product: true } }, location: true },
    });

    const rows = recs.map((r) => {
      const payload = JSON.parse(r.payload);
      return {
        SKU: r.variant.sku || "",
        Product: r.variant.product.title,
        Variant: r.variant.title,
        Vendor: r.variant.product.vendor || "",
        Destination: r.location?.name || payload.destinationName || "",
        "Warehouse On Hand": payload.warehouseOnHand,
        "Dest On Hand": payload.destOnHand,
        "Avg Daily Sales (30d)": payload.avgDailySales30?.toFixed(2),
        "Days of Cover": payload.daysOfCover?.toFixed(1),
        "Transfer Qty": payload.transferQty,
        "Stockout Risk": payload.stockoutRisk ? "YES" : "No",
        "Capital Tied": payload.capitalTied !== null ? `$${payload.capitalTied?.toFixed(2)}` : "N/A",
        Priority: r.priority.toFixed(0),
      };
    });

    const csv = stringify(rows, { header: true });

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="transfer-plan-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
