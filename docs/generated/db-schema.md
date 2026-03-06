# Database Schema Reference

> Auto-generated from `prisma/schema.prisma`

## Enums

### UserRole

Values: `ADMIN`, `MANAGER`, `STORE_VIEW`

### RecommendationType

Values: `TRANSFER`, `DISCOUNT`, `REORDER_EXTERNAL_FLAG`

### KeyStorageMode

Values: `ENV_ONLY`, `DB_ENCRYPTED`

### AiRunStatus

Values: `SUCCESS`, `FAILED`

## Models

### Tenant

| Field | Type | Attributes |
|-------|------|------------|
| id | `String` | id default(cuid()) |
| name | `String` | — |
| shopDomain | `String` | unique map("shop_domain") |
| accessToken | `String` | map("access_token") |
| wizardStep | `Int` | default(0) map("wizard_step") |
| wizardComplete | `Boolean` | default(false) map("wizard_complete") |
| configJson | `String?` | map("config_json") db.Text |
| createdAt | `DateTime` | default(now()) map("created_at") |
| updatedAt | `DateTime` | updatedAt map("updated_at") |
| users | `User[]` | — |
| locations | `TenantLocation[]` | — |
| products | `Product[]` | — |
| variants | `Variant[]` | — |
| variantCosts | `VariantCost[]` | — |
| inventoryLevels | `InventoryLevel[]` | — |
| orders | `Order[]` | — |
| dailySales | `DailySale[]` | — |
| replenishmentRules | `ReplenishmentRule[]` | — |
| recommendations | `Recommendation[]` | — |
| alerts | `Alert[]` | — |
| notifications | `Notification[]` | — |
| syncCursors | `SyncCursor[]` | — |
| aiRuns | `AiRun[]` | — |
| openAiSettings | `OpenAiSettings?` | — |
| auditLogs | `AuditLog[]` | — |

### User

| Field | Type | Attributes |
|-------|------|------------|
| id | `String` | id default(cuid()) |
| tenantId | `String` | map("tenant_id") |
| email | `String` | — |
| password | `String` | — |
| name | `String?` | — |
| role | `UserRole` | default(STORE_VIEW) |
| createdAt | `DateTime` | default(now()) map("created_at") |
| tenant | `Tenant` | relation(fields: [tenantId], references: [id], onDelete: Cascade) |
| auditLogs | `AuditLog[]` | — |

### TenantLocation

| Field | Type | Attributes |
|-------|------|------------|
| id | `String` | id default(cuid()) |
| tenantId | `String` | map("tenant_id") |
| shopifyLocationId | `String?` | map("shopify_location_id") |
| name | `String` | — |
| isWarehouse | `Boolean` | default(false) map("is_warehouse") |
| isStore | `Boolean` | default(false) map("is_store") |
| isOnline | `Boolean` | default(false) map("is_online") |
| isVirtual | `Boolean` | default(false) map("is_virtual") |
| createdAt | `DateTime` | default(now()) map("created_at") |
| tenant | `Tenant` | relation(fields: [tenantId], references: [id], onDelete: Cascade) |
| inventoryLevels | `InventoryLevel[]` | — |
| dailySales | `DailySale[]` | — |
| recommendations | `Recommendation[]` | — |

### Product

| Field | Type | Attributes |
|-------|------|------------|
| id | `String` | id default(cuid()) |
| tenantId | `String` | map("tenant_id") |
| shopifyProductId | `String` | map("shopify_product_id") |
| title | `String` | — |
| vendor | `String?` | — |
| tags | `String?` | db.Text |
| createdAt | `DateTime` | default(now()) map("created_at") |
| updatedAt | `DateTime` | updatedAt map("updated_at") |
| tenant | `Tenant` | relation(fields: [tenantId], references: [id], onDelete: Cascade) |
| variants | `Variant[]` | — |

### Variant

| Field | Type | Attributes |
|-------|------|------------|
| id | `String` | id default(cuid()) |
| tenantId | `String` | map("tenant_id") |
| shopifyVariantId | `String` | map("shopify_variant_id") |
| shopifyProductId | `String` | map("shopify_product_id") |
| shopifyInventoryItemId | `String?` | map("shopify_inventory_item_id") |
| sku | `String?` | — |
| title | `String` | — |
| price | `Float` | default(0) |
| createdAt | `DateTime` | default(now()) map("created_at") |
| updatedAt | `DateTime` | updatedAt map("updated_at") |
| tenant | `Tenant` | relation(fields: [tenantId], references: [id], onDelete: Cascade) |
| product | `Product` | relation(fields: [tenantId, shopifyProductId], references: [tenantId, shopifyProductId]) |
| costs | `VariantCost[]` | — |
| inventoryLevels | `InventoryLevel[]` | — |
| orderLines | `OrderLine[]` | — |
| dailySales | `DailySale[]` | — |
| recommendations | `Recommendation[]` | — |

