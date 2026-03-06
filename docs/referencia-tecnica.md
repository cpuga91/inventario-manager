---
title: Referencia Técnica
description: Arquitectura, schema de base de datos, API endpoints, jobs y guía para desarrolladores
section: Referencia Técnica
order: 15
lastUpdated: "2026-03-06"
---

## Arquitectura

```
┌───────────────────────────────────────────────────────────────┐
│                         Next.js 14 (App Router)                │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Pages      │  │  API Routes   │  │   Cron (node-cron)    │  │
│  │  /dashboard  │  │  /api/auth    │  │  sync 15min           │  │
│  │  /transfers  │  │  /api/sync    │  │  analytics 1hr        │  │
│  │  /discounts  │  │  /api/analytics│  │  COGS daily           │  │
│  │  /cogs       │  │  /api/transfers│  │  AI daily             │  │
│  │  /ai-insights│  │  /api/discounts│  │                       │  │
│  │  /settings   │  │  /api/ai-*    │  │                       │  │
│  │  /wizard     │  │  /api/admin   │  │                       │  │
│  └──────┬──────┘  └──────┬───────┘  └───────────┬───────────┘  │
│         │                │                       │               │
│  ┌──────▼────────────────▼───────────────────────▼─────────────┐│
│  │                    Lib (Business Logic)                       ││
│  │  analytics.ts · shopify.ts · sync.ts · ai-analysis.ts        ││
│  │  auth.ts · encryption.ts · notifications.ts · cron.ts        ││
│  └──────────────────────┬──────────────────────────────────────┘│
│                         │                                        │
│  ┌──────────────────────▼──────────────────────────────────────┐│
│  │                 Prisma ORM (PostgreSQL)                       ││
│  │  17 tablas · multi-tenant · cascading deletes                ││
│  └─────────────────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────────┘
                          │
               ┌──────────▼──────────┐
               │   Shopify Admin API  │
               │   (GraphQL, read)    │
               └──────────┬──────────┘
                          │
               ┌──────────▼──────────┐
               │   OpenAI API         │
               │   (opcional)         │
               └─────────────────────┘
```

## Stack tecnológico

| Componente | Tecnología |
|-----------|-----------|
| Framework | Next.js 14.2 (App Router) |
| Lenguaje | TypeScript 5.5 |
| Base de datos | PostgreSQL + Prisma 5.15 |
| UI | Shadcn/ui + Radix UI + Tailwind CSS 3.4 |
| Auth | JWT + bcryptjs |
| Scheduling | node-cron |
| Email | Nodemailer |
| Encryption | AES-256-GCM (crypto nativo) |
| AI | OpenAI API client |
| Data processing | csv-parse, csv-stringify |
| Icons | Lucide React |

## DB Schema Overview

### Tablas principales (17)

| Tabla | Propósito | Relaciones clave |
|-------|-----------|-----------------|
| `tenants` | Multi-tenant root | Padre de todo |
| `users` | Usuarios del sistema | → tenant |
| `tenant_locations` | Locations mapeadas | → tenant |
| `products` | Productos Shopify | → tenant |
| `variants` | Variantes (SKUs) | → tenant, → product |
| `variant_costs` | COGS por variante | → tenant, → variant |
| `inventory_levels` | Stock por location | → tenant, → variant, → location |
| `orders` | Órdenes Shopify | → tenant |
| `order_lines` | Líneas de orden | → order, → variant |
| `daily_sales` | Ventas diarias agregadas | → tenant, → variant, → location |
| `replenishment_rules` | Reglas de reposición | → tenant |
| `recommendations` | Transfers/discounts/reorder | → tenant, → variant, → location |
| `alerts` | Alertas del sistema | → tenant |
| `notifications` | Notificaciones email/app | → tenant |
| `sync_cursors` | Estado de paginación | → tenant |
| `openai_settings` | Config de IA por tenant | → tenant (1:1) |
| `ai_runs` | Historial de runs de IA | → tenant |
| `audit_logs` | Log de auditoría | → tenant, → user |

### Enums

- `UserRole`: ADMIN, MANAGER, STORE_VIEW
- `RecommendationType`: TRANSFER, DISCOUNT, REORDER_EXTERNAL_FLAG
- `AiRunStatus`: SUCCESS, FAILED
- `KeyStorageMode`: ENV_ONLY, DB_ENCRYPTED

## API Endpoints

### Autenticación

| Method | Path | Descripción | Auth |
|--------|------|-------------|------|
| POST | `/api/auth/login` | Login con email/password | No |
| POST | `/api/auth/logout` | Cerrar sesión | Sí |
| GET | `/api/auth/me` | Usuario y tenant actual | Sí |

