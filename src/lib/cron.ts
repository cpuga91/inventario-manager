/**
 * Cron scheduler for periodic sync and analytics.
 * Runs inside the Next.js process.
 */
import cron from "node-cron";
import { prisma } from "./prisma";
import { SyncService } from "./sync";
import { runAnalytics } from "./analytics";
import { generateAlertsFromRecommendations } from "./notifications";
import { ShopifyClient } from "./shopify";

let initialized = false;

export function initCron() {
  if (initialized) return;
  initialized = true;

  // Every 15 minutes: incremental sync
  cron.schedule("*/15 * * * *", async () => {
    console.log("[cron] Starting incremental sync...");
    try {
      const tenants = await prisma.tenant.findMany({ where: { wizardComplete: true } });
      for (const tenant of tenants) {
        const client = new ShopifyClient({
          shop: tenant.shopDomain,
          accessToken: tenant.accessToken,
        });
        const sync = new SyncService(client, tenant.id);
        const stats = await sync.incrementalSync();
        console.log(`[cron] Incremental sync for ${tenant.name}:`, stats);
      }
    } catch (err) {
      console.error("[cron] Incremental sync error:", err);
    }
  });

  // Every hour: run analytics
  cron.schedule("0 * * * *", async () => {
    console.log("[cron] Starting analytics run...");
    try {
      const tenants = await prisma.tenant.findMany({ where: { wizardComplete: true } });
      for (const tenant of tenants) {
        const result = await runAnalytics(tenant.id);
        await generateAlertsFromRecommendations(tenant.id);
        console.log(`[cron] Analytics for ${tenant.name}:`, result);
      }
    } catch (err) {
      console.error("[cron] Analytics error:", err);
    }
  });

  // Daily at 3 AM: refresh COGS metafields
  cron.schedule("0 3 * * *", async () => {
    console.log("[cron] Refreshing COGS metafields...");
    try {
      const tenants = await prisma.tenant.findMany({ where: { wizardComplete: true } });
      for (const tenant of tenants) {
        const client = new ShopifyClient({
          shop: tenant.shopDomain,
          accessToken: tenant.accessToken,
        });
        const sync = new SyncService(client, tenant.id);
        await sync.backfill(0); // Just refreshes variants/COGS, no orders
      }
    } catch (err) {
      console.error("[cron] COGS refresh error:", err);
    }
  });

  // Daily AI analysis — runs every hour, checks per-tenant settings for schedule
  cron.schedule("0 * * * *", async () => {
    try {
      const { runDailyAiAnalysis } = await import("./ai-analysis");
      const tenants = await prisma.tenant.findMany({
        where: { wizardComplete: true },
        include: { openAiSettings: true },
      });

      for (const tenant of tenants) {
        const settings = tenant.openAiSettings;

        // Skip if tenant has settings and is disabled
        if (settings && !settings.isEnabled) continue;

        // If no settings exist, fall back to env-based behavior
        if (!settings && !process.env.OPENAI_API_KEY) continue;

        // Check if current hour matches the tenant's scheduled hour
        const tz = settings?.timezone || "America/Santiago";
        const targetHour = settings?.dailyHourLocal ?? 7;
        let currentHour: number;
        try {
          currentHour = parseInt(new Date().toLocaleString("en-US", { timeZone: tz, hour: "2-digit", hour12: false }));
        } catch {
          currentHour = new Date().getUTCHours();
        }

        if (currentHour !== targetHour) continue;

        console.log(`[cron] Starting AI analysis for ${tenant.name}...`);
        try {
          const result = await runDailyAiAnalysis(tenant.id);
          console.log(`[cron] AI analysis for ${tenant.name}: ${result.status} (run ${result.runId})`);
        } catch (err) {
          console.error(`[cron] AI analysis error for ${tenant.name}:`, err);
        }
      }
    } catch (err) {
      console.error("[cron] AI analysis scheduler error:", err);
    }
  });
  console.log("[cron] AI analysis scheduler initialized (per-tenant settings)");

  console.log("[cron] Scheduled jobs initialized");
}
