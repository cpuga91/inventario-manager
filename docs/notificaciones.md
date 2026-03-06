---
title: Notificaciones
description: Bandeja de alertas, reglas de disparo, email y auditoría
section: Funcionalidades
order: 10
lastUpdated: "2026-03-06"
---

## Bandeja interna

Las alertas se muestran en el **Dashboard** en la sección "Alertas recientes" (últimas 10). Cada alerta tiene:

- **Tipo**: categoría del evento
- **Severidad**: `critical`, `warning`, `info`
- **Mensaje**: descripción del evento
- **Fecha**: cuándo se generó
- **Estado**: leída / no leída

## Reglas que disparan notificaciones

Las alertas se generan automáticamente al ejecutar el job de analytics (cada hora):

| Tipo | Severidad | Condición | Mensaje ejemplo |
|------|-----------|-----------|-----------------|
| `stockout_risk` | critical | SKU con riesgo de quiebre en los top 5 transfers | "SKU-001 en Tienda Centro: 3 días de cobertura, riesgo de quiebre" |
| `dead_stock` | warning | SKU dead stock con capital atado > $100 | "SKU-002: sin ventas en 200 días, $1,500 de capital atado" |
| `warehouse_reorder` | critical | Bodega con stock bajo para un SKU | "SKU-003: bodega necesita reabastecimiento, 2 días de cobertura" |

## Email (SMTP)

Si las variables SMTP están configuradas, se envían emails automáticos:

- **Destinatarios**: todos los usuarios con rol ADMIN del tenant
- **Trigger**: alertas de warehouse reorder (critical)
- **Contenido**: asunto y cuerpo con detalles del SKU y métricas

### Configuración requerida

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alerts@empresa.com
SMTP_PASS=app-password
SMTP_FROM=noreply@empresa.com
```

> Si las variables SMTP no están configuradas, las notificaciones solo aparecen in-app. No se pierde información.

## Logs y auditoría

Todas las acciones significativas se registran en la tabla `audit_logs`:

| Acción | Cuándo |
|--------|--------|
| Settings update | Al cambiar reglas globales |
| COGS import | Al importar CSV de costos |
| Wizard reset (soft/hard) | Al resetear el wizard |
| OpenAI settings change | Al modificar configuración de IA |
| AI run | Al ejecutar análisis de IA |

Cada registro incluye:
- ID del usuario que ejecutó la acción
- Timestamp
- Detalle en JSON (valores anteriores y nuevos)
