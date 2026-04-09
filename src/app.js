import {
  monthNames,
  brackets,
  formatter,
  percentFormatter,
  trackGoal,
  initLoadingState,
  setupCalcSwitchTransition,
  setupCalcSwitchMenu,
  clampNumber,
  formatGrossInput,
  parseGrossInput,
  parsePaymentsParam,
  setDirtyState,
  createCalculatingState,
  scrollToResults,
  calculateTaxForIncome,
  getBonusForMonth,
  calculateMonthlyNetSequence,
  createPaymentRow,
  getOneTimePayments,
  bindFormattedInput,
  createShareHandler,
  updateUrl,
} from "./shared.js";

// ── DOM refs ───────────────────────────────────────────────

const form = document.querySelector("#calc-form");
const grossInput = document.querySelector("#gross");
const startInput = document.querySelector("#start");
const monthlyBonusInput = document.querySelector("#monthly-bonus");
const bonusPaymentsList = document.querySelector("#bonus-payments-list");
const bonusAddBtn = document.querySelector("#bonus-add");

const totalGrossEl = document.querySelector("#total-gross");
const totalTaxEl = document.querySelector("#total-tax");
const totalNetEl = document.querySelector("#total-net");
const monthsCountEl = document.querySelector("#months-count");
const effectiveRateEl = document.querySelector("#effective-rate");
const avgNetEl = document.querySelector("#avg-net");
const bracketsEl = document.querySelector("#brackets");
const chartGridEl = document.querySelector("#chart-grid");
const summarySection = document.querySelector(".summary");
const shareButton = document.querySelector("#share-link");
const shareStatusEl = document.querySelector("#share-status");
const submitButton = form.querySelector('button[type="submit"]');

const buttonLabels = {
  idle: submitButton?.textContent?.trim() || "Рассчитать",
  calculating: "Считаем...",
};

// ── Init ───────────────────────────────────────────────────

initLoadingState();
setupCalcSwitchTransition("salary");
setupCalcSwitchMenu();

const calcState = createCalculatingState(submitButton, buttonLabels);

// ── Calculation (salary-specific) ──────────────────────────

function calculateMonthlyNet(gross, startMonth, monthlyBonus, oneTimePayments) {
  const months = [];
  let cumulativeIncome = 0;
  let cumulativeTax = 0;

  for (let month = 1; month <= 12; month += 1) {
    const working = month >= startMonth;
    if (!working) {
      months.push({ month, gross: 0, bonus: 0, tax: 0, net: 0, working });
      continue;
    }

    const bonusThisMonth = working
      ? getBonusForMonth(month, monthlyBonus, oneTimePayments)
      : 0;
    const totalEarned = gross + bonusThisMonth;
    cumulativeIncome += totalEarned;
    const { totalTax } = calculateTaxForIncome(cumulativeIncome);
    const monthTax = totalTax - cumulativeTax;
    cumulativeTax = totalTax;
    months.push({
      month,
      gross,
      bonus: bonusThisMonth,
      tax: monthTax,
      net: totalEarned - monthTax,
      working,
    });
  }

  return months;
}

function calculateAll(gross, startMonth, monthlyBonus, oneTimePayments) {
  const months = calculateMonthlyNet(gross, startMonth, monthlyBonus, oneTimePayments);
  const totalGross = months.reduce((s, m) => s + m.gross + m.bonus, 0);
  const totalTax = months.reduce((s, m) => s + m.tax, 0);
  const totalNet = totalGross - totalTax;
  const monthsCount = months.filter((m) => m.working).length;
  const { breakdown } = calculateTaxForIncome(totalGross);
  return { totalGross, totalTax, totalNet, monthsCount, breakdown, months };
}

// ── Render ─────────────────────────────────────────────────

function declineMonth(count) {
  if (count % 10 === 1 && count % 100 !== 11) return "месяц";
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return "месяца";
  }
  return "месяцев";
}

