import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(["ADMIN"]);
    const tenantId = user.tenantId;
    const config = await req.json();

    // Import global rule
    if (config.globalRule) {
      const existing = await prisma.replenishmentRule.findFirst({
        where: { tenantId, isGlobal: true },
      });

      if (existing) {
        await prisma.replenishmentRule.update({
          where: { id: existing.id },
          data: config.globalRule,
        });
      } else {
        await prisma.replenishmentRule.create({
          data: { tenantId, isGlobal: true, ...config.globalRule },
        });
      }
    }

    // Import locations (only if no locations exist yet)
    if (config.locations && Array.isArray(config.locations)) {
      const existingLocs = await prisma.tenantLocation.count({ where: { tenantId } });
      if (existingLocs === 0) {
        for (const loc of config.locations) {
          await prisma.tenantLocation.create({
            data: {
              tenantId,
              name: loc.name,
              shopifyLocationId: loc.shopifyLocationId,
              isWarehouse: loc.isWarehouse || false,
              isStore: loc.isStore || false,
              isOnline: loc.isOnline || false,
              isVirtual: loc.isVirtual || false,
            },
          });
        }
      }
    }

    return NextResponse.json({ success: true, message: "Config imported" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
