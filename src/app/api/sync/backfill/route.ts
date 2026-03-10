import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ShopifyClient } from "@/lib/shopify";
import { SyncService } from "@/lib/sync";
import { runAnalytics } from "@/lib/analytics";
import { generateAlertsFromRecommendations } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(["ADMIN"]);
    const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
    if (!tenant) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse configurable months from request body (default 12)
    let months = 12;
    try {
      const body = await req.json();
      if (body.months && typeof body.months === "number" && body.months >= 1 && body.months <= 36) {
        months = body.months;
      }
    } catch {
      // No body or invalid JSON — use default
    }

    const client = new ShopifyClient({
      shop: tenant.shopDomain,
      accessToken: tenant.accessToken,
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let closed = false;

        const send = (data: Record<string, unknown>) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch {
            closed = true;
          }
        };

        try {
          // Progress callback for sync service
          const onProgress = (phase: string, detail: string, progress?: number) => {
            send({ type: "progress", phase, detail, progress });
          };

          const sync = new SyncService(client, tenant.id, onProgress);

          // Phase 1: Backfill
          send({ type: "phase", phase: "variants", message: `Syncing products & variants (${months} months)...` });
          const stats = await sync.backfill(months);
          send({ type: "phase_done", phase: "backfill", stats });

          // Phase 2: Aggregate daily sales
          send({ type: "phase", phase: "aggregation", message: "Aggregating daily sales..." });
          const dailySalesCount = await sync.aggregateDailySales();
          send({ type: "phase_done", phase: "aggregation", dailySales: dailySalesCount });

          // Phase 3: Analytics
          send({ type: "phase", phase: "analytics", message: "Running analytics engine..." });
          const analyticsResult = await runAnalytics(tenant.id);
          send({ type: "phase_done", phase: "analytics", analytics: analyticsResult });

          // Phase 4: Alerts
          send({ type: "phase", phase: "alerts", message: "Generating alerts..." });
          await generateAlertsFromRecommendations(tenant.id);
          send({ type: "phase_done", phase: "alerts" });

          // Mark wizard complete
          await prisma.tenant.update({
            where: { id: tenant.id },
            data: { wizardStep: 4, wizardComplete: true },
          });

          send({
            type: "complete",
            success: true,
            sync: stats,
            dailySales: dailySalesCount,
            analytics: analyticsResult,
          });
        } catch (err: unknown) {
          console.error("Backfill error:", err);
          const message = err instanceof Error ? err.message : "Error";
          send({ type: "error", error: message });
        } finally {
          if (!closed) {
            try { controller.close(); } catch { /* already closed */ }
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: unknown) {
    console.error("Backfill auth error:", err);
    const message = err instanceof Error ? err.message : "Error";
    return new Response(JSON.stringify({ error: message }), {
      status: message === "Unauthorized" || message === "Forbidden" ? 403 : 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
