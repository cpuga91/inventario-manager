---
title: Introducción
description: Qué problema resuelve Adagio Replenishment y conceptos clave del sistema
section: Inicio
order: 1
lastUpdated: "2026-03-06"
---

## Qué problema resuelve

Adagio Replenishment es una plataforma de gestión de inventario para tiendas Shopify con múltiples ubicaciones (bodega, tiendas físicas, canal online). Resuelve tres problemas críticos:

- **Quiebres de stock**: detecta cuándo una tienda está por quedarse sin inventario y recomienda transferencias desde la bodega.
- **Sobrestock y stock muerto**: identifica productos que no se venden y sugiere descuentos escalonados para liberar capital.
- **Decisiones manuales lentas**: automatiza el cálculo de reposición que normalmente se hace en planillas Excel.

## Cómo está pensada la app

La app combina dos enfoques:

1. **Motor determinístico (heurísticas)**: calcula métricas como días de cobertura, riesgo de quiebre, sobrestock y stock muerto usando fórmulas matemáticas configurables. Siempre disponible, no requiere IA.

2. **Copiloto de IA (opcional)**: usa OpenAI para analizar patrones, priorizar transferencias con mayor precisión y detectar anomalías. Se activa opcionalmente desde Settings.

## Conceptos clave

| Concepto | Descripción |
|----------|-------------|
| **Warehouse** | Bodega central. Fuente de inventario para transferencias. Solo se puede tener una. |
| **Store** | Tienda física o punto de venta. Destino de transferencias. |
| **Online** | Canal de venta online (Shopify). Puede ser una location real o virtual. |
| **Cover Days** | Días de cobertura = unidades en mano ÷ venta promedio diaria. Indica cuántos días durará el stock actual. |
| **Transfer Plan** | Plan de reposición: lista de SKUs a mover desde bodega a tiendas, con cantidades calculadas. |
| **Dead Stock** | Productos con stock > 0 que no se han vendido en N días (default: 180). Candidatos a descuento profundo. |
| **Overstock** | Productos con más días de cobertura que el umbral configurado (default: 90 días). |
| **COGS** | Costo del producto (Cost of Goods Sold). Se usa para calcular capital atado. |
| **Safety Days** | Días de inventario de seguridad para absorber variabilidad de demanda. |
| **Lead Time** | Días que toma recibir una transferencia desde bodega. |
| **Review Cycle** | Frecuencia (en días) con la que se revisan las recomendaciones de transferencia. |

## Arquitectura general

```
┌─────────────────────────────────────────────────────┐
│                    Shopify Admin API                  │
│         (productos, inventario, órdenes, COGS)        │
└─────────────────────┬───────────────────────────────┘
                      │ sync cada 15 min
┌─────────────────────▼───────────────────────────────┐
│                  Base de datos (PostgreSQL)           │
│   variants · inventory_levels · daily_sales · orders  │
└─────────────────────┬───────────────────────────────┘
                      │ analytics cada hora
┌─────────────────────▼───────────────────────────────┐
│              Motor de Recomendaciones                 │
│   transfers · discounts · reorder flags · alerts      │
└─────────────────────┬───────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────┐
│              App Web (Next.js)                        │
│   Dashboard · Transfers · Discounts · AI Insights     │
└─────────────────────────────────────────────────────┘
```

## Roles de usuario

| Rol | Acceso |
|-----|--------|
| **ADMIN** | Acceso completo: settings, reset wizard, configuración OpenAI, gestión de usuarios |
| **MANAGER** | Ve todo, puede actualizar estados de transfers/discounts y ejecutar analytics |
| **STORE_VIEW** | Solo lectura: dashboards y recomendaciones |
