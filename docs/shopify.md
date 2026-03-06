---
title: Conexión con Shopify
description: Datos que se leen, frecuencias de sincronización, rate limits e idempotencia
section: Integraciones
order: 3
lastUpdated: "2026-03-06"
---

## Qué datos se leen

El sistema se conecta a Shopify Admin API vía GraphQL y lee:

| Dato | Endpoint/Query | Uso en la app |
|------|---------------|---------------|
| **Products** | `products` query | Catálogo base, títulos, vendors, tags |
| **Variants** | Incluidos en products | SKU, precio, inventory item ID |
| **Inventory Levels** | `inventoryLevels` por location | Stock on-hand por SKU por location |
| **Orders** | `orders` query | Historial de ventas para calcular demanda |
| **Order Line Items** | Incluidos en orders | Cantidad vendida por SKU |
| **Locations** | `locations` query | Mapeo de bodegas y tiendas |
| **COGS Metafield** | `metafield(namespace:"finance", key:"cogs")` | Costo unitario para capital atado |

> **Importante**: La app solo **lee** datos de Shopify. No crea ni modifica productos, órdenes ni inventario.

## Frecuencias de sincronización

| Job | Frecuencia | Qué hace |
|-----|-----------|----------|
| **Incremental Sync** | Cada 15 minutos | Sincroniza nuevas órdenes e inventario actualizado |
| **Analytics** | Cada hora | Recalcula todas las recomendaciones (transfers, discounts, reorder flags) |
| **COGS Refresh** | Diario a las 3:00 AM | Refresca valores de COGS desde metafields de Shopify |
| **AI Analysis** | Diario (hora configurable) | Ejecuta análisis de IA si está habilitado |
| **Backfill** | Manual (Wizard Step 4) | Carga completa de 12 meses de historial |

Todos los jobs se ejecutan dentro del proceso Next.js usando `node-cron`. Se inicializan automáticamente al arrancar la app.

## Rate limits y paginación

### Rate limits
Shopify GraphQL tiene un límite de **costo de query** (1000 puntos por app, regenera 50/segundo). El sistema:

- Usa queries paginadas con `first: 50` para controlar el costo
- Implementa cursor-based pagination (`after` cursor)
- Guarda el último cursor procesado en la tabla `sync_cursors` para continuar desde donde quedó

### Paginación
- Cada query retorna un máximo de 50 registros a la vez
- El cursor se persiste en la base de datos (`sync_cursors`)
- Si una sync se interrumpe, la siguiente retoma desde el último cursor guardado

## Idempotencia

El sistema evita duplicados mediante:

- **Unique constraints** en la base de datos:
  - `(tenant_id, shopify_product_id)` para productos
  - `(tenant_id, shopify_variant_id)` para variantes
  - `(tenant_id, shopify_order_id)` para órdenes
  - `(tenant_id, variant_id, tenant_location_id)` para inventory levels
  - `(tenant_id, date, variant_id, tenant_location_id)` para daily sales

- **Upsert operations**: al sincronizar, se usa `upsert` (insert or update) para que los datos se actualicen si ya existen sin crear duplicados.

- **Cursor tracking**: el cursor de paginación se guarda entre ejecuciones, evitando reprocesar registros ya importados.

## Mapeo de Locations

Las locations de Shopify se clasifican en el Wizard (Step 2):

| Tipo | Configuración | Reglas |
|------|--------------|--------|
| **Warehouse** | `isWarehouse: true` | Exactamente 1. Fuente de transfers. |
| **Store** | `isStore: true` | 0+. Destinos de reposición. |
| **Online** | `isOnline: true` | 0-1. Puede ser location real o virtual. |
| **Virtual** | `isVirtual: true` | Location lógica sin ID de Shopify. Para canal online cuando no hay location física. |

> **Nota**: Si cambias las locations en Shopify (agregar/eliminar tiendas), debes hacer un **soft reset del Wizard** en Settings para remapear.
