---
title: Getting Started (Setup Wizard)
description: Requisitos, variables de entorno y paso a paso del asistente de configuración inicial
section: Configuración
order: 2
lastUpdated: "2026-03-06"
---

## Requisitos previos

Antes de iniciar el wizard necesitas:

- **Shopify Admin API token** con permisos de lectura de productos, inventario, órdenes y metafields.
- **Listado de locations** en tu tienda Shopify (bodega, tiendas, online).
- **PostgreSQL** accesible (local o servicio cloud como Supabase/Neon).
- **Node.js 18+** para correr la aplicación.

## Variables de entorno

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

### Obligatorias

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | Conexión a PostgreSQL | `postgresql://user:pass@host:5432/adagio` |
| `SHOPIFY_SHOP` | Dominio de tu tienda Shopify | `mi-tienda.myshopify.com` |
| `SHOPIFY_ACCESS_TOKEN` | Token de Admin API | `shpat_xxxxxxxxxxxx` |
| `JWT_SECRET` | Secreto para tokens de sesión (min 32 chars) | `un-string-largo-aleatorio-seguro` |
| `ADMIN_EMAIL` | Email del primer usuario admin | `admin@empresa.com` |
| `ADMIN_PASSWORD` | Contraseña del primer admin | `contraseña-segura` |

### Opcionales — Email (SMTP)

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `SMTP_HOST` | Servidor SMTP | `smtp.gmail.com` |
| `SMTP_PORT` | Puerto | `587` |
| `SMTP_USER` | Usuario SMTP | `alerts@empresa.com` |
| `SMTP_PASS` | Contraseña SMTP | `app-password` |
| `SMTP_FROM` | Remitente | `noreply@empresa.com` |

### Opcionales — OpenAI

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `OPENAI_API_KEY` | API Key de OpenAI | `sk-...` |
| `OPENAI_MODEL` | Modelo a usar | `gpt-4o-mini` |
| `APP_ENCRYPTION_KEY` | Clave AES para guardar API key en DB | `32-chars-random` |

### Opcionales — App

| Variable | Descripción | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_APP_NAME` | Nombre mostrado en la app | `Adagio Replenishment` |
| `NODE_ENV` | Entorno | `development` |

## Instalación

```bash
# 1. Clonar e instalar dependencias
npm install

# 2. Generar cliente Prisma
npm run db:generate

# 3. Sincronizar schema con la base de datos
npm run db:push

# 4. Crear usuario admin inicial
npm run db:seed

# 5. Iniciar en desarrollo
npm run dev
```

## Paso a paso del Wizard

Al iniciar sesión por primera vez, el sistema redirige automáticamente al Setup Wizard de 4 pasos.

### Step 1: Conectar Shopify

- Ingresa tu dominio Shopify (`mi-tienda.myshopify.com`)
- Ingresa tu Access Token de Admin API
- Click en **Test Connection**
- El sistema valida la conexión y muestra el nombre de tu tienda
- Si es exitoso, avanza al siguiente paso

> **Tip**: El token debe tener permisos de `read_products`, `read_inventory`, `read_orders`, `read_locations`.

### Step 2: Mapear Locations

El sistema lista todas las locations activas de tu tienda Shopify. Debes clasificar cada una:

- **Warehouse** (bodega): exactamente 1. Es la fuente de transferencias.
- **Store** (tienda): 0 o más. Son los destinos de reposición.
- **Online**: canal de venta online. Puede mapearse a una location real o crearse como virtual.

> **Importante**: Si no tienes location de bodega en Shopify, puedes crearla primero en Shopify Admin > Settings > Locations.

### Step 3: Configurar Reglas de Reposición

Define los parámetros globales que gobiernan las recomendaciones:

| Parámetro | Default | Descripción |
|-----------|---------|-------------|
| Lead Time Days | 3 | Días que toma una transferencia bodega → tienda |
| Safety Days | 2 | Buffer de seguridad adicional |
| Review Cycle Days | 7 | Cada cuántos días se revisan recomendaciones |
| Overstock Threshold | 90 | Días de cobertura para considerar sobrestock |
| Dead Stock Days | 180 | Días sin venta para considerar stock muerto |
| Warehouse Buffer Qty | 5 | Unidades mínimas a mantener en bodega |
| Target Cover Days | 30 | Objetivo de días de cobertura por tienda |

> Estos valores se pueden ajustar después en **Settings**.

### Step 4: Backfill de Datos

- El sistema sincroniza 12 meses de historial desde Shopify
- Importa: productos, variantes, inventario, órdenes, COGS (metafield)
- Muestra un resumen con conteos de datos importados
- Ejecuta el primer cálculo de analytics automáticamente

> **Nota**: El backfill puede tomar varios minutos dependiendo del volumen de datos. Se muestra progreso en pantalla.

## Troubleshooting del Wizard

| Problema | Causa probable | Solución |
|----------|---------------|----------|
| "Connection failed" en Step 1 | Token inválido o dominio incorrecto | Verifica el token en Shopify Admin > Apps > Custom Apps |
| No aparecen locations en Step 2 | Token sin permiso `read_locations` | Regenera el token con los permisos correctos |
| Backfill muy lento | Tienda con muchos productos/órdenes | Es normal. Espera a que termine. La barra de progreso indica el avance. |
| Error de base de datos | `DATABASE_URL` incorrecta | Verifica la cadena de conexión y que PostgreSQL esté accesible |
| "Wizard already complete" | Ya se completó el wizard | Ve a Settings > Setup Wizard para hacer un soft reset si necesitas reconfigurar |
