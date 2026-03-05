import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/openai-run
 * Trigger an AI analysis run for the current tenant (manual run).
 */
export async function POST() {
  try {
    const user = await requireAuth(["ADMIN"]);
    const tenantId = user.tenantId;

    // Check settings
    const settings = await prisma.openAiSettings.findUnique({ where: { tenantId } });

    // Allow manual run even if is_enabled is false, but check key availability
    const hasEnvKey = !!process.env.OPENAI_API_KEY;
    const hasDbKey = settings?.keyStorageMode === "DB_ENCRYPTED" && !!settings?.encryptedApiKey;

    if (!hasEnvKey && !hasDbKey) {
      return NextResponse.json(
        { error: "No OpenAI API key configured. Set OPENAI_API_KEY in env or store an encrypted key in settings." },
        { status: 400 }
      );
    }

    const { runDailyAiAnalysis } = await import("@/lib/ai-analysis");
    const result = await runDailyAiAnalysis(tenantId);

    const run = await prisma.aiRun.findUnique({ where: { id: result.runId } });

    let insights = null;
    if (run?.status === "SUCCESS" && run.outputJson) {
      try {
        insights = JSON.parse(run.outputJson);
      } catch {
        insights = null;
      }
    }

    return NextResponse.json({
      success: true,
      run: {
        id: run?.id,
        runDate: run?.runDate,
        status: run?.status,
        model: run?.model,
        tokensIn: run?.tokensIn,
        tokensOut: run?.tokensOut,
        errorMessage: run?.errorMessage,
        createdAt: run?.createdAt,
      },
      insights,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
