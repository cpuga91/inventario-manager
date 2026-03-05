import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const shopDomain = process.env.SHOPIFY_SHOP || "example.myshopify.com";
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN || "shpat_placeholder";
  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

  // Create or find tenant
  const tenant = await prisma.tenant.upsert({
    where: { shopDomain },
    update: {},
    create: {
      name: "Adagio Teas",
      shopDomain,
      accessToken,
    },
  });

  console.log(`Tenant: ${tenant.name} (${tenant.id})`);

  // Create admin user
  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: adminEmail } },
    update: { password: hashedPassword },
    create: {
      tenantId: tenant.id,
      email: adminEmail,
      password: hashedPassword,
      name: "Admin",
      role: "ADMIN",
    },
  });

  console.log(`Admin user: ${user.email} (${user.id})`);

  // Create default global replenishment rule
  const existing = await prisma.replenishmentRule.findFirst({
    where: { tenantId: tenant.id, isGlobal: true },
  });

  if (!existing) {
    await prisma.replenishmentRule.create({
      data: {
        tenantId: tenant.id,
        isGlobal: true,
        leadTimeDays: 3,
        safetyDays: 2,
        reviewCycleDays: 7,
        overstockThresholdDays: 90,
        deadStockDays: 180,
        warehouseBufferQty: 5,
        targetCoverDays: 30,
      },
    });
    console.log("Default replenishment rules created");
  }

  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
