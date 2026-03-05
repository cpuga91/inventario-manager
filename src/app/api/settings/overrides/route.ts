import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST: create/update override
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(["ADMIN"]);
    const tenantId = user.tenantId;
    const data = await req.json();

    const { variantId, tenantLocationId, ...ruleData } = data;

    if (!variantId) {
      return NextResponse.json({ error: "variantId required" }, { status: 400 });
    }

    // Check for existing override
    const existing = await prisma.replenishmentRule.findFirst({
      where: { tenantId, isGlobal: false, variantId, tenantLocationId: tenantLocationId || null },
    });

    if (existing) {
      await prisma.replenishmentRule.update({
        where: { id: existing.id },
        data: ruleData,
      });
    } else {
      await prisma.replenishmentRule.create({
        data: {
          tenantId,
          isGlobal: false,
          variantId,
          tenantLocationId: tenantLocationId || null,
          ...ruleData,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE: remove override
export async function DELETE(req: NextRequest) {
  try {
    await requireAuth(["ADMIN"]);
    const { id } = await req.json();

    await prisma.replenishmentRule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