function renderSummary({ totalGross, totalTax, totalNet, monthsCount }) {
  totalGrossEl.textContent = formatter.format(totalGross);
  totalTaxEl.textContent = formatter.format(totalTax);
  totalNetEl.textContent = formatter.format(totalNet);

  monthsCountEl.textContent = `${monthsCount} ${declineMonth(monthsCount)} работы`;
  const effectiveRate = totalGross === 0 ? 0 : totalTax / totalGross;
  effectiveRateEl.textContent = `Эффективная ставка: ${percentFormatter.format(effectiveRate)}`;

  const avgNet = monthsCount === 0 ? 0 : totalNet / monthsCount;
  avgNetEl.textContent = `Средняя на руки: ${formatter.format(avgNet)}`;
}

function renderBrackets(breakdown) {
  bracketsEl.innerHTML = "";
  const virtualTopForLastBracket = 50_000_000 + 50_000_000;
  let previousLimit = 0;
  breakdown.forEach((item, index) => {
    const bracket = brackets[index];
    const isLast = index === brackets.length - 1;
    const limit = isLast ? virtualTopForLastBracket : bracket.limit;
    const capacity = Math.max(0, limit - previousLimit);
    const share = capacity === 0 ? 0 : item.taxable / capacity;
    const card = document.createElement("div");
    card.className = "bracket";
    card.innerHTML = `
      <div class="bracket__row">
        <span class="bracket__name">${item.label}</span>
        <span class="bracket__tax">${Math.round(item.rate * 100)}%</span>
      </div>
      <div class="bracket__row">
        <span>${formatter.format(item.taxable)}</span>
        <span>${formatter.format(item.tax)}</span>
      </div>
      <div class="bracket__bar" aria-hidden="true">
        <div class="bracket__fill" style="width: ${Math.min(share, 1) * 100}%"></div>
      </div>
    `;
    bracketsEl.appendChild(card);
    previousLimit = bracket.limit;
  });
}

function renderChart(months) {
  chartGridEl.innerHTML = "";
  const hasBonus = months.some((m) => m.bonus > 0);

  const table = document.createElement("div");
  table.className = hasBonus ? "month-table month-table--bonus" : "month-table";
  table.innerHTML = `
    <div class="month-table__head">
      <span>Месяц</span>
      <span class="text-right">На руки</span>
      <span class="text-right">Налог</span>
      ${hasBonus ? `<span class="text-right">Премия</span>` : ""}
    </div>
  `;

  months.forEach((item) => {
    const row = document.createElement("div");
    row.className = "month-table__row";
    const label = monthNames[item.month - 1];
    const netValue = item.working ? formatter.format(item.net) : "—";
    const taxValue = item.working ? formatter.format(item.tax) : "—";
    const bonusCell = hasBonus
      ? `<span class="month-table__value month-table__bonus text-right">${item.working && item.bonus > 0 ? formatter.format(item.bonus) : "—"}</span>`
      : "";
    row.innerHTML = `
      <span class="month-table__month">${label}</span>
      <span class="month-table__value month-table__net text-right">${netValue}</span>
      <span class="month-table__value month-table__tax text-right">${taxValue}</span>
      ${bonusCell}
    `;
    table.appendChild(row);
  });

  chartGridEl.appendChild(table);
}

// ── Inputs ─────────────────────────────────────────────────

function getCurrentInputs() {
  const gross = clampNumber(parseGrossInput(grossInput.value));
  const startMonth = Number(startInput.value);
  const monthlyBonus = clampNumber(parseGrossInput(monthlyBonusInput?.value ?? ""));
  const oneTimePayments = getOneTimePayments(bonusPaymentsList);
  return { gross, startMonth, monthlyBonus, oneTimePayments };
}

// ── URL params ─────────────────────────────────────────────

