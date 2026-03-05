import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/ai-insights - Get latest AI run for the tenant
 * GET /api/ai-insights?all=true - Get all AI runs
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const url = new URL(req.url);
    const all = url.searchParams.get("all") === "true";

    if (all) {
      const runs = await prisma.aiRun.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { runDate: "desc" },
        take: 30,
      });
      return NextResponse.json({ runs });
    }

    // Latest successful run
    const latestRun = await prisma.aiRun.findFirst({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: "desc" },
    });

    if (!latestRun) {
      return NextResponse.json({ run: null, insights: null });
    }

    let insights = null;
    if (latestRun.status === "SUCCESS" && latestRun.outputJson) {
      try {
        insights = JSON.parse(latestRun.outputJson);
      } catch {
        insights = null;
      }
    }

    return NextResponse.json({
      run: {
        id: latestRun.id,
        runDate: latestRun.runDate,
        status: latestRun.status,
        model: latestRun.model,
        promptVersion: latestRun.promptVersion,
        tokensIn: latestRun.tokensIn,
        tokensOut: latestRun.tokensOut,
        errorMessage: latestRun.errorMessage,
        reviewed: latestRun.reviewed,
        createdAt: latestRun.createdAt,
      },
      insights,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

/**
 * POST /api/ai-insights - Trigger an AI analysis run
 */
export async function POST() {
  try {
    const user = await requireAuth(["ADMIN"]);

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured. Add it to your .env file." },
        { status: 400 }
      );
    }

    const { runDailyAiAnalysis } = await import("@/lib/ai-analysis");
    const result = await runDailyAiAnalysis(user.tenantId);

    // Fetch the full run to return
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
    console.error("AI analysis error:", err);
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/ai-insights - Mark a run as reviewed
 */
export async function PATCH(req: NextRequest) {
  try {
    await requireAuth(["ADMIN", "MANAGER"]);
    const body = await req.json();
    const { runId } = body;

    if (!runId) {
      return NextResponse.json({ error: "runId required" }, { status: 400 });
    }

    await prisma.aiRun.update({
      where: { id: runId },
      data: { reviewed: true },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
