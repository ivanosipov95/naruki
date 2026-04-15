// ── Tax Constants ─────────────────────────────────────────

export const brackets = [
  { label: "До 2 400 000", limit: 2_400_000, rate: 0.13 },
  { label: "2 400 000 – 5 000 000", limit: 5_000_000, rate: 0.15 },
  { label: "5 000 000 – 20 000 000", limit: 20_000_000, rate: 0.18 },
  { label: "20 000 000 – 50 000 000", limit: 50_000_000, rate: 0.2 },
  { label: "Свыше 50 000 000", limit: Infinity, rate: 0.22 },
];

// ── Pure Utilities ────────────────────────────────────────

export function clampNumber(value) {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

// ── Tax Calculation ───────────────────────────────────────

export function calculateTaxForIncome(income) {
  let remaining = income;
  let previousLimit = 0;
  let totalTax = 0;
  const breakdown = brackets.map((bracket) => {
    const taxable = Math.max(
      0,
      Math.min(remaining, bracket.limit - previousLimit),
    );
    const tax = taxable * bracket.rate;
    remaining -= taxable;
    previousLimit = bracket.limit;
    totalTax += tax;
    return {
      label: bracket.label,
      rate: bracket.rate,
      taxable,
      tax,
    };
  });

  return { totalTax, breakdown };
}

export function getBonusForMonth(month, monthlyBonus, oneTimePayments) {
  const oneTime = oneTimePayments
    .filter((p) => p.month === month)
    .reduce((s, p) => s + p.amount, 0);
  return monthlyBonus + oneTime;
}

export function calculateMonthlyNetSequence(
  grosses,
  monthlyBonus = 0,
  oneTimePayments = [],
) {
  const months = [];
  let cumulativeIncome = 0;
  let cumulativeTax = 0;

  for (let month = 1; month <= 12; month += 1) {
    const gross = clampNumber(grosses[month - 1] ?? 0);
    const bonus = getBonusForMonth(month, monthlyBonus, oneTimePayments);
    const totalEarned = gross + bonus;
    cumulativeIncome += totalEarned;
    const { totalTax } = calculateTaxForIncome(cumulativeIncome);
    const monthTax = totalTax - cumulativeTax;
    cumulativeTax = totalTax;
    months.push({
      month,
      gross,
      bonus,
      tax: monthTax,
      net: totalEarned - monthTax,
    });
  }

  return months;
}

// ── Raise: Bonus Mode Logic ──────────────────────────────

export function getAfterBonuses({
  monthlyBonus,
  oneTimePayments,
  bonusAfterMode,
  newMonthlyBonus,
  newOneTimePayments,
  currentGross,
  newGross,
}) {
  if (bonusAfterMode === "proportional") {
    const ratio = currentGross > 0 ? newGross / currentGross : 1;
    return {
      monthlyBonus: monthlyBonus * ratio,
      oneTimePayments: oneTimePayments.map((p) => ({
        month: p.month,
        amount: p.amount * ratio,
      })),
    };
  }
  if (bonusAfterMode === "custom") {
    return {
      monthlyBonus: newMonthlyBonus,
      oneTimePayments: newOneTimePayments,
    };
  }
  return { monthlyBonus, oneTimePayments };
}
