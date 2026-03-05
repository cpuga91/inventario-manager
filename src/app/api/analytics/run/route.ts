import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { runAnalytics } from "@/lib/analytics";
import { generateAlertsFromRecommendations } from "@/lib/notifications";

export async function POST() {
  try {
    const user = await requireAuth(["ADMIN", "MANAGER"]);
    const result = await runAnalytics(user.tenantId);
    await generateAlertsFromRecommendations(user.tenantId);
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
