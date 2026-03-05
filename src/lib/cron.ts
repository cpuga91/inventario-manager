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

  console.log("[cron] Scheduled jobs initialized");
}
