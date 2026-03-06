---
title: Admin y Seguridad
description: Roles de usuario, buenas prácticas de acceso y auditoría del sistema
section: Administración
order: 11
lastUpdated: "2026-03-06"
---

## Roles

El sistema tiene tres roles con permisos escalonados:

| Rol | Dashboard | Transfers | Discounts | COGS | AI Insights | Settings | Reset Wizard | OpenAI Config |
|-----|-----------|-----------|-----------|------|-------------|----------|-------------|---------------|
| **ADMIN** | Ver | Ver + Actualizar | Ver + Actualizar | Ver + Import | Ver + Run | Editar todo | Sí | Sí |
| **MANAGER** | Ver | Ver + Actualizar | Ver + Actualizar | Ver | Ver + Run | Ver | No | No |
| **STORE_VIEW** | Ver | Ver | Ver | Ver | Ver | Ver | No | No |

### Detalle de permisos

**ADMIN** (acceso completo):
- Modificar reglas globales y overrides
- Configurar OpenAI (API key, modelo, horario)
- Soft/hard reset del wizard
- Import/export de configuración
- Importar COGS por CSV
- Ejecutar analytics manualmente
- Todas las acciones de MANAGER y STORE_VIEW

**MANAGER** (operaciones):
- Ver todos los dashboards y recomendaciones
- Actualizar estados de transfers (picked/shipped/received)
- Marcar discounts como reviewed
- Ejecutar analytics manualmente
- Ejecutar AI analysis manualmente

**STORE_VIEW** (solo lectura):
- Ver dashboard, transfers, discounts, COGS, AI insights
- No puede modificar nada

## Autenticación

- **Método**: email + contraseña
- **Token**: JWT almacenado en cookie HTTP-only
- **Expiración**: 7 días
- **Seguridad**: flag `secure` activo en producción (HTTPS)

### Flujo de login
1. POST `/api/auth/login` con email + password
2. Se verifica contra hash bcrypt en base de datos
3. Se genera JWT con userId, tenantId, role
4. Se setea cookie HTTP-only
5. Redirect a dashboard (o wizard si no está completo)

## Buenas prácticas de acceso

1. **Usa contraseñas fuertes** para el admin inicial (`ADMIN_PASSWORD` en .env)
2. **Cambia el JWT_SECRET** en producción — debe ser un string aleatorio de al menos 32 caracteres
3. **Limita usuarios ADMIN**: solo quienes necesiten configurar el sistema
4. **Asigna STORE_VIEW** al personal de tienda que solo necesita consultar
5. **Revisa audit logs** periódicamente para detectar cambios no autorizados
6. **No compartas tokens** de Shopify — usa variables de entorno

## Auditoría

La tabla `audit_logs` registra:

| Campo | Descripción |
|-------|-------------|
| `actor_user_id` | Quién realizó la acción |
| `action` | Tipo de acción (ej: `settings_update`, `cogs_import`, `wizard_reset`) |
| `details_json` | Detalles específicos en formato JSON |
| `created_at` | Cuándo ocurrió |

### Acciones auditadas

- Cambios de settings (reglas globales y overrides)
- Importación de COGS
- Reset de wizard (soft y hard)
- Cambios de configuración OpenAI
- Ejecución de AI analysis
