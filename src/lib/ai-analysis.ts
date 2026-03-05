/**
 * OpenAI daily analysis module.
 * Augments deterministic heuristics with AI-powered prioritization,
 * anomaly detection, and parameter suggestions.
 *
 * Hard constraints:
 * - No PII sent to OpenAI (only SKUs, variant IDs, location labels, aggregated metrics)
 * - Output validated against JSON schema before storing
 * - AI does NOT perform actions; human approval only
 */
import { prisma } from "./prisma";
import { AiRunStatus, RecommendationType } from "@prisma/client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PROMPT_VERSION = "v1.0";

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_MAX_SKUS = 150;

const SYSTEM_PROMPT = `You are an inventory replenishment analyst for a retail business.
You will receive a JSON payload with aggregated inventory and sales metrics.
Return ONLY valid JSON matching the schema below. No markdown. No commentary outside JSON.
Use only the provided payload; do not assume additional facts.
If uncertain, lower confidence and keep quantities conservative.

Output JSON schema:
{
  "date": "YYYY-MM-DD",
  "tenant": { "id": "string", "name": "string" },
  "summary": {
    "headline": "string (1-2 sentence overview)",
    "top_risk_locations": [{"location": "string", "reason": "string"}],
    "notes": ["string"]
  },
  "prioritized_transfers": [
    {
      "sku": "string",
      "variant_id": "string",
      "from_location": "WAREHOUSE",
      "to_location": "string",
      "qty": number,
      "priority": number (1-100),
      "confidence": number (0-1),
      "rationale": "string",
      "evidence": {
        "dest_on_hand": number,
        "warehouse_on_hand": number,
        "avg_daily_sales_30": number,
        "days_of_cover": number,
        "lead_time_days": number,
        "safety_days": number
      }
    }
  ],
  "discount_actions": [
    {
      "sku": "string",
      "variant_id": "string",
      "location": "string",
      "discount_pct": number (10, 20, or 30),
      "confidence": number (0-1),
      "rationale": "string",
      "evidence": {
        "days_without_sale": number,
        "days_of_cover": number,
        "on_hand": number,
        "cogs": number or null,
        "capital_tied": number or null
      }
    }
  ],
  "anomalies": [
    {
      "sku": "string",
      "variant_id": "string",
      "location": "string",
      "type": "SALES_SPIKE|SALES_DROP|INVENTORY_DRIFT|DATA_QUALITY",
      "confidence": number (0-1),
      "description": "string",
      "evidence": { "metric": "string", "value": number, "baseline": number }
    }
  ],
  "parameter_suggestions": [
    {
      "param": "lead_time_days|safety_days|overstock_threshold_days|dead_stock_days|review_cycle_days",
      "suggested_value": number,
      "confidence": number (0-1),
      "reason": "string"
    }
  ]
}`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AiPayloadSku {
  sku: string | null;
  variant_id: string;
  dest_location: string;
  warehouse_on_hand: number;
  dest_on_hand: number;
  avg_daily_sales_7: number;
  avg_daily_sales_14: number;
  avg_daily_sales_30: number;
  days_of_cover: number;
  days_without_sale: number | null;
  heuristic_transfer_qty: number;
  heuristic_priority: number;
  cogs: number | null;
  capital_tied: number | null;
}

export interface AiPayload {
  date: string;
  tenant: { id: string; name: string };
  config: {
    lead_time_days: number;
    safety_days: number;
    review_cycle_days: number;
    overstock_threshold_days: number;
    dead_stock_days: number;
  };
  locations: Array<{ name: string; type: string }>;
  top_risk_skus: AiPayloadSku[];
  summary_stats: {
    total_skus: number;
    stockout_risk_count: number;
    overstock_count: number;
    dead_stock_count: number;
  };
}

export interface AiTransfer {
  sku: string;
  variant_id: string;
  from_location: string;
  to_location: string;
  qty: number;
  priority: number;
  confidence: number;
  rationale: string;
  evidence: {
    dest_on_hand: number;
    warehouse_on_hand: number;
    avg_daily_sales_30: number;
    days_of_cover: number;
    lead_time_days: number;
    safety_days: number;
  };
}

export interface AiDiscountAction {
  sku: string;
  variant_id: string;
  location: string;
  discount_pct: number;
  confidence: number;
  rationale: string;
  evidence: {
    days_without_sale: number;
    days_of_cover: number;
    on_hand: number;
    cogs: number | null;
    capital_tied: number | null;
  };
}

