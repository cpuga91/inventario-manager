---
title: COGS (Costo de Productos)
description: Qué es el metafield finance.cogs, cómo importar por CSV y buenas prácticas de calidad de datos
section: Configuración
order: 4
lastUpdated: "2026-03-06"
---

## Qué es y por qué existe

**COGS** (Cost of Goods Sold) es el costo unitario de cada producto/variante. Se usa para:

- Calcular **capital atado** (on_hand × COGS) — cuánto dinero tienes inmovilizado en inventario
- Priorizar descuentos por impacto financiero
- Enriquecer el análisis de IA con datos de costo

Sin COGS, la app funciona normalmente pero no mostrará métricas de capital atado.

## Fuentes de COGS

El sistema soporta dos fuentes:

1. **Metafield de Shopify** (`finance.cogs`): se lee automáticamente durante la sincronización
2. **Importación CSV**: se puede cargar un archivo CSV desde la página COGS

La fuente se registra en el campo `source` de cada registro:
- `metafield` — viene de Shopify
- `csv_import` — importado por CSV

## Cómo crear el metafield en Shopify

Si quieres que COGS se sincronice automáticamente desde Shopify:

1. Ve a **Shopify Admin → Settings → Custom data → Products** (o Variants)
2. Click **Add definition**
3. Configura:
   - Namespace: `finance`
   - Key: `cogs`
   - Type: `Decimal` o `Number`
4. Guarda la definición
5. Asigna valores de COGS a cada producto/variante desde el admin de Shopify

> El sistema lee este metafield durante el backfill y lo refresca diariamente a las 3:00 AM.

## Importación por CSV

Desde la página **COGS** en la app:

### Formato del CSV

```csv
sku,cogs
SKU-001,15.50
SKU-002,22.00
SKU-003,8.75
```

- **Columnas requeridas**: `sku`, `cogs`
- **Formato del COGS**: número decimal positivo
- **Encoding**: UTF-8

### Proceso de importación

1. Ve a la página **COGS** en la app
2. Click en **Import CSV**
3. Selecciona tu archivo CSV
4. El sistema valida cada fila:
   - Verifica que el SKU existe en la base de datos
   - Verifica que el valor de COGS es un número no negativo
5. Muestra resumen: total procesadas, exitosas, errores
6. Los valores se guardan en la base de datos con `source: csv_import`

### Validaciones

| Validación | Resultado si falla |
|-----------|-------------------|
| SKU no existe en DB | Fila ignorada, reportada como error |
| COGS negativo | Fila ignorada, reportada como error |
| COGS no numérico | Fila ignorada, reportada como error |
| SKU duplicado en CSV | Se usa el último valor encontrado |

## Página COGS en la app

La página muestra:

- **Tabla de variantes** con columnas: SKU, Producto, COGS, Fuente, Última actualización
- **Filtro de búsqueda** por SKU o nombre de producto
- **Estado visual**: verde si tiene COGS, gris si falta
- **Botón Import CSV** para cargar archivo

## Consideraciones de calidad de datos

- **Revisa los COGS faltantes** regularmente. SKUs sin COGS no aparecerán en métricas de capital atado.
- **Actualiza COGS al cambiar proveedores** o precios de compra.
- **Consistencia de moneda**: los valores deben estar en la misma moneda que los precios de Shopify.
- **El refresh diario** a las 3 AM actualiza desde Shopify. Si importas por CSV, los valores CSV tienen prioridad hasta que el metafield de Shopify se actualice.

## Errores comunes

| Problema | Solución |
|----------|----------|
| COGS no aparece para un SKU | Verifica que el SKU en el CSV coincide exactamente con el de Shopify (case sensitive) |
| Capital atado muestra "—" | Ese SKU no tiene COGS asignado. Importa via CSV o configura el metafield |
| CSV rechaza todas las filas | Verifica el formato: headers deben ser `sku,cogs` (minúsculas, sin espacios) |
