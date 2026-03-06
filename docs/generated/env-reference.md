# Environment Variables Reference

> Auto-generated from `.env.example`

| Variable | Example Value | Notes |
|----------|---------------|-------|
| `SHOPIFY_SHOP` | `your-store.myshopify.com` | Shopify Configuration |
| `SHOPIFY_ACCESS_TOKEN` | `shpat_xxxxxxxxxxxxxxxxxxxxx` |  |
| `DATABASE_URL` | `postgresql://user:password@localhost:5432/adagio_replenishment` | Database (PostgreSQL recommended; falls back to SQLite) |
| `JWT_SECRET` | `change-this-to-a-random-secret-at-least-32-chars` | Auth |
| `ADMIN_EMAIL` | `admin@example.com` |  |
| `ADMIN_PASSWORD` | `change-this-password` |  |
| `SMTP_HOST` | `—` | Optional: Email notifications |
| `SMTP_PORT` | `587` |  |
| `SMTP_USER` | `—` |  |
| `SMTP_PASS` | `—` |  |
| `SMTP_FROM` | `noreply@example.com` |  |
| `OPENAI_API_KEY` | `—` | Optional: OpenAI daily analysis |
| `OPENAI_MODEL` | `gpt-4o-mini` |  |
| `OPENAI_DAILY_HOUR_LOCAL` | `07:00` |  |
| `OPENAI_MAX_SKUS` | `150` |  |
| `APP_ENCRYPTION_KEY` | `—` | Required only if you want to store API keys encrypted in the database (DB_ENCRYPTED mode) |
| `NEXT_PUBLIC_APP_NAME` | `Adagio Replenishment` | App |
| `NODE_ENV` | `development` |  |