export interface AiAnomaly {
  sku: string;
  variant_id: string;
  location: string;
  type: "SALES_SPIKE" | "SALES_DROP" | "INVENTORY_DRIFT" | "DATA_QUALITY";
  confidence: number;
  description: string;
  evidence: { metric: string; value: number; baseline: number };
}

export interface AiParamSuggestion {
  param: string;
  suggested_value: number;
  confidence: number;
  reason: string;
}

export interface AiOutput {
  date: string;
  tenant: { id: string; name: string };
  summary: {
    headline: string;
    top_risk_locations: Array<{ location: string; reason: string }>;
    notes: string[];
  };
  prioritized_transfers: AiTransfer[];
  discount_actions: AiDiscountAction[];
  anomalies: AiAnomaly[];
  parameter_suggestions: AiParamSuggestion[];
}

// ---------------------------------------------------------------------------
// Allowed fields whitelist (no PII)
// ---------------------------------------------------------------------------

const ALLOWED_SKU_FIELDS = new Set([
  "sku", "variant_id", "dest_location", "warehouse_on_hand", "dest_on_hand",
  "avg_daily_sales_7", "avg_daily_sales_14", "avg_daily_sales_30",
  "days_of_cover", "days_without_sale", "heuristic_transfer_qty",
  "heuristic_priority", "cogs", "capital_tied",
]);

/**
 * Sanitize a SKU payload to only contain allowed fields.
 */
export function sanitizeSkuPayload(sku: Record<string, unknown>): AiPayloadSku {
  const sanitized: Record<string, unknown> = {};
  for (const key of ALLOWED_SKU_FIELDS) {
    if (key in sku) {
      sanitized[key] = sku[key];
    }
  }
  return sanitized as unknown as AiPayloadSku;
}

// ---------------------------------------------------------------------------
// Payload builder
// ---------------------------------------------------------------------------

export async function buildAiPayload(tenantId: string): Promise<AiPayload> {
  const maxSkus = parseInt(process.env.OPENAI_MAX_SKUS || "") || DEFAULT_MAX_SKUS;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error("Tenant not found");

  // Load rules
  const globalRule = await prisma.replenishmentRule.findFirst({
    where: { tenantId, isGlobal: true },
  });

  const config = {
    lead_time_days: globalRule?.leadTimeDays ?? 3,
    safety_days: globalRule?.safetyDays ?? 2,
    review_cycle_days: globalRule?.reviewCycleDays ?? 7,
    overstock_threshold_days: globalRule?.overstockThresholdDays ?? 90,
    dead_stock_days: globalRule?.deadStockDays ?? 180,
  };

  // Load locations
  const locations = await prisma.tenantLocation.findMany({ where: { tenantId } });
  const warehouseLoc = locations.find((l) => l.isWarehouse);

  // Load transfer recommendations (top risk SKUs) sorted by priority desc
  const transferRecs = await prisma.recommendation.findMany({
    where: { tenantId, type: RecommendationType.TRANSFER },
    orderBy: { priority: "desc" },
    take: maxSkus,
    include: { variant: { include: { costs: { where: { tenantId } } } } },
  });

  // Load discount recommendations for stats
  const discountCount = await prisma.recommendation.count({
    where: { tenantId, type: RecommendationType.DISCOUNT },
  });

  // Build SKU entries
  const topRiskSkus: AiPayloadSku[] = transferRecs.map((rec) => {
    const payload = JSON.parse(rec.payload);
    return sanitizeSkuPayload({
      sku: rec.variant.sku,
      variant_id: rec.variantId,
      dest_location: payload.destinationName || "",
      warehouse_on_hand: payload.warehouseOnHand || 0,
      dest_on_hand: payload.destOnHand || 0,
      avg_daily_sales_7: payload.avgDailySales7 || 0,
      avg_daily_sales_14: payload.avgDailySales14 || 0,
      avg_daily_sales_30: payload.avgDailySales30 || 0,
      days_of_cover: payload.daysOfCover || 0,
      days_without_sale: payload.daysSinceLastSale ?? null,
      heuristic_transfer_qty: payload.transferQty || 0,
      heuristic_priority: rec.priority,
      cogs: rec.variant.costs[0]?.cogsValue ?? null,
      capital_tied: payload.capitalTied ?? null,
    });
  });

  // Count stockout risks from transfer payloads
  const stockoutCount = transferRecs.filter((r) => {
    const p = JSON.parse(r.payload);
    return p.stockoutRisk === true;
  }).length;

  // Dead stock count
  const deadStockCount = await prisma.recommendation.count({
    where: {
      tenantId,
      type: RecommendationType.DISCOUNT,
      payload: { contains: "Dead stock" },
    },
  });

  return {
    date: new Date().toISOString().split("T")[0],
    tenant: { id: tenantId, name: tenant.name },
    config,
    locations: locations.map((l) => ({
      name: l.name,
      type: l.isWarehouse ? "warehouse" : l.isStore ? "store" : l.isOnline ? "online" : "other",
    })),
    top_risk_skus: topRiskSkus,
    summary_stats: {
      total_skus: await prisma.variant.count({ where: { tenantId } }),
      stockout_risk_count: stockoutCount,
      overstock_count: discountCount,
      dead_stock_count: deadStockCount,
    },
  };
}

