---
title: Transfers (Reposición)
description: Cómo funcionan las recomendaciones de transferencia, flujo operativo y exportación CSV
section: Funcionalidades
order: 7
lastUpdated: "2026-03-06"
---

## Qué es una recomendación de transferencia

Una transferencia es una sugerencia de mover inventario desde la **bodega** hacia una **tienda** o canal **online**. El sistema calcula automáticamente qué SKUs necesitan reposición y cuántas unidades transferir.

## Cómo se calcula

### Paso 1: Métricas por SKU/Location

Para cada combinación de variante + tienda, el sistema calcula:

- **Avg Daily Sales (30d)**: promedio de ventas diarias en los últimos 30 días
- **Days of Cover**: `on_hand ÷ avg_daily_sales`
- **Target On Hand**: `target_cover_days × avg_daily_sales`

### Paso 2: Cantidad de transferencia

```
need = max(0, target_on_hand - dest_on_hand)
available = max(0, warehouse_on_hand - warehouse_buffer)
transfer_qty = min(need, available)
```

Solo se genera recomendación si `transfer_qty > 0`.

### Paso 3: Priorización

Cada recomendación recibe un puntaje de prioridad:

| Factor | Puntos |
|--------|--------|
| Riesgo de quiebre | +1,000 |
| Tasa de venta diaria | +100 × avg_daily_sales |
| Capital atado | +0.01 × capital_tied |

Las transferencias se ordenan de mayor a menor prioridad.

### Paso 4: Overrides

Si un SKU tiene overrides configurados:
- Se usan los parámetros específicos en vez de los globales
- Si `excludeTransfer = true`, se omite

## Flujo operativo

### 1. Revisar recomendaciones

- Ve a la página **Transfers**
- Las recomendaciones están ordenadas por prioridad (más urgentes primero)
- Usa el **buscador** para filtrar por SKU o producto
- Usa el **filtro de location** para ver solo una tienda

### 2. Seleccionar SKUs

- Marca los checkboxes de las transferencias que quieres ejecutar
- O usa **Select All** para seleccionar todas las visibles

### 3. Revisar detalle

Click en una fila para ver el detalle:

- Cantidad recomendada (heurística)
- Cantidad sugerida por IA (si disponible)
- Inventario en bodega y destino
- Avg daily sales y days of cover
- Target on hand calculado

### 4. Exportar CSV

- Click en **Export CSV** para descargar el plan de transferencia
- El CSV incluye: SKU, Product, Destination, Qty, Warehouse On Hand, Dest On Hand, Days of Cover
- Opcionalmente filtra por location antes de exportar

### 5. Actualizar estados

Conforme ejecutas las transferencias físicamente, actualiza el estado:

| Estado | Significado |
|--------|-------------|
| `pending` | Recomendación nueva, no actuada |
| `picked` | Producto recogido en bodega |
| `shipped` | En tránsito a la tienda |
| `received` | Recibido en destino |

- Selecciona transfers y usa los botones de acción para cambiar estado en lote

## Usar AI Prioritization

Si tienes IA habilitada y hay un run exitoso reciente:

1. Click en **Use AI prioritization** (botón toggle)
2. Las transferencias se reordenan según la prioridad de la IA
3. Se muestra la cantidad sugerida por IA junto a la heurística
4. El score de confianza de la IA aparece en el detalle

> La IA puede sugerir cantidades diferentes porque considera patrones que la heurística no captura (tendencias, estacionalidad, anomalías).

## Glosario de columnas

| Columna | Descripción |
|---------|-------------|
| **SKU** | Código del producto en Shopify |
| **Product** | Nombre del producto/variante |
| **Destination** | Tienda o canal destino |
| **Transfer Qty** | Unidades recomendadas a mover |
| **Warehouse On Hand** | Stock actual en bodega |
| **Dest On Hand** | Stock actual en destino |
| **Avg Daily Sales** | Venta promedio diaria (30 días) |
| **Days of Cover** | Días de cobertura en destino |
| **Target On Hand** | Stock objetivo en destino |
| **Priority** | Puntaje de urgencia (mayor = más urgente) |
| **Capital Tied** | Valor del inventario en destino (on_hand × COGS) |
| **Status** | Estado actual de la transferencia |

## Errores comunes

| Problema | Causa | Solución |
|----------|-------|----------|
| Transfer qty = 0 para SKU con poco stock | Bodega no tiene suficiente (respeta buffer) | Revisar Warehouse Reorder; necesitas comprar a proveedor |
| Recomendaciones no aparecen | Analytics no ha corrido | Ve a Settings → Run Analytics |
| Cantidades parecen altas | Target cover days es alto | Ajustar en Settings (reducir target cover days) |
| SKU no aparece en transfers | Override con `excludeTransfer = true` | Revisar overrides en Settings |
| Mismos SKUs cada día | No se están ejecutando las transferencias | Actualizar estados o ejecutar los moves |
