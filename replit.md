# Adagio Replenishment

A Next.js 14 inventory replenishment dashboard for Shopify stores. Syncs Shopify data (products, variants, orders, inventory) to a local PostgreSQL database and generates replenishment recommendations.

## Architecture

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL via Prisma ORM (Replit built-in DB)
- **Auth**: JWT-based authentication with bcrypt password hashing
- **Styling**: Tailwind CSS
- **External API**: Shopify Admin API

## Key Source Files

- `src/app/` — Next.js App Router pages and API routes
- `src/lib/` — Shared server-side utilities (auth, prisma, shopify, sync, cron, notifications)
- `src/components/` — React components
- `prisma/schema.prisma` — Database schema
- `prisma/seed.ts` — Database seed script

## Running

- **Dev**: `npm run dev` (runs on port 5000, bound to 0.0.0.0 for Replit)
- **DB push**: `npm run db:push`
- **DB seed**: `npm run db:seed`

## Required Environment Secrets

- `DATABASE_URL` — PostgreSQL connection string (auto-provided by Replit)
- `JWT_SECRET` — Secret key for signing auth tokens (min 32 chars)
- `SHOPIFY_SHOP` — Shopify store domain (e.g. `your-store.myshopify.com`)
- `SHOPIFY_ACCESS_TOKEN` — Shopify Admin API access token
- `ADMIN_EMAIL` — Initial admin user email
- `ADMIN_PASSWORD` — Initial admin user password

## Optional Environment Secrets

- `OPENAI_API_KEY` — OpenAI API key for AI-powered inventory analysis
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — Email notifications

## Replit Migration Notes

- Port changed from default 3000 to 5000, bound to `0.0.0.0` for Replit proxy
- Replit-managed PostgreSQL database connected via built-in `DATABASE_URL` secret
- Prisma schema pushed and client generated on migration
- OpenAI `require()` calls changed to `await import("openai")` for webpack compatibility
- `openai` npm package added as dependency for AI analysis features