// ---------------------------------------------------------------------------
// JSON schema validation
// ---------------------------------------------------------------------------

export function validateAiOutput(raw: unknown): { valid: boolean; errors: string[]; data: AiOutput | null } {
  const errors: string[] = [];

  if (typeof raw !== "object" || raw === null) {
    return { valid: false, errors: ["Output is not an object"], data: null };
  }

  const obj = raw as Record<string, unknown>;

  // Required top-level fields
  if (typeof obj.date !== "string") errors.push("Missing or invalid 'date'");
  if (typeof obj.tenant !== "object" || obj.tenant === null) errors.push("Missing 'tenant'");
  if (typeof obj.summary !== "object" || obj.summary === null) errors.push("Missing 'summary'");

  const summary = obj.summary as Record<string, unknown> | undefined;
  if (summary) {
    if (typeof summary.headline !== "string") errors.push("Missing 'summary.headline'");
    if (!Array.isArray(summary.top_risk_locations)) errors.push("Missing 'summary.top_risk_locations' array");
    if (!Array.isArray(summary.notes)) errors.push("Missing 'summary.notes' array");
  }

  // Validate arrays exist
  if (!Array.isArray(obj.prioritized_transfers)) errors.push("Missing 'prioritized_transfers' array");
  if (!Array.isArray(obj.discount_actions)) errors.push("Missing 'discount_actions' array");
  if (!Array.isArray(obj.anomalies)) errors.push("Missing 'anomalies' array");
  if (!Array.isArray(obj.parameter_suggestions)) errors.push("Missing 'parameter_suggestions' array");

  // Validate transfer items
  if (Array.isArray(obj.prioritized_transfers)) {
    for (let i = 0; i < obj.prioritized_transfers.length; i++) {
      const t = obj.prioritized_transfers[i] as Record<string, unknown>;
      if (typeof t.sku !== "string") errors.push(`prioritized_transfers[${i}]: missing 'sku'`);
      if (typeof t.variant_id !== "string") errors.push(`prioritized_transfers[${i}]: missing 'variant_id'`);
      if (typeof t.qty !== "number") errors.push(`prioritized_transfers[${i}]: missing 'qty'`);
      if (typeof t.priority !== "number") errors.push(`prioritized_transfers[${i}]: missing 'priority'`);
      if (typeof t.confidence !== "number") errors.push(`prioritized_transfers[${i}]: missing 'confidence'`);
      if (typeof t.rationale !== "string") errors.push(`prioritized_transfers[${i}]: missing 'rationale'`);
    }
  }

  // Validate discount items
  if (Array.isArray(obj.discount_actions)) {
    for (let i = 0; i < obj.discount_actions.length; i++) {
      const d = obj.discount_actions[i] as Record<string, unknown>;
      if (typeof d.sku !== "string") errors.push(`discount_actions[${i}]: missing 'sku'`);
      if (typeof d.discount_pct !== "number") errors.push(`discount_actions[${i}]: missing 'discount_pct'`);
      if (typeof d.rationale !== "string") errors.push(`discount_actions[${i}]: missing 'rationale'`);
    }
  }

  // Validate anomalies
  if (Array.isArray(obj.anomalies)) {
    const validTypes = new Set(["SALES_SPIKE", "SALES_DROP", "INVENTORY_DRIFT", "DATA_QUALITY"]);
    for (let i = 0; i < obj.anomalies.length; i++) {
      const a = obj.anomalies[i] as Record<string, unknown>;
      if (typeof a.type !== "string" || !validTypes.has(a.type)) {
        errors.push(`anomalies[${i}]: invalid 'type'`);
      }
    }
  }

  // Validate param suggestions
  if (Array.isArray(obj.parameter_suggestions)) {
    const validParams = new Set([
      "lead_time_days", "safety_days", "overstock_threshold_days",
      "dead_stock_days", "review_cycle_days",
    ]);
    for (let i = 0; i < obj.parameter_suggestions.length; i++) {
      const p = obj.parameter_suggestions[i] as Record<string, unknown>;
      if (typeof p.param !== "string" || !validParams.has(p.param)) {
        errors.push(`parameter_suggestions[${i}]: invalid 'param'`);
      }
      if (typeof p.suggested_value !== "number") {
        errors.push(`parameter_suggestions[${i}]: missing 'suggested_value'`);
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, data: null };
  }

  return { valid: true, errors: [], data: obj as unknown as AiOutput };
}

// ---------------------------------------------------------------------------
// OpenAI API call + store
// ---------------------------------------------------------------------------

export async function runDailyAiAnalysis(tenantId: string): Promise<{ runId: string; status: AiRunStatus }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const today = new Date().toISOString().split("T")[0];
  const runDate = new Date(today);

  // Build payload
  const payload = await buildAiPayload(tenantId);

  // Skip if no data to analyze
  if (payload.top_risk_skus.length === 0 && payload.summary_stats.total_skus === 0) {
    const run = await prisma.aiRun.create({
      data: {
        tenantId,
        runDate,
        status: AiRunStatus.SUCCESS,
        model,
        promptVersion: PROMPT_VERSION,
        inputSummaryJson: JSON.stringify({ skus: 0, note: "No data to analyze" }),
        outputJson: JSON.stringify({
          date: today,
          tenant: payload.tenant,
          summary: { headline: "No inventory data available yet.", top_risk_locations: [], notes: [] },
          prioritized_transfers: [],
          discount_actions: [],
          anomalies: [],
          parameter_suggestions: [],
        }),
      },
    });
    return { runId: run.id, status: AiRunStatus.SUCCESS };
  }

  const inputSummary = JSON.stringify({
    date: payload.date,
    skus_sent: payload.top_risk_skus.length,
    summary_stats: payload.summary_stats,
  });

  let run;

  try {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(payload) },
      ],
      temperature: 0.3,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    });

    const rawText = response.choices[0]?.message?.content || "";
    const tokensIn = response.usage?.prompt_tokens ?? null;
    const tokensOut = response.usage?.completion_tokens ?? null;

    // Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      run = await prisma.aiRun.create({
        data: {
          tenantId,
          runDate,
          status: AiRunStatus.FAILED,
          model,
          promptVersion: PROMPT_VERSION,
          inputSummaryJson: inputSummary,
          outputText: rawText,
          tokensIn,
          tokensOut,
          errorMessage: "OpenAI returned invalid JSON",
        },
      });
      return { runId: run.id, status: AiRunStatus.FAILED };
    }

    // Validate schema
    const validation = validateAiOutput(parsed);
    if (!validation.valid) {
      run = await prisma.aiRun.create({
        data: {
          tenantId,
          runDate,
          status: AiRunStatus.FAILED,
          model,
          promptVersion: PROMPT_VERSION,
          inputSummaryJson: inputSummary,
          outputJson: JSON.stringify(parsed),
          outputText: rawText,
          tokensIn,
          tokensOut,
          errorMessage: `Schema validation failed: ${validation.errors.join("; ")}`,
        },
      });
      return { runId: run.id, status: AiRunStatus.FAILED };
    }

    // Success
    run = await prisma.aiRun.create({
      data: {
        tenantId,
        runDate,
        status: AiRunStatus.SUCCESS,
        model,
        promptVersion: PROMPT_VERSION,
        inputSummaryJson: inputSummary,
        outputJson: JSON.stringify(validation.data),
        tokensIn,
        tokensOut,
      },
    });

    return { runId: run.id, status: AiRunStatus.SUCCESS };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    run = await prisma.aiRun.create({
      data: {
        tenantId,
        runDate,
        status: AiRunStatus.FAILED,
        model,
        promptVersion: PROMPT_VERSION,
        inputSummaryJson: inputSummary,
        errorMessage: `OpenAI API error: ${message}`,
      },
    });
    return { runId: run.id, status: AiRunStatus.FAILED };
  }
}
