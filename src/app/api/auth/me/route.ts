import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      tenant: { id: user.tenant.id, name: user.tenant.name, wizardComplete: user.tenant.wizardComplete, wizardStep: user.tenant.wizardStep },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
