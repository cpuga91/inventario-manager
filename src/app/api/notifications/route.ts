import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireAuth();

    const [alerts, notifications] = await Promise.all([
      prisma.alert.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.notification.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    return NextResponse.json({ alerts, notifications });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

// Mark alerts as read
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { alertIds } = await req.json();

    await prisma.alert.updateMany({
      where: { id: { in: alertIds }, tenantId: user.tenantId },
      data: { read: true },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
