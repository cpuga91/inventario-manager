---
title: Troubleshooting
description: Guía de resolución de problemas comunes del sistema
section: Soporte
order: 14
lastUpdated: "2026-03-06"
---

## Shopify token inválido

**Síntoma**: "Connection failed" en el wizard o sync no funciona.

**Solución**:
1. Ve a Shopify Admin → Settings → Apps and sales channels → Develop apps
2. Verifica que la app custom está activa
3. Revisa los permisos del token:
   - `read_products` ✓
   - `read_inventory` ✓
   - `read_orders` ✓
   - `read_locations` ✓
4. Regenera el token si es necesario
5. Actualiza `SHOPIFY_ACCESS_TOKEN` en `.env`
6. Reinicia la aplicación

## Backfill lento o incompleto

**Síntoma**: El Step 4 del wizard tarda mucho o se detiene.

**Causas y soluciones**:
- **Tienda con muchos productos/órdenes**: Normal para tiendas grandes. El backfill procesa 50 registros por request.
  - Espera a que termine. Puede tomar 10-30 minutos para tiendas grandes.
- **Rate limit de Shopify**: El sistema respeta los límites automáticamente.
  - Si se detiene, espera unos minutos y vuelve a ejecutar.
- **Timeout del servidor**: En Replit u otros hosting con timeouts cortos.
  - Solución: ejecuta el backfill en un entorno sin timeout o aumenta el límite.

## Rate limit / throttling

**Síntoma**: Errores 429 en logs o sync incompleto.

**Qué hace el sistema**:
- Usa pagination con `first: 50` para controlar costo de queries
- Guarda cursors para retomar desde donde quedó

**Si persiste**:
1. Verifica que no hay otras apps consumiendo rate limit del mismo token
2. Reduce la frecuencia de sync (editar `cron.ts` si es necesario)
3. Verifica el status del rate limit en Shopify Admin → Apps

## Inventario no cuadra por location mapping

**Síntoma**: Las cantidades de inventario no coinciden con Shopify.

**Causas**:
1. **Location mal mapeada**: una tienda se marcó como warehouse o viceversa
   - Solución: soft reset del wizard y remapear locations
2. **Location nueva en Shopify** no mapeada en la app
   - Solución: soft reset del wizard para incluir la nueva location
3. **Sync desactualizada**: los datos se sincronizan cada 15 minutos
   - Solución: espera al próximo ciclo de sync o ejecuta manualmente

## COGS no aparece

**Síntoma**: Capital atado muestra "—" o COGS es null.

**Soluciones**:
1. **Verificar metafield en Shopify**:
   - ¿Existe el metafield definition `finance.cogs`?
   - ¿Tiene valor asignado para ese producto/variante?
2. **Importar por CSV**:
   - Prepara un CSV con columns `sku,cogs`
   - Importa desde la página COGS
3. **Esperar al refresh diario**: el COGS se sincroniza a las 3:00 AM
4. **Verificar SKU**: el matching es por SKU exacto (case sensitive)

## Cron jobs no corren en Replit

**Síntoma**: Sync y analytics no se ejecutan automáticamente.

**Causa**: Replit puede poner la instancia a dormir (sleep) después de inactividad.

**Soluciones**:
1. **Mantener la instancia activa**: configura un "Always On" en Replit (plan de pago)
2. **Usar un servicio externo de cron** (cron-job.org, UptimeRobot) que haga ping a la app
3. **Ejecutar manualmente**: usa Settings → Run Analytics cuando necesites datos frescos
4. **Verificar logs**: los cron jobs logean `[cron] Starting...` en la consola

## AI run failed

**Síntoma**: AI Insights muestra status FAILED.

**Causas y soluciones**:

| Error | Causa | Solución |
|-------|-------|----------|
| "No API key available" | API key no configurada | Agrega `OPENAI_API_KEY` o configura en Settings |
| "Invalid JSON response" | Modelo retornó formato inválido | Intenta con otro modelo (gpt-4o suele ser más consistente) |
| "Rate limit exceeded" | Demasiadas requests a OpenAI | Espera y reintenta. Reduce Max SKUs. |
| "Model not found" | Modelo no disponible | Verifica nombre del modelo en Settings |
| "Encryption key required" | Falta `APP_ENCRYPTION_KEY` | Agrega la env var o usa modo ENV_ONLY |
| "Request timeout" | Payload muy grande | Reduce Max SKUs en Settings |

**Debug paso a paso**:
1. Ve a AI Insights → detalle del último run
2. Lee el `errorMessage` completo
3. Prueba la conexión: Settings → OpenAI → Test Connection
4. Si el test funciona pero el run falla: probablemente es un problema de formato del modelo
5. Intenta ejecutar manualmente con menos SKUs

## Base de datos no conecta

**Síntoma**: Error al iniciar la app con "Can't reach database server".

**Soluciones**:
1. Verifica `DATABASE_URL` en `.env`
2. Confirma que PostgreSQL está corriendo
3. Verifica credenciales y puerto
4. Si usas un servicio cloud (Supabase, Neon): verifica que no está pausado
5. Ejecuta `npm run db:push` para sincronizar schema

## Datos desactualizados

**Síntoma**: Dashboard muestra datos que no reflejan la realidad.

**Causas**:
1. **Sync no está corriendo**: verifica que la app está activa
2. **Analytics no ha corrido**: las recomendaciones se recalculan cada hora
3. **Cambio reciente en Shopify**: espera 15 minutos para la próxima sync

**Solución rápida**:
- Settings → Run Analytics (fuerza recálculo inmediato)
