---
title: Reglas y Configuración
description: Thresholds globales, overrides por SKU/location y buenas prácticas de parametrización
section: Configuración
order: 5
lastUpdated: "2026-03-06"
---

## Thresholds globales

Los parámetros globales controlan todas las recomendaciones del sistema. Se configuran en **Settings** (solo ADMIN).

| Parámetro | Default | Descripción | Impacto |
|-----------|---------|-------------|---------|
| **Lead Time Days** | 3 | Días de tránsito bodega → tienda | Más alto = reposición más anticipada |
| **Safety Days** | 2 | Buffer adicional de seguridad | Más alto = menor riesgo de quiebre |
| **Review Cycle Days** | 7 | Frecuencia de revisión de transfers | Más alto = más stock de anticipación |
| **Overstock Threshold** | 90 | Días de cobertura para considerar sobrestock | Más bajo = más SKUs marcados overstock |
| **Dead Stock Days** | 180 | Días sin venta para dead stock | Más bajo = detección más agresiva |
| **Warehouse Buffer Qty** | 5 | Unidades mínimas en bodega | Protege al bodega de vaciarse completamente |
| **Target Cover Days** | 30 | Objetivo de cobertura por tienda | Define cuánto stock transferir |

### Fórmulas que usan estos parámetros

- **Riesgo de quiebre**: `days_of_cover < lead_time + safety + review_cycle`
  - Con defaults: quiebre si cover < 12 días
- **Sobrestock**: `days_of_cover > overstock_threshold`
  - Con defaults: sobrestock si cover > 90 días
- **Dead stock**: sin ventas en `dead_stock_days` y on_hand > 0
- **Cantidad a transferir**: `min(need, available_from_warehouse)`
  - `need = max(0, target_cover_days × avg_daily_sales - dest_on_hand)`
  - `available = max(0, warehouse_on_hand - warehouse_buffer)`

## Overrides por SKU/Location

Para productos que necesitan reglas diferentes a las globales:

### Casos de uso

- **Producto de alta rotación**: reducir lead time o aumentar target cover days
- **Producto estacional**: excluir de descuentos automáticos en temporada
- **Producto nuevo**: excluir de dead stock mientras se establece
- **Tienda con logística lenta**: lead time mayor que el global
- **Producto por discontinuar**: excluir de transfers

### Cómo configurar overrides

Desde **Settings**, en la sección de **SKU Overrides**:

1. Busca el SKU por código o nombre
2. Opcionalmente selecciona una location específica
3. Modifica los parámetros que quieras sobreescribir:
   - Cualquiera de los 7 parámetros globales
   - `excludeTransfer`: excluir de recomendaciones de transferencia
   - `excludeDiscount`: excluir de recomendaciones de descuento
   - `minQty` / `maxQty`: límites de cantidad por transferencia
4. Guarda

> Los overrides se aplican **encima** de las reglas globales. Solo los parámetros que cambies se sobreescriben; el resto usa el valor global.

### Prioridad de reglas

1. Override por SKU + Location (más específico)
2. Override por SKU (sin location)
3. Regla global

## Exportar / Importar configuración

### Exportar

- Desde Settings, click en **Export Config**
- Descarga un archivo JSON con:
  - Reglas globales
  - Todos los overrides por SKU/location
  - Metadata del tenant

### Importar

- Click en **Import Config**
- Selecciona un archivo JSON exportado previamente
- El sistema valida y aplica la configuración
- Útil para:
  - Replicar configuración a otra tienda
  - Restaurar configuración después de un reset
  - Versionar configuración en git

## Buenas prácticas de parametrización

1. **Empieza con los defaults** y ajusta según datos reales después de 2-4 semanas
2. **Revisa los KPIs del Dashboard** para detectar si los thresholds son demasiado agresivos o permisivos:
   - Muchos quiebres → reducir target cover o aumentar safety days
   - Muchos sobrestock → subir el threshold o reducir target cover
3. **No abuses de los overrides**: úsalos solo para excepciones claras. Si necesitas cambiar muchos SKUs, probablemente el parámetro global necesita ajuste.
4. **Documenta tus decisiones**: usa el campo de notas o un documento externo para explicar por qué se configuraron ciertos overrides.
5. **Revisa semanalmente**: los patrones de venta cambian. Lo que era correcto hace 3 meses puede no serlo hoy.
