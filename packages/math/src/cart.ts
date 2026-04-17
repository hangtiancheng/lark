export interface Goods {
  id: number;
  price: number;
  quantity: number;
}

export interface PercentageDiscount {
  type: "percentage";
  value: number;
}

export interface FullReduceDiscount {
  type: "fullReduce";
  value: { threshold: number; reduce: number };
}

export type Discount = PercentageDiscount | FullReduceDiscount;

export interface CartData {
  goodsList: Goods[];
  discount?: Discount;
}

export interface CartCalculationReport {
  originalTotalCents: bigint;
  originalTotalFormatted: string;
  discountAmountCents: bigint;
  discountAmountFormatted: string;
  finalTotalCents: bigint;
  finalTotalFormatted: string;
}

const CENTS_SCALE = 2;
const RATE_SCALE = 4;
const RATE_BASE = 10_000n;

function normalizeDecimalString(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error("Numeric overflow");
  }
  const str = value.toString();
  if (str.startsWith("-")) {
    throw new Error("Invalid value");
  }
  if (/e/i.test(str)) {
    throw new Error("Numeric overflow");
  }
  return str;
}

function parseScaledInteger(value: number, scale: number): bigint {
  const normalized = normalizeDecimalString(value);
  const [integerPart, fractionPart = ""] = normalized.split(".");
  if (fractionPart.length > scale) {
    throw new Error("Precision error");
  }
  const digits = `${integerPart}${fractionPart.padEnd(scale, "0")}`;
  return BigInt(digits);
}

function parseQuantity(quantity: number, itemId: number): bigint {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new Error("Invalid quantity");
  }

  return BigInt(quantity);
}

function roundHalfUp(dividend: bigint, divisor: bigint): bigint {
  const quotient = dividend / divisor;
  const remainder = dividend % divisor;

  return remainder * 2n >= divisor ? quotient + 1n : quotient;
}

export function yuanToCents(yuan: number): bigint {
  return parseScaledInteger(yuan, CENTS_SCALE);
}

export function formatCurrency(cents: bigint): string {
  const isNegative = cents < 0n;
  const absCents = isNegative ? -cents : cents;

  const intPart = absCents / 100n;
  const fracPart = absCents % 100n;

  const intStr = intPart.toLocaleString("en-US");
  const fracStr = fracPart.toString().padStart(2, "0");

  return `¥${isNegative ? "-" : ""}${intStr}.${fracStr}`;
}

export class CartCalculator {
  private cart: CartData;

  constructor(cart: CartData) {
    this.cart = cart;
  }

  getOriginalTotalCents(): bigint {
    let total = 0n;

    for (const item of this.cart.goodsList) {
      const priceCents = yuanToCents(item.price);
      const qty = parseQuantity(item.quantity, item.id);
      total += priceCents * qty;
    }

    return total;
  }

  getDiscountAmountCents(originalTotalCents: bigint): bigint {
    const { discount } = this.cart;

    if (!discount) return 0n;

    if (discount.type === "percentage") {
      const discountRate = parseScaledInteger(discount.value, RATE_SCALE);

      if (discountRate > RATE_BASE) {
        throw new Error("Invalid discount");
      }

      const finalPrice = roundHalfUp(
        originalTotalCents * discountRate,
        RATE_BASE,
      );
      return originalTotalCents - finalPrice;
    }

    const thresholdCents = yuanToCents(discount.value.threshold);
    const reduceCents = yuanToCents(discount.value.reduce);

    if (reduceCents > thresholdCents) {
      throw new Error("Invalid discount");
    }

    if (originalTotalCents >= thresholdCents) {
      return reduceCents > originalTotalCents
        ? originalTotalCents
        : reduceCents;
    }

    return 0n;
  }

  getFinalTotalCents(): bigint {
    const originalTotal = this.getOriginalTotalCents();
    const discountAmount = this.getDiscountAmountCents(originalTotal);

    return originalTotal - discountAmount;
  }

  getFormattedFinalTotal(): string {
    const finalCents = this.getFinalTotalCents();

    return formatCurrency(finalCents);
  }

  getReport(): CartCalculationReport {
    const originalTotalCents = this.getOriginalTotalCents();
    const discountAmountCents = this.getDiscountAmountCents(originalTotalCents);
    const finalTotalCents = originalTotalCents - discountAmountCents;

    return {
      originalTotalCents,
      originalTotalFormatted: formatCurrency(originalTotalCents),
      discountAmountCents,
      discountAmountFormatted: formatCurrency(discountAmountCents),
      finalTotalCents,
      finalTotalFormatted: formatCurrency(finalTotalCents),
    };
  }
}

export function calculateCart(cart: CartData): CartCalculationReport {
  return new CartCalculator(cart).getReport();
}