function syncUrlParams({ gross, startMonth, monthlyBonus, oneTimePayments }) {
  const params = new URLSearchParams(window.location.search);
  if (gross > 0) {
    params.set("gross", String(Math.round(gross)));
  } else {
    params.delete("gross");
  }
  if (startMonth >= 1 && startMonth <= 12) {
    params.set("start", String(startMonth));
  } else {
    params.delete("start");
  }
  if (monthlyBonus > 0) {
    params.set("mb", String(Math.round(monthlyBonus)));
  } else {
    params.delete("mb");
  }
  if (oneTimePayments && oneTimePayments.length > 0) {
    params.set(
      "p",
      oneTimePayments.map((p) => `${p.month}:${Math.round(p.amount)}`).join(",")
    );
  } else {
    params.delete("p");
  }
  updateUrl(params);
}

function readUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const gross = Number(params.get("gross"));
  const startMonth = Number(params.get("start"));
  const mb = Number(params.get("mb") || 0);
  const oneTimePayments = parsePaymentsParam(params.get("p") || "");

  const hasGross = Number.isFinite(gross) && gross > 0;
  const hasStart = Number.isFinite(startMonth) && startMonth >= 1 && startMonth <= 12;

  return {
    gross: hasGross ? gross : null,
    startMonth: hasStart ? startMonth : null,
    monthlyBonus: Number.isFinite(mb) && mb > 0 ? mb : 0,
    oneTimePayments,
  };
}

// ── Submit ─────────────────────────────────────────────────

function handleSubmit(event) {
  event.preventDefault();
  if (calcState.active) return;
  const shouldScroll = event?.isTrusted;
  calcState.set(true);
  const { gross, startMonth, monthlyBonus, oneTimePayments } = getCurrentInputs();
  if (shouldScroll && gross <= 0) {
    grossInput.setCustomValidity("Введите значение больше 0.");
    grossInput.reportValidity();
    calcState.set(false);
    return;
  }
  grossInput.setCustomValidity("");
  const results = calculateAll(gross, startMonth, monthlyBonus, oneTimePayments);

  renderSummary(results);
  renderBrackets(results.breakdown);
  renderChart(results.months);

  syncUrlParams({ gross, startMonth, monthlyBonus, oneTimePayments });
  setDirtyState(false);
  if (shouldScroll) {
    trackGoal("calc_submit", { calculator: "salary" });
  }
  window.setTimeout(() => {
    calcState.set(false);
    if (shouldScroll) {
      scrollToResults(summarySection);
    }
  }, 420);
}

// ── Event Listeners ────────────────────────────────────────

form.addEventListener("submit", handleSubmit);

bindFormattedInput(grossInput, () => {
  grossInput.setCustomValidity("");
  setDirtyState(true);
});

startInput.addEventListener("change", () => setDirtyState(true));

bindFormattedInput(monthlyBonusInput, () => setDirtyState(true));

bonusAddBtn?.addEventListener("click", () => {
  bonusPaymentsList.appendChild(createPaymentRow());
  setDirtyState(true);
});

const copyShareLink = createShareHandler(shareStatusEl);

if (shareButton) {
  shareButton.addEventListener("click", () => {
    trackGoal("share_click", { calculator: "salary" });
    const { gross, startMonth, monthlyBonus, oneTimePayments } = getCurrentInputs();
    const results = calculateAll(gross, startMonth, monthlyBonus, oneTimePayments);
    renderSummary(results);
    renderBrackets(results.breakdown);
    renderChart(results.months);
    syncUrlParams({ gross, startMonth, monthlyBonus, oneTimePayments });
    setDirtyState(false);
    copyShareLink();
  });
}

// ── Init from URL ──────────────────────────────────────────

const {
  gross: presetGross,
  startMonth: presetStart,
  monthlyBonus: presetMb,
  oneTimePayments: presetPayments,
} = readUrlParams();

if (presetGross !== null) {
  grossInput.value = formatGrossInput(String(presetGross));
}

startInput.value = String(presetStart ?? 1);

if (presetMb > 0 && monthlyBonusInput) {
  monthlyBonusInput.value = formatGrossInput(String(presetMb));
}
presetPayments.forEach(({ month, amount }) => {
  bonusPaymentsList?.appendChild(createPaymentRow(month, amount));
});

setDirtyState(false);

if (presetGross !== null) {
  handleSubmit(new Event("submit"));
}
