import { validateAiOutput, sanitizeSkuPayload } from "../ai-analysis";

describe("AI Analysis Module", () => {
  // ---------------------------------------------------------------------------
  // sanitizeSkuPayload
  // ---------------------------------------------------------------------------
  describe("sanitizeSkuPayload", () => {
    test("keeps only allowed fields", () => {
      const input = {
        sku: "ABC-123",
        variant_id: "gid://shopify/ProductVariant/1",
        dest_location: "Store 1",
        warehouse_on_hand: 100,
        dest_on_hand: 5,
        avg_daily_sales_7: 2,
        avg_daily_sales_14: 1.8,
        avg_daily_sales_30: 1.5,
        days_of_cover: 3.3,
        days_without_sale: null,
        heuristic_transfer_qty: 40,
        heuristic_priority: 1500,
        cogs: 12.5,
        capital_tied: 62.5,
        // PII fields that should be stripped
        customer_name: "John Doe",
        customer_email: "john@example.com",
        order_notes: "Please deliver to back door",
      };

      const result = sanitizeSkuPayload(input);

      expect(result.sku).toBe("ABC-123");
      expect(result.variant_id).toBe("gid://shopify/ProductVariant/1");
      expect(result.warehouse_on_hand).toBe(100);
      expect(result.cogs).toBe(12.5);
      // PII should NOT be in the result
      expect((result as Record<string, unknown>).customer_name).toBeUndefined();
      expect((result as Record<string, unknown>).customer_email).toBeUndefined();
      expect((result as Record<string, unknown>).order_notes).toBeUndefined();
    });

    test("handles missing optional fields gracefully", () => {
      const input = {
        sku: null,
        variant_id: "v1",
        dest_location: "Store",
        warehouse_on_hand: 0,
        dest_on_hand: 0,
        avg_daily_sales_7: 0,
        avg_daily_sales_14: 0,
        avg_daily_sales_30: 0,
        days_of_cover: 0,
        days_without_sale: null,
        heuristic_transfer_qty: 0,
        heuristic_priority: 0,
        cogs: null,
        capital_tied: null,
      };

      const result = sanitizeSkuPayload(input);
      expect(result.sku).toBeNull();
      expect(result.cogs).toBeNull();
      expect(result.capital_tied).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // validateAiOutput
  // ---------------------------------------------------------------------------
  describe("validateAiOutput", () => {
    const validOutput = {
      date: "2024-06-15",
      tenant: { id: "t1", name: "Test Tenant" },
      summary: {
        headline: "3 SKUs at stockout risk in Store 1",
        top_risk_locations: [{ location: "Store 1", reason: "Low cover on 3 SKUs" }],
        notes: ["Consider increasing safety stock for seasonal items"],
      },
      prioritized_transfers: [
        {
          sku: "TEA-001",
          variant_id: "v1",
          from_location: "WAREHOUSE",
          to_location: "Store 1",
          qty: 24,
          priority: 85,
          confidence: 0.9,
          rationale: "Only 2 days of cover remaining with avg 3/day sales",
          evidence: {
            dest_on_hand: 6,
            warehouse_on_hand: 200,
            avg_daily_sales_30: 3,
            days_of_cover: 2,
            lead_time_days: 3,
            safety_days: 2,
          },
        },
      ],
      discount_actions: [
        {
          sku: "TEA-OLD",
          variant_id: "v2",
          location: "Store 1",
          discount_pct: 20,
          confidence: 0.7,
          rationale: "No sales in 95 days, 150 days of cover",
          evidence: {
            days_without_sale: 95,
            days_of_cover: 150,
            on_hand: 30,
            cogs: 5.0,
            capital_tied: 150.0,
          },
        },
      ],
      anomalies: [
        {
          sku: "TEA-HOT",
          variant_id: "v3",
          location: "Online",
          type: "SALES_SPIKE",
          confidence: 0.8,
          description: "Sales 3x above baseline this week",
          evidence: { metric: "avg_daily_sales_7", value: 15, baseline: 5 },
        },
      ],
      parameter_suggestions: [
        {
          param: "safety_days",
          suggested_value: 3,
          confidence: 0.6,
          reason: "Current 2-day safety frequently leads to stockouts",
        },
      ],
    };

    test("accepts valid complete output", () => {
      const result = validateAiOutput(validOutput);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).not.toBeNull();
      expect(result.data!.summary.headline).toBe("3 SKUs at stockout risk in Store 1");
    });

    test("accepts valid output with empty arrays", () => {
      const minimal = {
        date: "2024-06-15",
        tenant: { id: "t1", name: "Test" },
        summary: { headline: "All good", top_risk_locations: [], notes: [] },
        prioritized_transfers: [],
        discount_actions: [],
        anomalies: [],
        parameter_suggestions: [],
      };
      const result = validateAiOutput(minimal);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("rejects null input", () => {
      const result = validateAiOutput(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Output is not an object");
    });

    test("rejects non-object input", () => {
      const result = validateAiOutput("not an object");
      expect(result.valid).toBe(false);
    });

    test("rejects missing required top-level fields", () => {
      const result = validateAiOutput({});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing or invalid 'date'");
      expect(result.errors).toContain("Missing 'tenant'");
      expect(result.errors).toContain("Missing 'summary'");
      expect(result.errors).toContain("Missing 'prioritized_transfers' array");
    });

    test("rejects missing summary fields", () => {
      const result = validateAiOutput({
        date: "2024-01-01",
        tenant: { id: "t1", name: "T" },
        summary: {},
        prioritized_transfers: [],
        discount_actions: [],
        anomalies: [],
        parameter_suggestions: [],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing 'summary.headline'");
    });

    test("rejects transfer with missing required fields", () => {
      const result = validateAiOutput({
        ...validOutput,
        prioritized_transfers: [{ sku: "X" }], // missing qty, priority, etc.
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("missing 'variant_id'"))).toBe(true);
      expect(result.errors.some((e) => e.includes("missing 'qty'"))).toBe(true);
      expect(result.errors.some((e) => e.includes("missing 'priority'"))).toBe(true);
    });

    test("rejects discount with missing required fields", () => {
      const result = validateAiOutput({
        ...validOutput,
        discount_actions: [{ sku: "X" }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("missing 'discount_pct'"))).toBe(true);
    });

    test("rejects anomaly with invalid type", () => {
      const result = validateAiOutput({
        ...validOutput,
        anomalies: [{
          sku: "X", variant_id: "v1", location: "Store", type: "INVALID_TYPE",
          confidence: 0.5, description: "test", evidence: { metric: "x", value: 1, baseline: 2 },
        }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("invalid 'type'"))).toBe(true);
    });

    test("rejects parameter suggestion with invalid param name", () => {
      const result = validateAiOutput({
        ...validOutput,
        parameter_suggestions: [{
          param: "invalid_param", suggested_value: 5, confidence: 0.5, reason: "test",
        }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("invalid 'param'"))).toBe(true);
    });

    test("accepts all valid anomaly types", () => {
      const types = ["SALES_SPIKE", "SALES_DROP", "INVENTORY_DRIFT", "DATA_QUALITY"];
      for (const type of types) {
        const result = validateAiOutput({
          ...validOutput,
          anomalies: [{
            sku: "X", variant_id: "v1", location: "Store", type,
            confidence: 0.5, description: "test", evidence: { metric: "x", value: 1, baseline: 2 },
          }],
        });
        expect(result.valid).toBe(true);
      }
    });

    test("accepts all valid parameter names", () => {
      const params = ["lead_time_days", "safety_days", "overstock_threshold_days", "dead_stock_days", "review_cycle_days"];
      for (const param of params) {
        const result = validateAiOutput({
          ...validOutput,
          parameter_suggestions: [{ param, suggested_value: 5, confidence: 0.5, reason: "test" }],
        });
        expect(result.valid).toBe(true);
      }
    });
  });
});
