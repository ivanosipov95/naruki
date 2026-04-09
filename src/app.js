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

function trackGoal(name, params) {
  if (typeof window.narukiTrackGoal === "function") {
    window.narukiTrackGoal(name, params);
  }
}

function clearLoadingState() {
  document.body.classList.remove("is-loading");
  document.body.classList.remove("is-transitioning");
}

if (document.readyState === "complete") {
  clearLoadingState();
} else {
  window.addEventListener("load", clearLoadingState, { once: true });
}

function setupCalcSwitchTransition() {
  const tabs = document.querySelectorAll(".calc-switch__tab");
  if (!tabs.length) return;
  tabs.forEach((tab) => {
    if (tab.getAttribute("aria-current") === "page") return;
    tab.addEventListener("click", (event) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      ) {
        return;
      }
      const href = tab.getAttribute("href");
      if (!href) return;
      trackGoal("switch_calc", { from: "salary", to: href });
      event.preventDefault();
      document.body.classList.add("is-transitioning");
      window.setTimeout(() => {
        window.location.href = href;
      }, 30);
    });
  });
}

setupCalcSwitchTransition();

function setupCalcSwitchMenu() {
  const switchEl = document.querySelector(".calc-switch");
  const toggle = document.querySelector(".calc-switch__toggle");
  if (!switchEl || !toggle) return;

  const closeMenu = () => {
    switchEl.classList.remove("calc-switch--open");
    toggle.setAttribute("aria-expanded", "false");
  };

  toggle.addEventListener("click", () => {
    const isOpen = switchEl.classList.toggle("calc-switch--open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("click", (event) => {
    if (!switchEl.contains(event.target)) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
}

setupCalcSwitchMenu();

const formatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("ru-RU", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const inputNumberFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

const monthNames = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

function createPaymentRow(month = 1, amount = 0) {
  const row = document.createElement("div");
  row.className = "bonus-payment-row";
  row.innerHTML = `
    <select class="bonus-payment-row__month" aria-label="Месяц выплаты">
      ${monthNames.map((name, i) => `<option value="${i + 1}"${i + 1 === month ? " selected" : ""}>${name}</option>`).join("")}
    </select>
    <input class="bonus-payment-row__amount" type="text" inputmode="numeric"
           placeholder="0" value="${amount > 0 ? formatGrossInput(String(amount)) : ""}"
           aria-label="Сумма выплаты" />
    <button class="ghost ghost--icon bonus-payment-row__remove" type="button" aria-label="Удалить">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
    </button>
  `;
  row.querySelector(".bonus-payment-row__remove").addEventListener("click", () => {
    row.remove();
    setDirtyState(true);
  });
  row.querySelector(".bonus-payment-row__amount").addEventListener("input", (e) => {
    const raw = e.target.value;
    const caret = e.target.selectionStart;
    const digitsBefore = countDigitsBefore(raw, caret);
    const formatted = formatGrossInput(raw);
    e.target.value = formatted;
    const nextCaret = caretFromDigits(formatted, digitsBefore);
    e.target.setSelectionRange(nextCaret, nextCaret);
    setDirtyState(true);
  });
  row.querySelector(".bonus-payment-row__month").addEventListener("change", () => setDirtyState(true));
  return row;
}

function getOneTimePayments() {
  const rows = bonusPaymentsList?.querySelectorAll(".bonus-payment-row") ?? [];
  return Array.from(rows).map((row) => ({
    month: Number(row.querySelector(".bonus-payment-row__month").value),
    amount: clampNumber(parseGrossInput(row.querySelector(".bonus-payment-row__amount").value)),
  })).filter((p) => p.amount > 0);
}

const brackets = [
  {
    label: "До 2 400 000",
    limit: 2_400_000,
    rate: 0.13,
  },
  {
    label: "2 400 000 – 5 000 000",
    limit: 5_000_000,
    rate: 0.15,
  },
  {
    label: "5 000 000 – 20 000 000",
    limit: 20_000_000,
    rate: 0.18,
  },
  {
    label: "20 000 000 – 50 000 000",
    limit: 50_000_000,
    rate: 0.2,
  },
  {
    label: "Свыше 50 000 000",
    limit: Infinity,
    rate: 0.22,
  },
];

function clampNumber(value) {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

function normalizeGrossInput(value) {
  return value.replace(/[^\d]/g, "");
}

function formatGrossInput(value) {
  const digits = normalizeGrossInput(value);
  if (!digits) return "";
  return inputNumberFormatter.format(Number(digits));
}

function parseGrossInput(value) {
  const digits = normalizeGrossInput(value);
  if (!digits) return 0;
  return Number(digits);
}

let isCalculating = false;

function setDirtyState(isDirty) {
  document.body.classList.toggle("is-dirty", isDirty);
}

function setCalculatingState(active) {
  isCalculating = active;
  document.body.classList.toggle("is-calculating", active);
  if (!submitButton) return;
  submitButton.classList.toggle("is-calculating", active);
  submitButton.disabled = active;
  submitButton.textContent = active ? buttonLabels.calculating : buttonLabels.idle;
}

function scrollToResults() {
  if (!summarySection) return;
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  const prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  const behavior = prefersReduced ? "auto" : "smooth";
  summarySection.scrollIntoView({
    behavior,
    block: "start",
  });
  const top = summarySection.getBoundingClientRect().top + window.pageYOffset - 12;
  window.setTimeout(() => {
    window.scrollTo({ top, behavior });
  }, 40);
}

function countDigitsBefore(value, caretIndex) {
  if (!Number.isFinite(caretIndex) || caretIndex <= 0) return 0;
  let count = 0;
  for (let i = 0; i < Math.min(caretIndex, value.length); i += 1) {
    if (/\d/.test(value[i])) count += 1;
  }
  return count;
}

function caretFromDigits(formattedValue, digitsCount) {
  if (digitsCount <= 0) return 0;
  let count = 0;
  for (let i = 0; i < formattedValue.length; i += 1) {
    if (/\d/.test(formattedValue[i])) count += 1;
    if (count >= digitsCount) return i + 1;
  }
  return formattedValue.length;
}

function getBonusForMonth(month, startMonth, monthlyBonus, oneTimePayments) {
  if (month < startMonth) return 0;
  const oneTime = oneTimePayments
    .filter((p) => p.month === month)
    .reduce((s, p) => s + p.amount, 0);
  return monthlyBonus + oneTime;
}

function calculateTaxForIncome(income) {
  let remaining = income;
  let previousLimit = 0;
  let totalTax = 0;
  const breakdown = brackets.map((bracket) => {
    const taxable = Math.max(
      0,
      Math.min(remaining, bracket.limit - previousLimit)
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

function calculateMonthlyNet(gross, startMonth, monthlyBonus, oneTimePayments) {
  const months = [];
  let cumulativeIncome = 0;
  let cumulativeTax = 0;

  for (let month = 1; month <= 12; month += 1) {
    const working = month >= startMonth;
    if (!working) {
      months.push({
        month,
        gross: 0,
        bonus: 0,
        tax: 0,
        net: 0,
        working,
      });
      continue;
    }

    const bonusThisMonth = getBonusForMonth(month, startMonth, monthlyBonus, oneTimePayments);
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

function renderSummary({ totalGross, totalTax, totalNet, monthsCount }) {
  totalGrossEl.textContent = formatter.format(totalGross);
  totalTaxEl.textContent = formatter.format(totalTax);
  totalNetEl.textContent = formatter.format(totalNet);

  monthsCountEl.textContent = `${monthsCount} ${declineMonth(monthsCount)} работы`;
  const effectiveRate = totalGross === 0 ? 0 : totalTax / totalGross;
  effectiveRateEl.textContent = `Эффективная ставка: ${percentFormatter.format(
    effectiveRate
  )}`;

  const avgNet = monthsCount === 0 ? 0 : totalNet / monthsCount;
  avgNetEl.textContent = `Средняя на руки: ${formatter.format(avgNet)}`;
}

function renderBrackets(breakdown, totalGross) {
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

function declineMonth(count) {
  if (count % 10 === 1 && count % 100 !== 11) return "месяц";
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return "месяца";
  }
  return "месяцев";
}

function getCurrentInputs() {
  const gross = clampNumber(parseGrossInput(grossInput.value));
  const startMonth = Number(startInput.value);
  const monthlyBonus = clampNumber(parseGrossInput(monthlyBonusInput?.value ?? ""));
  const oneTimePayments = getOneTimePayments();
  return { gross, startMonth, monthlyBonus, oneTimePayments };
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

function handleSubmit(event) {
  event.preventDefault();
  if (isCalculating) return;
  const shouldScroll = event?.isTrusted;
  setCalculatingState(true);
  const { gross, startMonth, monthlyBonus, oneTimePayments } = getCurrentInputs();
  if (shouldScroll && gross <= 0) {
    grossInput.setCustomValidity("Введите значение больше 0.");
    grossInput.reportValidity();
    setCalculatingState(false);
    return;
  }
  grossInput.setCustomValidity("");
  const results = calculateAll(gross, startMonth, monthlyBonus, oneTimePayments);

  renderSummary(results);
  renderBrackets(results.breakdown, results.totalGross);
  renderChart(results.months);

  syncUrlParams({ gross, startMonth, monthlyBonus, oneTimePayments });
  setDirtyState(false);
  if (shouldScroll) {
    trackGoal("calc_submit", { calculator: "salary" });
  }
  window.setTimeout(() => {
    setCalculatingState(false);
    if (shouldScroll) {
      scrollToResults();
    }
  }, 420);
}

form.addEventListener("submit", handleSubmit);

grossInput.addEventListener("input", () => {
  const rawValue = grossInput.value;
  const caret = grossInput.selectionStart;
  const digitsBefore = countDigitsBefore(rawValue, caret);
  const formatted = formatGrossInput(rawValue);
  grossInput.value = formatted;
  const nextCaret = caretFromDigits(formatted, digitsBefore);
  grossInput.setSelectionRange(nextCaret, nextCaret);
  grossInput.setCustomValidity("");
  setDirtyState(true);
});

startInput.addEventListener("change", () => {
  setDirtyState(true);
});

function setShareStatus(message) {
  if (!shareStatusEl) return;
  shareStatusEl.textContent = message;
  if (!message) {
    shareStatusEl.removeAttribute("data-active");
    return;
  }
  shareStatusEl.setAttribute("data-active", "true");
  window.clearTimeout(setShareStatus.timeoutId);
  setShareStatus.timeoutId = window.setTimeout(() => {
    shareStatusEl.textContent = "";
    shareStatusEl.removeAttribute("data-active");
  }, 2400);
}

async function copyShareLink() {
  trackGoal("share_click", { calculator: "salary" });
  const { gross, startMonth, monthlyBonus, oneTimePayments } = getCurrentInputs();
  const results = calculateAll(gross, startMonth, monthlyBonus, oneTimePayments);

  renderSummary(results);
  renderBrackets(results.breakdown, results.totalGross);
  renderChart(results.months);
  syncUrlParams({ gross, startMonth, monthlyBonus, oneTimePayments });
  setDirtyState(false);

  const url = window.location.href;
  try {
    await navigator.clipboard.writeText(url);
    setShareStatus("Ссылка скопирована.");
  } catch (error) {
    const fallback = document.createElement("input");
    fallback.value = url;
    document.body.appendChild(fallback);
    fallback.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(fallback);
    setShareStatus(copied ? "Ссылка скопирована." : "Не удалось скопировать ссылку.");
  }
}

if (shareButton) {
  shareButton.addEventListener("click", copyShareLink);
}

function readUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const gross = Number(params.get("gross"));
  const startMonth = Number(params.get("start"));
  const mb = Number(params.get("mb") || 0);
  const pRaw = params.get("p") || "";
  const oneTimePayments = pRaw
    ? pRaw.split(",").map((s) => {
        const [m, a] = s.split(":").map(Number);
        return { month: m, amount: a };
      }).filter((p) => p.month >= 1 && p.month <= 12 && p.amount > 0)
    : [];

  const hasGross = Number.isFinite(gross) && gross > 0;
  const hasStart = Number.isFinite(startMonth) && startMonth >= 1 && startMonth <= 12;

  return {
    gross: hasGross ? gross : null,
    startMonth: hasStart ? startMonth : null,
    monthlyBonus: Number.isFinite(mb) && mb > 0 ? mb : 0,
    oneTimePayments,
  };
}

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
    params.set("p", oneTimePayments.map((p) => `${p.month}:${Math.round(p.amount)}`).join(","));
  } else {
    params.delete("p");
  }

  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}`;
  window.history.replaceState(null, "", nextUrl);
}

if (monthlyBonusInput) {
  monthlyBonusInput.addEventListener("input", () => {
    const raw = monthlyBonusInput.value;
    const caret = monthlyBonusInput.selectionStart;
    const digitsBefore = countDigitsBefore(raw, caret);
    const formatted = formatGrossInput(raw);
    monthlyBonusInput.value = formatted;
    const nextCaret = caretFromDigits(formatted, digitsBefore);
    monthlyBonusInput.setSelectionRange(nextCaret, nextCaret);
    setDirtyState(true);
  });
}

bonusAddBtn?.addEventListener("click", () => {
  bonusPaymentsList.appendChild(createPaymentRow());
  setDirtyState(true);
});

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
if (presetMb > 0 || presetPayments.length > 0) {
  document.querySelector("#bonus-panel")?.setAttribute("open", "");
}

setDirtyState(false);

if (presetGross !== null) {
  handleSubmit(new Event("submit"));
}
