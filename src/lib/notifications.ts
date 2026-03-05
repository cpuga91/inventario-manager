import { prisma } from "./prisma";
import nodemailer from "nodemailer";

export async function createNotification(
  tenantId: string,
  subject: string,
  body: string,
  channel: "in_app" | "email" = "in_app"
) {
  const notification = await prisma.notification.create({
    data: { tenantId, channel, subject, body },
  });

  // If email and SMTP configured, try to send
  if (channel === "email" && process.env.SMTP_HOST) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const admins = await prisma.user.findMany({
        where: { tenantId, role: "ADMIN" },
      });

      for (const admin of admins) {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || "noreply@example.com",
          to: admin.email,
          subject,
          text: body,
        });
      }

      await prisma.notification.update({
        where: { id: notification.id },
        data: { sentAt: new Date() },
      });
    } catch (err) {
      console.error("Email send failed:", err);
    }
  }

  return notification;
}

export async function createAlert(
  tenantId: string,
  type: string,
  message: string,
  severity: "info" | "warning" | "critical" = "info"
) {
  return prisma.alert.create({
    data: { tenantId, type, message, severity },
  });
}

/**
 * Generate alerts from recommendations.
 */
export async function generateAlertsFromRecommendations(tenantId: string) {
  // Critical stockout risks
  const criticalTransfers = await prisma.recommendation.findMany({
    where: { tenantId, type: "TRANSFER", status: "pending" },
    orderBy: { priority: "desc" },
    take: 10,
  });

  for (const rec of criticalTransfers) {
    const payload = JSON.parse(rec.payload);
    if (payload.stockoutRisk) {
      await createAlert(
        tenantId,
        "stockout_risk",
        `Critical stockout risk: ${payload.sku || payload.title} at ${payload.destinationName}. ${Math.round(payload.daysOfCover)} days of cover remaining.`,
        "critical"
      );
    }
  }

  // Dead stock with high capital tied
  const deadStockRecs = await prisma.recommendation.findMany({
    where: { tenantId, type: "DISCOUNT", status: "pending" },
    orderBy: { priority: "desc" },
    take: 10,
  });

  for (const rec of deadStockRecs) {
    const payload = JSON.parse(rec.payload);
    if (payload.capitalTied && payload.capitalTied > 100) {
      await createAlert(
        tenantId,
        "dead_stock",
        `Dead stock alert: ${payload.sku || payload.title} at ${payload.locationName}. $${payload.capitalTied.toFixed(2)} capital tied.`,
        "warning"
      );
    }
  }

  // Warehouse reorder flags
  const reorderFlags = await prisma.recommendation.findMany({
    where: { tenantId, type: "REORDER_EXTERNAL_FLAG", status: "pending" },
  });

  for (const rec of reorderFlags) {
    const payload = JSON.parse(rec.payload);
    await createAlert(
      tenantId,
      "warehouse_reorder",
      `Warehouse reorder needed: ${payload.sku || payload.title}. ${Math.round(payload.warehouseDaysOfCover)} days of cover at current demand.`,
      "warning"
    );

    // Also send email notification if configured
    await createNotification(
      tenantId,
      `Warehouse Reorder Alert: ${payload.sku || payload.title}`,
      `Warehouse inventory low for ${payload.sku || payload.title}. Current stock: ${payload.warehouseOnHand} units, estimated ${Math.round(payload.warehouseDaysOfCover)} days of cover.`,
      process.env.SMTP_HOST ? "email" : "in_app"
    );
  }
}
