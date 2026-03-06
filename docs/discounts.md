---
title: Discounts (Descuentos Recomendados)
description: Detección de sobrestock y stock muerto, buckets de descuento y proceso de revisión
section: Funcionalidades
order: 8
lastUpdated: "2026-03-06"
---

## Qué es

La página de Discounts muestra productos que tienen exceso de inventario o están muertos (sin ventas), con recomendaciones de descuento escalonadas para liberar capital.

## Criterios de detección

### Overstock
- `days_of_cover > overstock_threshold` (default: 90 días)
- Tiene inventario y está vendiéndose, pero muy lentamente para el stock disponible

### Dead Stock
- On hand > 0 **y** sin ventas en `dead_stock_days` (default: 180 días)
- O nunca se ha vendido desde que se importó

## Buckets de descuento

El sistema asigna uno de tres niveles de descuento:

| Bucket | Condición | Racional |
|--------|-----------|----------|
| **30%** (profundo) | Sin ventas ≥ 180 días **o** days of cover > 270 (1.5× dead stock) | Stock muerto: necesita movimiento agresivo |
| **20%** (moderado) | Sin ventas ≥ 90 días **o** days of cover > 135 (1.5× overstock) | Slow mover: atraer demanda sin regalar |
| **10%** (suave) | Days of cover > overstock threshold (90) | Sobrestock leve: pequeño incentivo |

### Fórmula detallada

```
Si daysSinceLastSale ≥ deadStockDays  O  daysOfCover > deadStockDays × 1.5:
  → 30% discount

Si daysSinceLastSale ≥ deadStockDays × 0.5  O  daysOfCover > overstockThreshold × 1.5:
  → 20% discount

Si daysOfCover > overstockThreshold:
  → 10% discount
```

## Organización en tabs

La página tiene tres tabs:

| Tab | Contenido |
|-----|-----------|
| **Dead Stock** | Productos con descuento recomendado de 30% |
| **Overstock** | Productos con descuento de 10% o 20% |
| **Reviewed** | Productos ya revisados (cualquier bucket) |

## Proceso de revisión

1. **Revisa los candidatos** en cada tab
2. **Click en una fila** para ver el detalle:
   - On hand, Days of cover, Days since last sale
   - Capital tied (si COGS disponible)
   - Rationale: explicación textual de por qué se recomienda
3. **Selecciona** los productos que quieres marcar como revisados
4. **Click "Mark Reviewed"** para moverlos al tab Reviewed

> **Nota**: Marcar como reviewed no aplica el descuento automáticamente. Debes aplicarlo manualmente en Shopify o tu sistema de pricing.

## Métricas del detalle

| Métrica | Descripción |
|---------|-------------|
| **On Hand** | Unidades en stock en esta location |
| **Days of Cover** | Días que durará el stock al ritmo actual |
| **Days Since Last Sale** | Días transcurridos desde la última venta |
| **Capital Tied** | on_hand × COGS (si COGS disponible) |
| **Discount Bucket** | 10%, 20% o 30% |
| **Rationale** | Explicación detallada de la recomendación |

## Recomendaciones y cautelas

- **No apliques descuentos automáticamente**: revisa siempre antes. Puede haber razones de negocio para mantener stock (ej: producto estacional que se venderá pronto).
- **Usa `excludeDiscount`** en overrides para SKUs que no deben recibir descuento nunca (ej: productos con precio fijo por contrato).
- **Revisa el capital atado**: prioriza los descuentos en productos con mayor capital inmovilizado.
- **Monitorea el efecto**: después de aplicar un descuento, observa si las ventas mejoran en los próximos ciclos.
- **Dead stock persistente**: si un producto sigue sin moverse después de un 30% de descuento, considera retirarlo del catálogo.
