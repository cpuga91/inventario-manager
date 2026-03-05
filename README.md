# Adagio Replenishment MVP

Multi-location inventory replenishment web app for Shopify POS stores.

**Model:** Central Warehouse (Shopify Location) → Stores + Online

## Features

- **Setup Wizard**: 4-step resumable wizard (Connect Shopify → Map Locations → Business Rules → Backfill)
- **Dashboard**: Top stockout risks, overstock/dead stock, warehouse health, alerts
- **Transfers**: Ranked transfer recommendations (warehouse → stores/online), CSV export, status tracking
- **Discounts**: Overstock/dead stock discount recommendations with rationale and buckets (10/20/30%)
- **COGS Management**: CSV import, Shopify metafield (finance.cogs) read/write
- **Settings**: Global thresholds, per-SKU overrides, config export/import JSON
- **Analytics Engine**: avg daily sales, days of cover, stockout/overstock/dead stock detection
- **Notifications**: In-app alerts + optional email (SMTP)
- **Scheduled Sync**: 15-min incremental sync, hourly analytics, daily COGS refresh

## Tech Stack

- Next.js 14 (App Router) + TypeScript
- Prisma ORM + PostgreSQL
- Tailwind CSS
- Shopify Admin API GraphQL (2024-04)
- node-cron for scheduled jobs
- bcrypt + JWT auth

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Required
SHOPIFY_SHOP=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxx
DATABASE_URL=postgresql://user:password@localhost:5432/adagio_replenishment
JWT_SECRET=change-this-to-a-random-secret-at-least-32-chars
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-this-password

# Optional: Email notifications
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@example.com
```

### Shopify Access Token Permissions

Your custom app needs these scopes:
- `read_products` - variants, metafields
- `write_products` - COGS metafield updates
- `read_inventory` - inventory levels
- `read_orders` - order history
- `read_locations` - location list

## Setup

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push schema to database (or run migrations)
npx prisma db push

# Seed admin user + default config
npm run db:seed

# Start development server
npm run dev
```

## How to Run Backfill / Sync

1. Complete the Setup Wizard (login → /wizard)
2. The wizard Step 4 triggers a full 12-month backfill automatically
3. After setup, incremental sync runs every 15 minutes via cron
4. Manual triggers available:
   - `POST /api/sync/backfill` - Full backfill (12 months)
   - `POST /api/sync/incremental` - Incremental sync
   - `POST /api/analytics/run` - Run analytics engine

## How to Deploy on Replit

1. Create a new Replit with Node.js
2. Import this repository
3. Set environment variables in Replit Secrets
4. In the Replit shell:
   ```bash
   npm install
   npx prisma generate
   npx prisma db push
   npm run db:seed
   npm run build
   npm start
   ```
5. The app runs on port 3000

## COGS Metafield

The app uses a Shopify Variant metafield for COGS:
- **Namespace:** `finance`
- **Key:** `cogs`
- **Type:** `number_decimal`
- **Description:** Unit cost of goods sold for this variant

To bulk update COGS:
1. Go to the COGS page in the app
2. Upload a CSV with columns: `SKU, COGS`
3. Optionally check "Write to Shopify metafield" to sync back to Shopify

## Shopify GraphQL Queries Used

### List Locations
```graphql
{ locations(first: 50) { edges { node { id name isActive } } } }
```

### Variants + COGS Metafield
```graphql
query($cursor: String) {
  productVariants(first: 50, after: $cursor) {
    edges { node { id sku title price
      product { id title vendor tags }
      metafield(namespace: "finance", key: "cogs") { value }
      inventoryItem { id }
    } }
    pageInfo { hasNextPage endCursor }
  }
}
```

### Inventory Levels
```graphql
query($cursor: String) {
  inventoryItems(first: 50, after: $cursor) {
    edges { node { id variant { id }
      inventoryLevels(first: 50) { edges { node {
        location { id }
        quantities(names: ["available"]) { name quantity }
      } } }
    } }
    pageInfo { hasNextPage endCursor }
  }
}
```

### Paid Orders
```graphql
query($cursor: String, $queryStr: String!) {
  orders(first: 50, after: $cursor, query: $queryStr) {
    edges { node { id name createdAt
      totalPriceSet { shopMoney { amount } }
      lineItems(first: 100) { edges { node {
        variant { id } sku quantity
        originalUnitPriceSet { shopMoney { amount } }
      } } }
      physicalLocation { id }
    } }
    pageInfo { hasNextPage endCursor }
  }
}
```

### Write COGS Metafield
```graphql
mutation($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields { id key value }
    userErrors { field message }
  }
}
```

## Test Plan

### Unit Tests
```bash
npm test
```
26 test cases covering:
- `computeAvgDailySales` (4 cases)
- `computeDaysOfCover` (3 cases)
- `isStockoutRisk` (2 cases)
- `isOverstockRisk` (2 cases)
- `isDeadStock` (4 cases)
- `computeTransferQty` (4 cases)
- `computeDiscountBucket` (4 cases)
- `computeTransferPriority` (3 cases)

### Manual Test Plan
1. **Backfill idempotency**: Run backfill; note counts; re-run → confirm no duplicates
2. **COGS metafield**: Read COGS from Shopify metafield; update via CSV; verify write-back
3. **Thresholds**: Adjust thresholds in Settings; run analytics → confirm recommendations change
4. **Transfer plan**: Generate transfer plan; export CSV; re-run → verify stable results
5. **Wizard resumability**: Start wizard, close at step 2, re-open → resumes at step 2
6. **Auth + roles**: Login as ADMIN (full access), STORE_VIEW (read-only settings)

## Database Schema

17 tables: tenants, users, tenant_locations, products, variants, variant_costs, inventory_levels, orders, order_lines, daily_sales, replenishment_rules, recommendations, alerts, notifications, sync_cursors

### Key Indexes
- `(tenant_id, variant_id)` on variants, inventory_levels, daily_sales
- `(tenant_id, location_id)` on inventory_levels
- `(tenant_id, date)` on orders, daily_sales
- `(tenant_id, type, status)` on recommendations

## Architecture

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── auth/          # Login, logout, me
│   │   ├── wizard/        # Setup wizard + locations
│   │   ├── sync/          # Backfill + incremental
│   │   ├── analytics/     # Run analytics
│   │   ├── dashboard/     # Dashboard data
│   │   ├── transfers/     # Transfer recs + CSV
│   │   ├── discounts/     # Discount recs
│   │   ├── cogs/          # COGS import/list
│   │   ├── settings/      # Thresholds + export/import
│   │   └── notifications/ # Alerts + notifications
│   ├── login/             # Login page
│   ├── wizard/            # Setup wizard UI
│   ├── dashboard/         # Dashboard UI
│   ├── transfers/         # Transfers UI
│   ├── discounts/         # Discounts UI
│   ├── cogs/              # COGS management UI
│   └── settings/          # Settings UI
├── components/            # Shared UI components
├── lib/                   # Core business logic
│   ├── prisma.ts          # DB client
│   ├── shopify.ts         # Shopify GraphQL client
│   ├── auth.ts            # Auth utilities
│   ├── sync.ts            # Data sync service
│   ├── analytics.ts       # Analytics engine
│   ├── notifications.ts   # Notification service
│   └── cron.ts            # Scheduled jobs
└── types/                 # TypeScript types
```

## Limitations (MVP)

- No Shopify stock move automation (transfers are manual/export-only)
- No purchasing automation (warehouse reorder is flag-only)
- Polling-based sync (no webhooks in MVP)
- Single-process cron (not distributed)
- No real-time updates (page refresh needed)