### VariantCost

| Field | Type | Attributes |
|-------|------|------------|
| id | `String` | id default(cuid()) |
| tenantId | `String` | map("tenant_id") |
| variantId | `String` | map("variant_id") |
| sku | `String?` | — |
| cogsValue | `Float?` | map("cogs_value") |
| source | `String` | default("metafield") |
| updatedAt | `DateTime` | updatedAt map("updated_at") |
| tenant | `Tenant` | relation(fields: [tenantId], references: [id], onDelete: Cascade) |
| variant | `Variant` | relation(fields: [variantId], references: [id], onDelete: Cascade) |

### InventoryLevel

| Field | Type | Attributes |
|-------|------|------------|
| id | `String` | id default(cuid()) |
| tenantId | `String` | map("tenant_id") |
| variantId | `String` | map("variant_id") |
| tenantLocationId | `String` | map("tenant_location_id") |
| onHand | `Int` | default(0) map("on_hand") |
| updatedAt | `DateTime` | updatedAt map("updated_at") |
| tenant | `Tenant` | relation(fields: [tenantId], references: [id], onDelete: Cascade) |
| variant | `Variant` | relation(fields: [variantId], references: [id], onDelete: Cascade) |
| location | `TenantLocation` | relation(fields: [tenantLocationId], references: [id], onDelete: Cascade) |

### Order

| Field | Type | Attributes |
|-------|------|------------|
| id | `String` | id default(cuid()) |
| tenantId | `String` | map("tenant_id") |
| shopifyOrderId | `String` | map("shopify_order_id") |
| orderName | `String?` | map("order_name") |
| createdAt | `DateTime` | map("created_at") |
| totalPrice | `Float` | default(0) map("total_price") |
| channel | `String?` | — |
| shopifyLocationId | `String?` | map("shopify_location_id") |
| tenant | `Tenant` | relation(fields: [tenantId], references: [id], onDelete: Cascade) |
| lines | `OrderLine[]` | — |

### OrderLine

| Field | Type | Attributes |
|-------|------|------------|
| id | `String` | id default(cuid()) |
| orderId | `String` | map("order_id") |
| variantId | `String?` | map("variant_id") |
| sku | `String?` | — |
| quantity | `Int` | default(0) |
| unitPrice | `Float` | default(0) map("unit_price") |
| totalDiscount | `Float` | default(0) map("total_discount") |
| order | `Order` | relation(fields: [orderId], references: [id], onDelete: Cascade) |
| variant | `Variant?` | relation(fields: [variantId], references: [id], onDelete: SetNull) |

### DailySale

| Field | Type | Attributes |
|-------|------|------------|
| id | `String` | id default(cuid()) |
| tenantId | `String` | map("tenant_id") |
| date | `DateTime` | db.Date |
| variantId | `String` | map("variant_id") |
| tenantLocationId | `String` | map("tenant_location_id") |
| qty | `Int` | default(0) |
| grossSales | `Float` | default(0) map("gross_sales") |
| netSales | `Float` | default(0) map("net_sales") |
| tenant | `Tenant` | relation(fields: [tenantId], references: [id], onDelete: Cascade) |
| variant | `Variant` | relation(fields: [variantId], references: [id], onDelete: Cascade) |
| location | `TenantLocation` | relation(fields: [tenantLocationId], references: [id], onDelete: Cascade) |

### ReplenishmentRule

| Field | Type | Attributes |
|-------|------|------------|
| id | `String` | id default(cuid()) |
| tenantId | `String` | map("tenant_id") |
| variantId | `String?` | map("variant_id") |
| tenantLocationId | `String?` | map("tenant_location_id") |
| isGlobal | `Boolean` | default(true) map("is_global") |
| leadTimeDays | `Int` | default(3) map("lead_time_days") |
| safetyDays | `Int` | default(2) map("safety_days") |
| reviewCycleDays | `Int` | default(7) map("review_cycle_days") |
| overstockThresholdDays | `Int` | default(90) map("overstock_threshold_days") |
| deadStockDays | `Int` | default(180) map("dead_stock_days") |
| slowMoverThresholdQty | `Float` | default(0.1) map("slow_mover_threshold_qty") |
| warehouseBufferQty | `Int` | default(5) map("warehouse_buffer_qty") |
| targetCoverDays | `Int` | default(30) map("target_cover_days") |
| minQty | `Int?` | map("min_qty") |
| maxQty | `Int?` | map("max_qty") |
| excludeDiscount | `Boolean` | default(false) map("exclude_discount") |
| excludeTransfer | `Boolean` | default(false) map("exclude_transfer") |
| createdAt | `DateTime` | default(now()) map("created_at") |
| updatedAt | `DateTime` | updatedAt map("updated_at") |
| tenant | `Tenant` | relation(fields: [tenantId], references: [id], onDelete: Cascade) |

