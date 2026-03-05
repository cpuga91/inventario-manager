import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireAuth();
    const tenantId = user.tenantId;

    const recs = await prisma.recommendation.findMany({
      where: { tenantId, type: "DISCOUNT" },
      orderBy: { priority: "desc" },
      include: { variant: { include: { product: true } }, location: true },
    });

    const discounts = recs.map((r) => {
      const payload = JSON.parse(r.payload);
      return {
        id: r.id,
        variantId: r.variantId,
        sku: r.variant.sku,
        title: r.variant.title,
        productTitle: r.variant.product.title,
        locationName: r.location?.name || payload.locationName,
        onHand: payload.onHand,
        daysOfCover: payload.daysOfCover,
        daysSinceLastSale: payload.daysSinceLastSale,
        capitalTied: payload.capitalTied,
        discountBucket: payload.discountBucket,
        rationale: payload.rationale,
        status: r.status,
        reviewedAt: r.reviewedAt,
      };
    });

    return NextResponse.json({ discounts });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAuth(["ADMIN", "MANAGER"]);
    const { ids, status } = await req.json();

    await prisma.recommendation.updateMany({
      where: { id: { in: ids } },
      data: { status, reviewedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
