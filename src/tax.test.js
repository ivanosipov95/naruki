import { describe, test, expect } from "vitest";
import {
  clampNumber,
  calculateTaxForIncome,
  getBonusForMonth,
  calculateMonthlyNetSequence,
  getAfterBonuses,
} from "./tax.js";

// ── clampNumber ───────────────────────────────────────────

describe("clampNumber", () => {
  test("returns positive number as-is", () => {
    expect(clampNumber(100)).toBe(100);
  });

  test("returns 0 for negative", () => {
    expect(clampNumber(-5)).toBe(0);
  });

  test("returns 0 for NaN", () => {
    expect(clampNumber(NaN)).toBe(0);
  });

  test("returns 0 for Infinity", () => {
    expect(clampNumber(Infinity)).toBe(0);
  });

  test("returns 0 for zero", () => {
    expect(clampNumber(0)).toBe(0);
  });
});

// ── calculateTaxForIncome ─────────────────────────────────

describe("calculateTaxForIncome", () => {
  test("13% для дохода до 2 400 000", () => {
    const { totalTax } = calculateTaxForIncome(200_000);
    expect(totalTax).toBe(200_000 * 0.13);
  });

  test("13% на границе первой ступени (2 400 000)", () => {
    const { totalTax } = calculateTaxForIncome(2_400_000);
    expect(totalTax).toBe(2_400_000 * 0.13);
  });

  test("прогрессия: 2.4М по 13% + остаток по 15%", () => {
    const { totalTax } = calculateTaxForIncome(2_500_000);
    expect(totalTax).toBe(2_400_000 * 0.13 + 100_000 * 0.15);
  });

  test("прогрессия: до третьей ступени (18%)", () => {
    const { totalTax } = calculateTaxForIncome(6_000_000);
    const expected =
      2_400_000 * 0.13 +
      (5_000_000 - 2_400_000) * 0.15 +
      (6_000_000 - 5_000_000) * 0.18;
    expect(totalTax).toBeCloseTo(expected);
  });

  test("прогрессия: до четвёртой ступени (20%)", () => {
    const { totalTax } = calculateTaxForIncome(25_000_000);
    const expected =
      2_400_000 * 0.13 +
      (5_000_000 - 2_400_000) * 0.15 +
      (20_000_000 - 5_000_000) * 0.18 +
      (25_000_000 - 20_000_000) * 0.2;
    expect(totalTax).toBeCloseTo(expected);
  });

  test("прогрессия: пятая ступень (22%)", () => {
    const { totalTax } = calculateTaxForIncome(60_000_000);
    const expected =
      2_400_000 * 0.13 +
      (5_000_000 - 2_400_000) * 0.15 +
      (20_000_000 - 5_000_000) * 0.18 +
      (50_000_000 - 20_000_000) * 0.2 +
      (60_000_000 - 50_000_000) * 0.22;
    expect(totalTax).toBeCloseTo(expected);
  });

  test("нулевой доход — нулевой налог", () => {
    const { totalTax, breakdown } = calculateTaxForIncome(0);
    expect(totalTax).toBe(0);
    expect(breakdown.every((b) => b.taxable === 0)).toBe(true);
  });

  test("breakdown содержит 5 ступеней", () => {
    const { breakdown } = calculateTaxForIncome(100_000);
    expect(breakdown).toHaveLength(5);
  });

  test("breakdown.taxable суммируется в исходный доход", () => {
    const income = 7_500_000;
    const { breakdown } = calculateTaxForIncome(income);
    const sum = breakdown.reduce((s, b) => s + b.taxable, 0);
    expect(sum).toBe(income);
  });
});

// ── getBonusForMonth ──────────────────────────────────────

describe("getBonusForMonth", () => {
  test("только ежемесячный бонус", () => {
    expect(getBonusForMonth(3, 10_000, [])).toBe(10_000);
  });

  test("ежемесячный + разовый за этот месяц", () => {
    const payments = [{ month: 3, amount: 50_000 }];
    expect(getBonusForMonth(3, 10_000, payments)).toBe(60_000);
  });

  test("разовый за другой месяц не учитывается", () => {
    const payments = [{ month: 6, amount: 50_000 }];
    expect(getBonusForMonth(3, 10_000, payments)).toBe(10_000);
  });

  test("несколько разовых выплат за один месяц", () => {
    const payments = [
      { month: 12, amount: 100_000 },
      { month: 12, amount: 200_000 },
    ];
    expect(getBonusForMonth(12, 0, payments)).toBe(300_000);
  });
});

