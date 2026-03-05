import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parse } from "csv-parse/sync";
import { ShopifyClient } from "@/lib/shopify";

// GET: list variants with COGS
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = user.tenantId;
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");

    let variants = await prisma.variant.findMany({
      where: { tenantId },
      include: { costs: true, product: true },
      orderBy: { sku: "asc" },
    });

    if (search) {
      const s = search.toLowerCase();
      variants = variants.filter((v) =>
        v.sku?.toLowerCase().includes(s) ||
        v.title.toLowerCase().includes(s) ||
        v.product.title.toLowerCase().includes(s)
      );
    }

    return NextResponse.json({
      variants: variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        title: v.title,
        productTitle: v.product.title,
        shopifyVariantId: v.shopifyVariantId,
        cogs: v.costs[0]?.cogsValue ?? null,
        cogsSource: v.costs[0]?.source ?? null,
        cogsUpdatedAt: v.costs[0]?.updatedAt ?? null,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

// POST: CSV import of COGS values
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(["ADMIN"]);
    const tenantId = user.tenantId;

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const writeToShopify = formData.get("writeToShopify") === "true";

    if (!file) return NextResponse.json({ error: "CSV file required" }, { status: 400 });

    const text = await file.text();
    const records = parse(text, { columns: true, skip_empty_lines: true, trim: true });

    const results: Array<{ sku: string; status: string; error?: string }> = [];
    let successCount = 0;

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    let shopifyClient: ShopifyClient | null = null;
    if (writeToShopify && tenant) {
      shopifyClient = new ShopifyClient({ shop: tenant.shopDomain, accessToken: tenant.accessToken });
    }

    for (const row of records) {
      const sku = (row.SKU || row.sku || "").trim();
      const cogsStr = (row.COGS || row.cogs || row.cost || "").trim();

      if (!sku) {
        results.push({ sku: "(empty)", status: "error", error: "Missing SKU" });
        continue;
      }

      const cogsVal = parseFloat(cogsStr);
      if (isNaN(cogsVal) || cogsVal < 0) {
        results.push({ sku, status: "error", error: `Invalid COGS value: ${cogsStr}` });
        continue;
      }

      // Find variant by SKU
      const variant = await prisma.variant.findFirst({
        where: { tenantId, sku },
      });

      if (!variant) {
        results.push({ sku, status: "error", error: "Unknown SKU" });
        continue;
      }

      // Update local COGS
      await prisma.variantCost.upsert({
        where: { tenantId_variantId: { tenantId, variantId: variant.id } },
        update: { cogsValue: cogsVal, sku, source: "csv_import" },
        create: { tenantId, variantId: variant.id, sku, cogsValue: cogsVal, source: "csv_import" },
      });

      // Optionally write to Shopify metafield
      if (shopifyClient) {
        try {
          await shopifyClient.setVariantCogsMetafield(variant.shopifyVariantId, cogsVal);
          results.push({ sku, status: "success" });
        } catch (err) {
          results.push({ sku, status: "partial", error: `Saved locally but Shopify write failed: ${err}` });
        }
      } else {
        results.push({ sku, status: "success" });
      }

      successCount++;
    }

    return NextResponse.json({
      total: records.length,
      success: successCount,
      errors: results.filter((r) => r.status === "error").length,
      results,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