### Recommendation

| Field | Type | Attributes |
|-------|------|------------|
| id | `String` | id default(cuid()) |
| tenantId | `String` | map("tenant_id") |
| type | `RecommendationType` | — |
| variantId | `String` | map("variant_id") |
| tenantLocationId | `String?` | map("tenant_location_id") |
| payload | `String` | db.Text |
| priority | `Float` | default(0) |
| status | `String` | default("pending") |
| reviewedAt | `DateTime?` | map("reviewed_at") |
| createdAt | `DateTime` | default(now()) map("created_at") |
| tenant | `Tenant` | relation(fields: [tenantId], references: [id], onDelete: Cascade) |
| variant | `Variant` | relation(fields: [variantId], references: [id], onDelete: Cascade) |
| location | `TenantLocation?` | relation(fields: [tenantLocationId], references: [id], onDelete: SetNull) |

### Alert

| Field | Type | Attributes |
|-------|------|------------|
| id | `String` | id default(cuid()) |
| tenantId | `String` | map("tenant_id") |
| type | `String` | — |
| message | `String` | db.Text |
| severity | `String` | default("info") |
| read | `Boolean` | default(false) |
| createdAt | `DateTime` | default(now()) map("created_at") |
| tenant | `Tenant` | relation(fields: [tenantId], references: [id], onDelete: Cascade) |

### Notification

| Field | Type | Attributes |
|-------|------|------------|
| id | `String` | id default(cuid()) |
| tenantId | `String` | map("tenant_id") |
| channel | `String` | default("in_app") |
| subject | `String` | — |
| body | `String` | db.Text |
| sentAt | `DateTime?` | map("sent_at") |
| createdAt | `DateTime` | default(now()) map("created_at") |
| tenant | `Tenant` | relation(fields: [tenantId], references: [id], onDelete: Cascade) |

### SyncCursor

| Field | Type | Attributes |
|-------|------|------------|
| id | `String` | id default(cuid()) |
| tenantId | `String` | map("tenant_id") |
| cursorType | `String` | map("cursor_type") |
| cursorValue | `String` | map("cursor_value") |
| updatedAt | `DateTime` | updatedAt map("updated_at") |
| tenant | `Tenant` | relation(fields: [tenantId], references: [id], onDelete: Cascade) |

### OpenAiSettings

| Field | Type | Attributes |
|-------|------|------------|
| id | `String` | id default(cuid()) |
| tenantId | `String` | unique map("tenant_id") |
| isEnabled | `Boolean` | default(false) map("is_enabled") |
| model | `String?` | — |
| dailyHourLocal | `Int` | default(7) map("daily_hour_local") |
| timezone | `String` | default("America/Santiago") |
| maxSkus | `Int` | default(150) map("max_skus") |
| promptVersion | `String` | default("v1.0") map("prompt_version") |
| keyStorageMode | `KeyStorageMode` | default(ENV_ONLY) map("key_storage_mode") |
| encryptedApiKey | `String?` | map("encrypted_api_key") db.Text |
| apiKeyLast4 | `String?` | map("api_key_last4") |
| createdAt | `DateTime` | default(now()) map("created_at") |
| updatedAt | `DateTime` | updatedAt map("updated_at") |
| tenant | `Tenant` | relation(fields: [tenantId], references: [id], onDelete: Cascade) |

### AuditLog

| Field | Type | Attributes |
|-------|------|------------|
| id | `String` | id default(cuid()) |
| tenantId | `String` | map("tenant_id") |
| actorUserId | `String` | map("actor_user_id") |
| action | `String` | — |
| detailsJson | `String?` | map("details_json") db.Text |
| createdAt | `DateTime` | default(now()) map("created_at") |
| tenant | `Tenant` | relation(fields: [tenantId], references: [id], onDelete: Cascade) |
| actor | `User` | relation(fields: [actorUserId], references: [id], onDelete: Cascade) |

### AiRun

| Field | Type | Attributes |
|-------|------|------------|
| id | `String` | id default(cuid()) |
| tenantId | `String` | map("tenant_id") |
| runDate | `DateTime` | db.Date map("run_date") |
| status | `AiRunStatus` | — |
| model | `String` | — |
| promptVersion | `String` | map("prompt_version") |
| inputSummaryJson | `String` | map("input_summary_json") db.Text |
| outputJson | `String?` | map("output_json") db.Text |
| outputText | `String?` | map("output_text") db.Text |
| tokensIn | `Int?` | map("tokens_in") |
| tokensOut | `Int?` | map("tokens_out") |
| errorMessage | `String?` | map("error_message") db.Text |
| reviewed | `Boolean` | default(false) |
| createdAt | `DateTime` | default(now()) map("created_at") |
| tenant | `Tenant` | relation(fields: [tenantId], references: [id], onDelete: Cascade) |

