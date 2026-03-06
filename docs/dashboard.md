---
title: Dashboard
description: Cómo interpretar los KPIs, acciones urgentes y métricas del dashboard principal
section: Funcionalidades
order: 6
lastUpdated: "2026-03-06"
---

## Qué es

El Dashboard es la pantalla principal de la app. Muestra un resumen ejecutivo del estado de inventario con métricas clave y acciones urgentes.

## KPI Cards

En la parte superior se muestran 4 tarjetas de KPI:

| KPI | Qué mide | Indicador visual |
|-----|----------|-----------------|
| **Stockout Risks** | Cantidad de SKUs con riesgo de quiebre en al menos una tienda | Rojo si > 0, verde si = 0 |
| **Overstock Items** | Cantidad de SKUs con exceso de inventario | Amarillo si > 0 |
| **Dead Stock** | Cantidad de SKUs sin venta en 180+ días (o descuento ≥ 30%) | Rojo si > 0 |
| **Warehouse Status** | Unidades totales en bodega + estado general | Verde = saludable, Amarillo = reorder needed |

### Cómo interpretar

- **Stockout Risks alto**: hay tiendas que pronto se quedarán sin stock. Ve a Transfers para actuar.
- **Overstock alto**: tienes mucho capital atado. Ve a Discounts para revisar candidatos a descuento.
- **Dead Stock alto**: productos que no se mueven. Considera descuentos profundos o remoción.
- **Warehouse Status "reorder needed"**: la bodega está baja para algunos SKUs. Necesitas comprar a proveedores.

## Sección de acciones urgentes

### Top Transfers

Muestra las 5 transferencias más urgentes, ordenadas por prioridad:

- **Prioridad**: combina riesgo de quiebre (+1000 pts), tasa de venta diaria (×100), y capital atado (×0.01)
- **Columnas**: SKU, Producto, Destino, Qty recomendada, Days of Cover
- Click en una fila para ver detalle

### Top Discounts

Muestra las 5 recomendaciones de descuento más urgentes:

- **Prioridad**: ordenada por días de cobertura (mayor = más urgente)
- **Columnas**: SKU, Producto, Location, Discount %, Capital Tied

### Warehouse Reorder

Muestra hasta 8 SKUs que necesitan reabastecimiento externo:

- Se activa cuando: `warehouse_days_of_cover < lead_time + safety_days`
- Considera la demanda total de todas las tiendas

### Alertas recientes

Muestra las 10 alertas más recientes del sistema:

| Tipo | Severidad | Ejemplo |
|------|-----------|---------|
| `stockout_risk` | critical | "SKU-001 en Tienda Norte: 3 días de cobertura" |
| `dead_stock` | warning | "SKU-002: sin ventas en 200 días, capital atado $1,500" |
| `warehouse_reorder` | critical | "SKU-003: bodega con 2 días de cobertura" |

## Cuándo se actualizan los datos

- Los KPIs se recalculan cada **hora** (job de analytics)
- El inventario se sincroniza cada **15 minutos**
- Las alertas se generan automáticamente al correr analytics
- Puedes forzar un recálculo manual desde **Settings → Run Analytics**
