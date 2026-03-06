---
title: Operación Diaria (Playbook)
description: Rutinas recomendadas diarias y semanales para el equipo de operaciones
section: Operaciones
order: 13
lastUpdated: "2026-03-06"
---

## Rutina diaria (mañana)

Ejecuta estos pasos cada mañana, idealmente antes de abrir tiendas:

### 1. Revisar stockout risks (5 min)

- Abre el **Dashboard**
- Mira el KPI **Stockout Risks**
- Si es > 0, revisa los "Top Transfers" urgentes
- Identifica qué tiendas están en riesgo

### 2. Ejecutar transfer plan (10-15 min)

- Ve a **Transfers**
- Revisa las recomendaciones ordenadas por prioridad
- Filtra por tienda si necesitas preparar envíos específicos
- Selecciona las transferencias a ejecutar
- **Exporta CSV** para el equipo de bodega
- Marca como **picked** las que se están preparando

### 3. Revisar descuentos (5 min)

- Ve a **Discounts**
- Tab **Dead Stock**: revisa si hay nuevos productos sin movimiento
- Tab **Overstock**: verifica los candidatos a descuento leve
- Marca como **reviewed** los que ya evaluaste
- Aplica descuentos en Shopify si corresponde

### 4. Revisar AI Insights (5 min, si está habilitado)

- Ve a **AI Insights**
- Lee el **headline** para un resumen rápido
- Revisa si hay **anomalías** detectadas (picos/caídas)
- Compara prioridades de IA vs heurística en Transfers
- Marca el run como reviewed

### 5. Actualizar estados (2 min)

- En **Transfers**, actualiza estados según avance:
  - `picked` → `shipped` (cuando salió de bodega)
  - `shipped` → `received` (cuando llegó a tienda)

## Rutina semanal

### 1. Ajustar thresholds (15 min)

- Ve a **Settings**
- Revisa si los KPIs del Dashboard indican necesidad de ajuste:
  - Demasiados stockout risks → aumentar safety days o target cover
  - Demasiado overstock → reducir target cover o bajar threshold
- Ajusta parámetros globales si es necesario
- Documenta los cambios y la razón

### 2. Revisar COGS faltantes (10 min)

- Ve a la página **COGS**
- Filtra por "Sin COGS" o busca variantes sin valor
- Prepara un CSV con los COGS faltantes
- Importa el CSV

### 3. Revisar anomalías (10 min)

- En **AI Insights**, revisa la sección de anomalías
- Investiga `SALES_SPIKE`: ¿fue una promoción o tendencia real?
- Investiga `SALES_DROP`: ¿problema de stock o baja demanda?
- Investiga `INVENTORY_DRIFT`: ¿error de conteo o sync?
- Revisa sugerencias de parámetros de la IA

### 4. Revisar warehouse reorder (5 min)

- En el **Dashboard**, sección Warehouse Reorder
- Identifica SKUs que necesitan compra a proveedor
- Genera órdenes de compra si corresponde

## Checklist de salud del sistema

Ejecuta esta verificación mensualmente o cuando algo no se vea bien:

| Check | Cómo verificar | Acción si falla |
|-------|----------------|-----------------|
| Sync funcionando | Dashboard muestra datos recientes (< 30 min) | Verificar que el proceso Next.js está corriendo |
| Analytics al día | Las recomendaciones se actualizaron en la última hora | Run Analytics manual desde Settings |
| COGS completos | Página COGS: % de SKUs con COGS asignado | Importar COGS faltantes por CSV |
| AI runs exitosos | AI Insights: último run = SUCCESS | Verificar API key y revisar error message |
| Overrides revisados | Settings: overrides tienen sentido actual | Eliminar overrides obsoletos |
| Alertas revisadas | Dashboard: no hay alertas no leídas antiguas | Leer y actuar sobre alertas pendientes |
| Locations correctos | Settings: mappeo de locations es correcto | Soft reset del wizard si cambió algo |
