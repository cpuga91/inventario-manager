---
title: AI Insights (OpenAI)
description: Qué hace la IA, datos enviados, configuración, output y troubleshooting
section: Inteligencia Artificial
order: 9
lastUpdated: "2026-03-06"
---

## Qué hace y qué NO hace

### Qué hace
- Analiza métricas de inventario para **priorizar transferencias** con más precisión
- Detecta **anomalías** (picos/caídas de ventas, drift de inventario, problemas de datos)
- Sugiere **ajustes de parámetros** (lead time, safety days, thresholds)
- Genera un **resumen ejecutivo** del estado del inventario
- Identifica **locations de mayor riesgo**

### Qué NO hace
- No modifica datos ni configuración automáticamente
- No ejecuta transferencias ni aplica descuentos
- No reemplaza al motor determinístico (lo complementa)
- No toma decisiones por ti

### Guardrails
- Solo se envían datos **agregados y anonimizados** (sin PII)
- El output se **valida contra un JSON schema** antes de guardarse
- Si la validación falla, el run se marca como FAILED
- Cada run se registra en audit log

## Datos enviados a OpenAI

El payload incluye exclusivamente:

| Dato | Detalle |
|------|---------|
| Nombre del tenant | Identificación de la tienda |
| Configuración global | lead time, safety days, thresholds |
| Locations | Solo tipo (warehouse/store/online), no datos de cliente |
| Top SKUs en riesgo | Max configurable (default 150) |

### Por cada SKU se envía:
- SKU code, variant ID, destination location
- Inventory levels (warehouse + destination on hand)
- Sales metrics (avg daily 7/14/30 días)
- Days of cover, days since last sale
- Transfer qty heurística y priority score
- COGS y capital tied

### Resumen agregado:
- Total SKUs, stockout risks count, overstock count, dead stock count

> **No se envía**: nombres de clientes, emails, direcciones, datos de pago ni información personal.

## Estructura del output JSON

El análisis de IA retorna un JSON con estas secciones:

### `headline`
- `summary`: Resumen de una línea del estado del inventario
- `topRiskLocations`: Array con locations de mayor riesgo y razón
- `notes`: Notas adicionales

### `prioritizedTransfers`
Array ordenado por prioridad con:
- `variantId`, `destinationLocationId`
- `priority` (1-100, 100 = más urgente)
- `suggestedQty`: cantidad sugerida por IA
- `confidence`: 0.0 a 1.0
- `evidence`: inventario actual, ventas, cover days
- `rationale`: explicación en texto

### `discountSuggestions`
Array con:
- `variantId`, `locationId`
- `suggestedDiscountPct`: porcentaje recomendado
- `confidence`: 0.0 a 1.0
- `evidence`: días sin venta, cover, capital atado
- `rationale`

### `anomalies`
Array con:
- `type`: `SALES_SPIKE`, `SALES_DROP`, `INVENTORY_DRIFT`, `DATA_QUALITY`
- `confidence`: 0.0 a 1.0
- `description`: qué se detectó
- `evidence`: métrica, valor actual vs baseline

### `parameterSuggestions`
Array con:
- `parameter`: nombre del parámetro (ej: `lead_time`, `safety_days`)
- `currentValue`, `suggestedValue`
- `confidence`: 0.0 a 1.0
- `reasoning`: por qué sugiere el cambio

## Cómo activar/desactivar

Desde **Settings** (solo ADMIN):

1. Sección **OpenAI Configuration**
2. Toggle **Enable AI Insights**
3. Configura:
   - **Model**: `gpt-4o-mini` (recomendado), `gpt-4o`, `gpt-4-turbo`, `gpt-3.5-turbo`
   - **Daily Run Hour**: hora local de ejecución (0-23)
   - **Timezone**: zona horaria del tenant
   - **Max SKUs**: máximo de SKUs a enviar por análisis (1-1000)
4. **API Key**: dos modos:
   - `ENV_ONLY`: usa la variable de entorno `OPENAI_API_KEY`
   - `DB_ENCRYPTED`: guarda la key encriptada en la base de datos (requiere `APP_ENCRYPTION_KEY`)
5. Guarda cambios

## Página AI Insights

Muestra:

- **Último run**: fecha, estado, modelo usado, tokens consumidos
- **Botón "Run Analysis"**: ejecuta un análisis manual
- **Headline**: resumen ejecutivo y locations de riesgo
- **Prioritized Transfers**: tabla con ranking de IA
- **Discount Suggestions**: sugerencias de descuento de IA
- **Anomalies** (colapsable): anomalías detectadas
- **Parameter Suggestions** (colapsable): sugerencias de ajuste
- **Botón "Mark Reviewed"**: marca el run como revisado

## Troubleshooting

| Problema | Causa | Solución |
|----------|-------|----------|
| Run status = FAILED | JSON inválido del modelo | Revisa `errorMessage` en el detalle del run. Prueba con otro modelo. |
| "No API key available" | Ni env var ni key en DB | Configura `OPENAI_API_KEY` o guarda una key en Settings |
| Run no se ejecuta a la hora | Timezone incorrecto o proceso reiniciado | Verifica timezone en Settings. Los cron jobs requieren que el proceso esté corriendo. |
| Output vacío o parcial | Max SKUs muy bajo o datos insuficientes | Aumenta Max SKUs. Verifica que hay suficientes datos de ventas/inventario. |
| Tokens altos | Muchos SKUs enviados | Reduce Max SKUs en Settings |
| "Encryption key required" | `APP_ENCRYPTION_KEY` no configurada | Agrega la variable de entorno o usa modo `ENV_ONLY` |