// ── calculateMonthlyNetSequence ───────────────────────────

describe("calculateMonthlyNetSequence", () => {
  test("12 месяцев в результате", () => {
    const months = calculateMonthlyNetSequence(Array(12).fill(100_000));
    expect(months).toHaveLength(12);
  });

  test("сумма net + tax = gross + bonus для каждого месяца", () => {
    const months = calculateMonthlyNetSequence(
      Array(12).fill(200_000),
      10_000,
      [{ month: 6, amount: 50_000 }],
    );
    months.forEach((m) => {
      expect(m.net + m.tax).toBeCloseTo(m.gross + m.bonus);
    });
  });

  test("прогрессивный налог: поздние месяцы платят больше", () => {
    const months = calculateMonthlyNetSequence(Array(12).fill(500_000));
    // При 500к/мес за 5 месяцев доход > 2.4М, ставка растёт
    const earlyTax = months[0].tax;
    const lateTax = months[11].tax;
    expect(lateTax).toBeGreaterThan(earlyTax);
  });

  test("нулевые зарплаты — нулевые результаты", () => {
    const months = calculateMonthlyNetSequence(Array(12).fill(0));
    months.forEach((m) => {
      expect(m.gross).toBe(0);
      expect(m.tax).toBe(0);
      expect(m.net).toBe(0);
    });
  });

  test("разные зарплаты по месяцам", () => {
    const grosses = [
      100_000, 100_000, 100_000, 200_000, 200_000, 200_000, 200_000, 200_000,
      200_000, 200_000, 200_000, 200_000,
    ];
    const months = calculateMonthlyNetSequence(grosses);
    expect(months[0].gross).toBe(100_000);
    expect(months[3].gross).toBe(200_000);
    const totalGross = months.reduce((s, m) => s + m.gross, 0);
    expect(totalGross).toBe(100_000 * 3 + 200_000 * 9);
  });

  test("бонус добавляется к доходу месяца", () => {
    const months = calculateMonthlyNetSequence(
      Array(12).fill(100_000),
      10_000,
      [],
    );
    expect(months[0].bonus).toBe(10_000);
    expect(months[0].gross).toBe(100_000);
  });
});

// ── getAfterBonuses ───────────────────────────────────────

describe("getAfterBonuses", () => {
  const base = {
    monthlyBonus: 10_000,
    oneTimePayments: [{ month: 6, amount: 100_000 }],
    currentGross: 200_000,
    newGross: 300_000,
    newMonthlyBonus: 20_000,
    newOneTimePayments: [{ month: 12, amount: 50_000 }],
  };

  test("same — бонусы без изменений", () => {
    const result = getAfterBonuses({ ...base, bonusAfterMode: "same" });
    expect(result.monthlyBonus).toBe(10_000);
    expect(result.oneTimePayments).toEqual(base.oneTimePayments);
  });

  test("proportional — бонусы масштабируются", () => {
    const result = getAfterBonuses({ ...base, bonusAfterMode: "proportional" });
    expect(result.monthlyBonus).toBe(15_000); // 10_000 * (300/200)
    expect(result.oneTimePayments[0].amount).toBe(150_000); // 100_000 * 1.5
  });

  test("custom — используются новые бонусы", () => {
    const result = getAfterBonuses({ ...base, bonusAfterMode: "custom" });
    expect(result.monthlyBonus).toBe(20_000);
    expect(result.oneTimePayments).toEqual(base.newOneTimePayments);
  });

  test("proportional с нулевым currentGross — ratio = 1", () => {
    const result = getAfterBonuses({
      ...base,
      currentGross: 0,
      bonusAfterMode: "proportional",
    });
    expect(result.monthlyBonus).toBe(10_000);
  });
});
