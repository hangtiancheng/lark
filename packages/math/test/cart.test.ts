import { describe, it, expect } from "vitest";
import {
  CartCalculator,
  calculateCart,
  yuanToCents,
  formatCurrency,
  type CartData,
} from "../src/cart.js";

describe("CartCalculator Precision & Features", () => {
  describe("Tests", () => {
    it("should convert correctly", () => {
      expect(yuanToCents(0.1)).toBe(10n);
      expect(yuanToCents(19.99)).toBe(1999n);
      expect(yuanToCents(99.99)).toBe(9999n);
      expect(yuanToCents(300)).toBe(30000n);
    });

    it("should reject", () => {
      expect(() => yuanToCents(0.30000000000000004)).toThrow("Precision error");
      expect(() => yuanToCents(19.991)).toThrow("Precision error");
    });

    it("should reject", () => {
      expect(() => yuanToCents(1e21)).toThrow("Numeric overflow");
    });

    it("should format correctly", () => {
      expect(formatCurrency(12345678n)).toBe("¥123,456.78");
      expect(formatCurrency(30n)).toBe("¥0.30");
      expect(formatCurrency(999900000000n)).toBe("¥9,999,000,000.00");
    });
  });

  describe("Tests", () => {
    it("should calculate correctly", () => {
      const cart: CartData = {
        goodsList: [{ id: 1, price: 0.1, quantity: 3 }],
      };
      const calculator = new CartCalculator(cart);

      const report = calculator.getReport();
      expect(report.originalTotalCents).toBe(30n); // exactly 30 cents
      expect(report.originalTotalFormatted).toBe("¥0.30");
    });
  });

  describe("Tests", () => {
    it("should calculate correctly", () => {
      const cart: CartData = {
        goodsList: [
          { id: 2, price: 19.99, quantity: 2 },
          { id: 4, price: 29.9, quantity: 3 },
        ],
      };
      const calculator = new CartCalculator(cart);

      const report = calculator.getReport();
      // 19.99 * 2 = 39.98 -> 3998 cents
      // 29.90 * 3 = 89.70 -> 8970 cents
      // 3998 + 8970 = 12968 cents -> 129.68 yuan
      expect(report.originalTotalCents).toBe(12968n);
      expect(report.originalTotalFormatted).toBe("¥129.68");
    });
  });

  describe("Tests", () => {
    it("should calculate correctly", () => {
      const cart: CartData = {
        goodsList: [{ id: 3, price: 99.99, quantity: 1000000000 }],
      };
      const calculator = new CartCalculator(cart);

      const report = calculator.getReport();
      // 99.99 -> 9999 cents. 9999 * 1000000000 = 9999000000000 cents
      expect(report.originalTotalCents).toBe(9999000000000n);
      expect(report.originalTotalFormatted).toBe("¥99,990,000,000.00");
    });
  });

  describe("Tests", () => {
    it("should calculate correctly", () => {
      const cart: CartData = {
        goodsList: [
          { id: 1, price: 0.1, quantity: 3 },
          { id: 2, price: 19.99, quantity: 2 },
          { id: 3, price: 99.99, quantity: 1000000000 },
        ],
        discount: {
          type: "percentage",
          value: 0.9,
        },
      };

      const report = calculateCart(cart);

      expect(report.originalTotalCents).toBe(9999000004028n);
      expect(report.discountAmountCents).toBe(999900000403n);
      expect(report.finalTotalCents).toBe(8999100003625n);
      expect(report.finalTotalFormatted).toBe("¥89,991,000,036.25");
    });
  });

  describe("Tests", () => {
    it("should calculate correctly", () => {
      const cart: CartData = {
        goodsList: [{ id: 5, price: 350.0, quantity: 1 }],
        discount: {
          type: "fullReduce",
          value: { threshold: 300, reduce: 50 },
        },
      };
      const calculator = new CartCalculator(cart);

      const report = calculator.getReport();
      // Original: 35000 cents
      // Discount: 5000 cents
      // Final: 30000 cents
      expect(report.originalTotalCents).toBe(35000n);
      expect(report.discountAmountCents).toBe(5000n);
      expect(report.finalTotalCents).toBe(30000n);
      expect(report.finalTotalFormatted).toBe("¥300.00");
    });
  });

  describe("Tests", () => {
    it("should calculate correctly", () => {
      const cart: CartData = {
        goodsList: [
          { id: 6, price: 100, quantity: 1 }, // 10000 cents
        ],
        discount: {
          type: "percentage",
          value: 0.9, // 90%
        },
      };
      const calculator = new CartCalculator(cart);

      const report = calculator.getReport();
      // Original: 10000 cents
      // Final: 10000 * 90 / 100 = 9000 cents
      // Discount: 1000 cents
      expect(report.originalTotalCents).toBe(10000n);
      expect(report.discountAmountCents).toBe(1000n);
      expect(report.finalTotalCents).toBe(9000n);
      expect(report.finalTotalFormatted).toBe("¥90.00");
    });

    it("should use half-up rounding when percentage discount produces sub-cent values", () => {
      const cart: CartData = {
        goodsList: [{ id: 7, price: 0.01, quantity: 1 }],
        discount: {
          type: "percentage",
          value: 0.9,
        },
      };

      const report = calculateCart(cart);

      expect(report.originalTotalCents).toBe(1n);
      expect(report.discountAmountCents).toBe(0n);
      expect(report.finalTotalCents).toBe(1n);
    });
  });

  describe("Tests", () => {
    it("should reject", () => {
      const cart: CartData = {
        goodsList: [
          { id: 8, price: 10, quantity: Number.MAX_SAFE_INTEGER + 1 },
        ],
      };

      expect(() => calculateCart(cart)).toThrow("Invalid quantity");
    });

    it("should reject", () => {
      const cart: CartData = {
        goodsList: [{ id: 9, price: 10, quantity: 1 }],
        discount: {
          type: "percentage",
          value: 1.2,
        },
      };

      expect(() => calculateCart(cart)).toThrow("Invalid discount");
    });

    it("should reject", () => {
      const cart: CartData = {
        goodsList: [{ id: 10, price: 300, quantity: 1 }],
        discount: {
          type: "fullReduce",
          value: { threshold: 100, reduce: 120 },
        },
      };

      expect(() => calculateCart(cart)).toThrow("Invalid discount");
    });
  });
});
