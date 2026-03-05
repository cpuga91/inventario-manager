import {
  computeAvgDailySales,
  computeDaysOfCover,
  isStockoutRisk,
  isOverstockRisk,
  isDeadStock,
  computeTransferQty,
  computeDiscountBucket,
  computeTransferPriority,
} from "../analytics";

describe("Analytics Engine", () => {
  const now = new Date("2024-06-15");

  // Helper: create daily sales entries
  function makeSales(days: number, qtyPerDay: number): Array<{ date: Date; qty: number }> {
    const sales = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      sales.push({ date, qty: qtyPerDay });
    }
    return sales;
  }

  describe("computeAvgDailySales", () => {
    test("returns correct average for 7 days", () => {
      const sales = makeSales(7, 10);
      const avg = computeAvgDailySales(sales, 7, now);
      expect(avg).toBeCloseTo(10, 0);
    });

    test("returns correct average for 30 days", () => {
      const sales = makeSales(30, 5);
      const avg = computeAvgDailySales(sales, 30, now);
      expect(avg).toBeCloseTo(5, 0);
    });

    test("returns 0 for no sales", () => {
      const avg = computeAvgDailySales([], 30, now);
      expect(avg).toBe(0);
    });

    test("handles partial period (fewer sales than days)", () => {
      const sales = makeSales(10, 3); // 10 days of sales in a 30-day window
      const avg = computeAvgDailySales(sales, 30, now);
      expect(avg).toBeCloseTo(1, 0); // 30 qty / 30 days = 1
    });
  });

  describe("computeDaysOfCover", () => {
    test("returns correct cover for normal sales", () => {
      const cover = computeDaysOfCover(100, 10);
      expect(cover).toBe(10);
    });

    test("returns large number when no sales (epsilon)", () => {
      const cover = computeDaysOfCover(100, 0);
      expect(cover).toBeGreaterThan(10000);
    });

    test("returns 0 when no stock", () => {
      const cover = computeDaysOfCover(0, 10);
      expect(cover).toBe(0);
    });
  });

  describe("isStockoutRisk", () => {
    test("returns true when cover < lead + safety + review", () => {
      expect(isStockoutRisk(5, 3, 2, 7)).toBe(true);
    });

    test("returns false when cover >= lead + safety + review", () => {
      expect(isStockoutRisk(15, 3, 2, 7)).toBe(false); // 15 > 12 = not at risk
      expect(isStockoutRisk(12, 3, 2, 7)).toBe(false); // 12 >= 12
      expect(isStockoutRisk(20, 3, 2, 7)).toBe(false);
    });
  });

  describe("isOverstockRisk", () => {
    test("returns true when cover exceeds threshold", () => {
      expect(isOverstockRisk(100, 90)).toBe(true);
    });

    test("returns false when cover is within threshold", () => {
      expect(isOverstockRisk(30, 90)).toBe(false);
    });
  });

  describe("isDeadStock", () => {
    test("returns true when no sales ever and has stock", () => {
      expect(isDeadStock(10, null, 180, now)).toBe(true);
    });

    test("returns false when no stock", () => {
      expect(isDeadStock(0, null, 180, now)).toBe(false);
    });

    test("returns true when last sale exceeds dead_stock_days", () => {
      const oldDate = new Date(now);
      oldDate.setDate(oldDate.getDate() - 200);
      expect(isDeadStock(10, oldDate, 180, now)).toBe(true);
    });

    test("returns false when recent sale", () => {
      const recentDate = new Date(now);
      recentDate.setDate(recentDate.getDate() - 30);
      expect(isDeadStock(10, recentDate, 180, now)).toBe(false);
    });
  });

  describe("computeTransferQty", () => {
    test("computes correct transfer qty", () => {
      // target = 30 days * 2/day = 60 units. Need = 60 - 10 = 50. Warehouse available = 100 - 5 = 95. Transfer = 50
      const qty = computeTransferQty(30, 2, 10, 100, 5);
      expect(qty).toBe(50);
    });

    test("respects warehouse buffer", () => {
      // Need = 60 - 10 = 50, but warehouse only has 20 - 5 = 15 available
      const qty = computeTransferQty(30, 2, 10, 20, 5);
      expect(qty).toBe(15);
    });

    test("returns 0 when destination has enough", () => {
      const qty = computeTransferQty(30, 2, 100, 200, 5);
      expect(qty).toBe(0);
    });

    test("returns 0 when warehouse is below buffer", () => {
      const qty = computeTransferQty(30, 2, 10, 3, 5);
      expect(qty).toBe(0);
    });
  });

  describe("computeDiscountBucket", () => {
    test("returns 30% for dead stock", () => {
      const result = computeDiscountBucket(300, 200, 90, 180);
      expect(result.bucket).toBe(30);
    });

    test("returns 20% for slow mover", () => {
      const result = computeDiscountBucket(150, 100, 90, 180);
      expect(result.bucket).toBe(20);
    });

    test("returns 10% for overstock", () => {
      const result = computeDiscountBucket(95, 30, 90, 180);
      expect(result.bucket).toBe(10);
    });

    test("provides rationale string", () => {
      const result = computeDiscountBucket(300, 200, 90, 180);
      expect(result.rationale).toContain("Dead stock");
    });
  });

  describe("computeTransferPriority", () => {
    test("stockout risk gets high priority", () => {
      const withStockout = computeTransferPriority(true, 5, 100);
      const withoutStockout = computeTransferPriority(false, 5, 100);
      expect(withStockout).toBeGreaterThan(withoutStockout);
    });

    test("higher sales get higher priority", () => {
      const highSales = computeTransferPriority(false, 10, null);
      const lowSales = computeTransferPriority(false, 1, null);
      expect(highSales).toBeGreaterThan(lowSales);
    });

    test("capital tied adds to priority", () => {
      const withCapital = computeTransferPriority(false, 5, 1000);
      const withoutCapital = computeTransferPriority(false, 5, null);
      expect(withCapital).toBeGreaterThan(withoutCapital);
    });
  });
});
