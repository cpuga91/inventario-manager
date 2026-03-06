---
title: Reset del Wizard / Multi-tenant
description: Soft reset vs hard reset, qué se borra y cómo integrar una nueva tienda
section: Administración
order: 12
lastUpdated: "2026-03-06"
---

## Soft Reset vs Hard Reset

Desde **Settings → Setup Wizard** (solo ADMIN):

### Soft Reset

- **Qué hace**: marca el wizard como incompleto para que pueda re-ejecutarse
- **Qué conserva**: todos los datos (productos, ventas, inventario, recomendaciones, configuración)
- **Cuándo usarlo**:
  - Agregar/quitar locations en Shopify
  - Cambiar el token de acceso
  - Reconfigurar la clasificación de locations
  - Ejecutar un nuevo backfill

### Hard Reset

- **Qué hace**: elimina **todos** los datos del tenant
- **Qué borra**:
  - Productos y variantes
  - Niveles de inventario
  - Órdenes y ventas diarias
  - Recomendaciones (transfers, discounts)
  - COGS
  - Reglas de reposición (globales y overrides)
  - Alertas y notificaciones
  - Sync cursors
  - AI runs y configuración OpenAI
  - Audit logs
- **Qué conserva**: usuario y tenant (para re-login)
- **Cuándo usarlo**:
  - Cambiar completamente de tienda Shopify
  - Empezar de cero por problemas de datos
  - Testing/desarrollo

> **Advertencia**: El hard reset es irreversible. Se requiere confirmación con texto escrito.

## Qué se borra exactamente

| Tabla | Soft Reset | Hard Reset |
|-------|-----------|------------|
| `tenants` | wizard_step → 0 | Se conserva (solo se resetean flags) |
| `users` | Sin cambios | Sin cambios |
| `tenant_locations` | Sin cambios | **Eliminadas** |
| `products` | Sin cambios | **Eliminados** |
| `variants` | Sin cambios | **Eliminadas** |
| `variant_costs` | Sin cambios | **Eliminados** |
| `inventory_levels` | Sin cambios | **Eliminados** |
| `orders` | Sin cambios | **Eliminadas** |
| `order_lines` | Sin cambios | **Eliminadas** (cascade) |
| `daily_sales` | Sin cambios | **Eliminadas** |
| `replenishment_rules` | Sin cambios | **Eliminadas** |
| `recommendations` | Sin cambios | **Eliminadas** |
| `alerts` | Sin cambios | **Eliminadas** |
| `notifications` | Sin cambios | **Eliminadas** |
| `sync_cursors` | Sin cambios | **Eliminados** |
| `openai_settings` | Sin cambios | **Eliminada** |
| `ai_runs` | Sin cambios | **Eliminados** |
| `audit_logs` | Sin cambios | **Eliminados** |

## Cómo integrar una nueva tienda

El sistema es multi-tenant. Para agregar una nueva tienda:

1. Crear un nuevo registro en la tabla `tenants` con las credenciales de Shopify
2. Crear un usuario admin para ese tenant
3. Iniciar sesión con el nuevo usuario
4. Completar el wizard de 4 pasos

> **Nota**: En la versión actual, la creación de nuevos tenants se hace via seed o directamente en la base de datos. No hay UI de onboarding de tenants.

## Checklist antes de resetear

Antes de hacer un **hard reset**, verifica:

- [ ] ¿Exportaste la configuración actual? (Settings → Export Config)
- [ ] ¿Tienes backup de la base de datos?
- [ ] ¿Anotaste los overrides de SKU importantes?
- [ ] ¿Informaste al equipo que las recomendaciones se perderán?
- [ ] ¿Tienes las credenciales de Shopify a mano para re-configurar?

Antes de un **soft reset**, verifica:

- [ ] ¿Hay transfers en curso (picked/shipped)? Se conservarán pero revisa.
- [ ] ¿Cambió algo en Shopify que requiera remapeo de locations?