### Wizard

| Method | Path | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/api/wizard` | Estado actual del wizard | Sí |
| POST | `/api/wizard` | Avanzar paso del wizard | Sí |
| GET | `/api/wizard/locations` | Listar locations de Shopify | Sí |

### Sincronización

| Method | Path | Descripción | Auth |
|--------|------|-------------|------|
| POST | `/api/sync/backfill` | Backfill completo (12 meses) | Sí (ADMIN) |
| POST | `/api/sync/incremental` | Sync incremental | Sí |

### Datos y recomendaciones

| Method | Path | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/api/dashboard` | KPIs, risks, warehouse health | Sí |
| GET | `/api/transfers` | Transfer recommendations | Sí |
| POST | `/api/transfers/csv` | Export CSV de transfers | Sí |
| GET | `/api/discounts` | Discount recommendations | Sí |
| GET | `/api/cogs` | Lista de COGS | Sí |
| POST | `/api/analytics/run` | Ejecutar analytics | Sí (ADMIN/MANAGER) |
| GET | `/api/notifications` | Alertas y notificaciones | Sí |
| GET | `/api/ai-insights` | Resultados de AI | Sí |

### Settings y Admin

| Method | Path | Descripción | Auth |
|--------|------|-------------|------|
| GET/PUT | `/api/settings` | Reglas de reposición | Sí / ADMIN |
| GET | `/api/settings/export` | Exportar config JSON | Sí |
| POST | `/api/settings/import` | Importar config JSON | ADMIN |
| PUT | `/api/settings/overrides` | Overrides por SKU | ADMIN |
| GET/PUT | `/api/admin/openai-settings` | Config OpenAI | ADMIN |
| POST | `/api/admin/openai-run` | Ejecutar AI manual | ADMIN |
| POST | `/api/admin/openai-test` | Test conexión OpenAI | ADMIN |
| POST | `/api/admin/wizard-reset` | Reset del wizard | ADMIN |

## Jobs / Cron

Todos los jobs se ejecutan dentro del proceso Next.js via `node-cron`:

| Job | Schedule | Qué hace |
|-----|----------|----------|
| Incremental Sync | `*/15 * * * *` | Sincroniza nuevas órdenes e inventario |
| Analytics | `0 * * * *` | Recalcula recomendaciones + genera alertas |
| COGS Refresh | `0 3 * * *` | Refresca COGS desde Shopify metafields |
| AI Analysis | `0 * * * *` | Chequea cada hora si es momento de correr IA para algún tenant |

> Los jobs se inicializan en `src/app/layout.tsx` al arrancar el servidor.

## Variables de entorno (tabla completa)

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `DATABASE_URL` | Sí | PostgreSQL connection string |
| `SHOPIFY_SHOP` | Sí | Dominio `.myshopify.com` |
| `SHOPIFY_ACCESS_TOKEN` | Sí | Admin API token |
| `JWT_SECRET` | Sí | Secreto para JWT (≥32 chars) |
| `ADMIN_EMAIL` | Sí | Email del primer admin |
| `ADMIN_PASSWORD` | Sí | Contraseña del primer admin |
| `SMTP_HOST` | No | Servidor SMTP |
| `SMTP_PORT` | No | Puerto SMTP |
| `SMTP_USER` | No | Usuario SMTP |
| `SMTP_PASS` | No | Contraseña SMTP |
| `SMTP_FROM` | No | Email remitente |
| `OPENAI_API_KEY` | No | API key OpenAI |
| `OPENAI_MODEL` | No | Modelo (default: gpt-4o-mini) |
| `APP_ENCRYPTION_KEY` | No | Clave AES para encriptar API keys en DB |
| `NEXT_PUBLIC_APP_NAME` | No | Nombre de la app |
| `NODE_ENV` | No | development / production |

## Cómo correr tests

```bash
# Ejecutar todos los tests
npm test

# Watch mode
npm run test:watch
```

El proyecto usa Jest con la configuración en `jest.config.ts`.

## Cómo contribuir

### Conventional Commits

Usa el formato:

```
type(scope): descripción

feat(transfers): add batch status update
fix(sync): handle rate limit retry
chore(docs): update troubleshooting guide
```

Tipos: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`

### PR Checklist

- [ ] Build pasa (`npm run build`)
- [ ] Tests pasan (`npm test`)
- [ ] Lint limpio (`npm run lint`)
- [ ] No hay secretos en el código
- [ ] Prisma schema actualizado si hay cambios de DB (`npm run db:generate`)
- [ ] Documentación actualizada si cambia funcionalidad
