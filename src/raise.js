const form = document.querySelector("#raise-form");
const currentGrossInput = document.querySelector("#current-gross");
const raisePercentInput = document.querySelector("#raise-percent");
const raiseAmountInput = document.querySelector("#raise-amount");
const raiseStartInput = document.querySelector("#raise-start");
const modeInputs = document.querySelectorAll('input[name="raise-mode"]');
const modeFields = document.querySelectorAll("[data-mode-field]");
const modeLabels = document.querySelectorAll(".segmented__item");
const monthlyBonusInput      = document.querySelector("#monthly-bonus");
const bonusPaymentsList      = document.querySelector("#bonus-payments-list");
const bonusAddBtn            = document.querySelector("#bonus-add");
const bonusAfterModeSelect   = document.querySelector("#bonus-after-mode");
const bonusAfterPanel        = document.querySelector("#bonus-after-panel");
const monthlyBonusAfterInput = document.querySelector("#monthly-bonus-after");
const bonusPaymentsAfterList = document.querySelector("#bonus-payments-after-list");
const bonusAfterAddBtn       = document.querySelector("#bonus-after-add");

const summaryCurrentGrossEl = document.querySelector("#summary-current-gross");
const summaryCurrentNetEl = document.querySelector("#summary-current-net");
const summaryRaiseAmountEl = document.querySelector("#summary-raise-amount");
const summaryRaisePercentEl = document.querySelector("#summary-raise-percent");
const summaryNewGrossEl = document.querySelector("#summary-new-gross");
const summaryNewNetEl = document.querySelector("#summary-new-net");
const summaryNetDeltaEl = document.querySelector("#summary-net-delta");
const summaryNetMonthEl = document.querySelector("#summary-net-month");
const compareTableEl = document.querySelector("#compare-table");
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
      trackGoal("switch_calc", { from: "raise", to: href });
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
  const prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  summarySection.scrollIntoView({
    behavior: prefersReduced ? "auto" : "smooth",
    block: "start",
  });
}

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

function parsePercentInput(value) {
  if (!value) return 0;
  const sanitized = value.replace(/[^\d.,]/g, "").replace(/,/g, ".");
  const parsed = Number.parseFloat(sanitized);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

function formatPercentInput(value) {
  if (!Number.isFinite(value) || value === 0) return "";
  const rounded = Math.round(value * 10) / 10;
  return String(rounded);
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

function createPaymentRow(month = 1, amount = 0, listEl) {
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

function getOneTimePayments(listEl) {
  const rows = listEl?.querySelectorAll(".bonus-payment-row") ?? [];
  return Array.from(rows).map((row) => ({
    month: Number(row.querySelector(".bonus-payment-row__month").value),
    amount: clampNumber(parseGrossInput(row.querySelector(".bonus-payment-row__amount").value)),
  })).filter((p) => p.amount > 0);
}

function getBonusForMonth(month, monthlyBonus, oneTimePayments) {
  const oneTime = oneTimePayments
    .filter((p) => p.month === month)
    .reduce((s, p) => s + p.amount, 0);
  return monthlyBonus + oneTime;
}

function getAfterBonuses({ monthlyBonus, oneTimePayments, bonusAfterMode, newMonthlyBonus, newOneTimePayments, currentGross, newGross }) {
  if (bonusAfterMode === "proportional") {
    const ratio = currentGross > 0 ? newGross / currentGross : 1;
    return {
      monthlyBonus: monthlyBonus * ratio,
      oneTimePayments: oneTimePayments.map((p) => ({ month: p.month, amount: p.amount * ratio })),
    };
  }
  if (bonusAfterMode === "custom") {
    return { monthlyBonus: newMonthlyBonus, oneTimePayments: newOneTimePayments };
  }
  return { monthlyBonus, oneTimePayments };
}

function parsePaymentsParam(raw) {
  if (!raw) return [];
  return raw.split(",").map((s) => {
    const [m, a] = s.split(":").map(Number);
    return { month: m, amount: a };
  }).filter((p) => p.month >= 1 && p.month <= 12 && p.amount > 0);
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

function calculateMonthlyNet(gross, monthlyBonus = 0, oneTimePayments = []) {
  return calculateMonthlyNetSequence(Array(12).fill(gross), monthlyBonus, oneTimePayments);
}

function calculateMonthlyNetSequence(grosses, monthlyBonus = 0, oneTimePayments = []) {
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

function getSelectedMode() {
  const selected = Array.from(modeInputs).find((input) => input.checked);
  return selected?.value || "percent";
}

function setMode(mode) {
  modeInputs.forEach((input) => {
    input.checked = input.value === mode;
    const label = input.closest(".segmented__item");
    if (label) {
      label.classList.toggle("is-active", input.checked);
    }
  });
  modeFields.forEach((field) => {
    const isActive = field.dataset.modeField === mode;
    field.classList.toggle("field--active", isActive);
    field.classList.toggle("is-hidden", !isActive);
    const input = field.querySelector("input");
    if (input) {
      input.readOnly = !isActive;
      input.setAttribute("aria-disabled", String(!isActive));
      input.required = isActive;
    }
  });
}

function getCurrentInputs() {
  const currentGross = clampNumber(parseGrossInput(currentGrossInput.value));
  const mode = getSelectedMode();
  const startMonth = Number(raiseStartInput.value) || 1;
  let raisePercent = 0;
  let raiseAmount = 0;

  if (mode === "percent") {
    raisePercent = clampNumber(parsePercentInput(raisePercentInput.value));
    raiseAmount = (currentGross * raisePercent) / 100;
  } else {
    raiseAmount = clampNumber(parseGrossInput(raiseAmountInput.value));
    raisePercent = currentGross === 0 ? 0 : (raiseAmount / currentGross) * 100;
  }

  const newGross = clampNumber(currentGross + raiseAmount);
  const monthlyBonus = clampNumber(parseGrossInput(monthlyBonusInput?.value ?? ""));
  const oneTimePayments = getOneTimePayments(bonusPaymentsList);
  const bonusAfterMode = bonusAfterModeSelect?.value ?? "same";
  const newMonthlyBonus = clampNumber(parseGrossInput(monthlyBonusAfterInput?.value ?? ""));
  const newOneTimePayments = getOneTimePayments(bonusPaymentsAfterList);

  return {
    currentGross,
    raisePercent,
    raiseAmount,
    newGross,
    mode,
    startMonth,
    monthlyBonus,
    oneTimePayments,
    bonusAfterMode,
    newMonthlyBonus,
    newOneTimePayments,
  };
}

function validateRaiseInput(mode) {
  if (mode === "percent") {
    const value = parsePercentInput(raisePercentInput.value);
    if (value <= 0) {
      raisePercentInput.setCustomValidity("Введите значение больше 0.");
      raisePercentInput.reportValidity();
      return false;
    }
  } else {
    const value = parseGrossInput(raiseAmountInput.value);
    if (value <= 0) {
      raiseAmountInput.setCustomValidity("Введите значение больше 0.");
      raiseAmountInput.reportValidity();
      return false;
    }
  }
  return true;
}

function renderSummary({ currentGross, newGross, raiseAmount, raisePercent, totals }) {
  summaryCurrentGrossEl.textContent = formatter.format(currentGross);
  summaryCurrentNetEl.textContent = `На руки в среднем: ${formatter.format(
    totals.current.avgNet
  )}`;

  summaryRaiseAmountEl.textContent = formatter.format(raiseAmount);
  summaryRaisePercentEl.textContent = `Это ${percentFormatter.format(
    raisePercent / 100
  )}`;

  summaryNewGrossEl.textContent = formatter.format(newGross);
  summaryNewNetEl.textContent = `На руки в среднем: ${formatter.format(
    totals.new.avgNet
  )}`;

  summaryNetDeltaEl.textContent = formatter.format(totals.delta.netYear);
  summaryNetMonthEl.textContent = `В среднем в месяц: ${formatter.format(
    totals.delta.netMonth
  )}`;
}

function renderCompareTable(totals) {
  compareTableEl.innerHTML = "";
  const rows = [
    {
      label: "До налогов",
      current: totals.current.grossYear,
      next: totals.new.grossYear,
      delta: totals.delta.grossYear,
    },
    {
      label: "Налоги",
      current: totals.current.taxYear,
      next: totals.new.taxYear,
      delta: totals.delta.taxYear,
    },
    {
      label: "На руки",
      current: totals.current.netYear,
      next: totals.new.netYear,
      delta: totals.delta.netYear,
    },
  ];
  compareTableEl.classList.remove("compare-cards");
  compareTableEl.innerHTML = `
    <div class="compare-row compare-row--header">
      <span>Показатель</span>
      <span class="text-right">Сейчас</span>
      <span class="text-right">После</span>
      <span class="text-right">Разница</span>
    </div>
  `;

  rows.forEach((row) => {
    const rowEl = document.createElement("div");
    rowEl.className = "compare-row";
    rowEl.innerHTML = `
      <span class="compare-row__label">${row.label}</span>
      <span class="text-right">${formatter.format(row.current)}</span>
      <span class="text-right">${formatter.format(row.next)}</span>
      <span class="compare-row__delta text-right">${formatter.format(row.delta)}</span>
    `;
    compareTableEl.appendChild(rowEl);
  });
}

function renderChart(currentMonths, newMonths) {
  chartGridEl.innerHTML = "";
  const table = document.createElement("div");
  table.className = "month-table month-table--compare";
  table.innerHTML = `
    <div class="month-table__head">
      <span>Месяц</span>
      <span class="text-right">Было</span>
      <span class="text-right">Стало</span>
      <span class="text-right">Разница</span>
    </div>
  `;

  currentMonths.forEach((item, index) => {
    const nextItem = newMonths[index];
    const label = monthNames[item.month - 1];
    const delta = nextItem.net - item.net;

    const row = document.createElement("div");
    row.className = "month-table__row";
    row.innerHTML = `
      <span class="month-table__month">${label}</span>
      <span class="month-table__value text-right">${formatter.format(item.net)}</span>
      <span class="month-table__value month-table__net text-right">${formatter.format(
        nextItem.net
      )}</span>
      <span class="month-table__value text-right">${formatter.format(delta)}</span>
    `;
    table.appendChild(row);
  });

  chartGridEl.appendChild(table);
}

function calculateTotalsFromMonths(currentMonths, newMonths) {
  const sum = (items, key) => items.reduce((acc, item) => acc + item[key], 0);
  const currentYearGross = sum(currentMonths, "gross") + sum(currentMonths, "bonus");
  const currentTax = sum(currentMonths, "tax");
  const currentNet = sum(currentMonths, "net");
  const newYearGross = sum(newMonths, "gross") + sum(newMonths, "bonus");
  const newTax = sum(newMonths, "tax");
  const newNet = sum(newMonths, "net");

  return {
    current: {
      grossYear: currentYearGross,
      taxYear: currentTax,
      netYear: currentNet,
      avgNet: currentNet / 12,
    },
    new: {
      grossYear: newYearGross,
      taxYear: newTax,
      netYear: newNet,
      avgNet: newNet / 12,
    },
    delta: {
      grossYear: newYearGross - currentYearGross,
      taxYear: newTax - currentTax,
      netYear: newNet - currentNet,
      netMonth: (newNet - currentNet) / 12,
    },
  };
}

function renderAll(inputs) {
  const afterBonuses = getAfterBonuses(inputs);
  const currentMonths = calculateMonthlyNet(
    inputs.currentGross,
    inputs.monthlyBonus,
    inputs.oneTimePayments
  );
  const grosses = Array.from({ length: 12 }, (_, index) =>
    index + 1 < inputs.startMonth ? inputs.currentGross : inputs.newGross
  );
  const newMonths = calculateMonthlyNetSequence(
    grosses,
    afterBonuses.monthlyBonus,
    afterBonuses.oneTimePayments
  );
  const totals = calculateTotalsFromMonths(currentMonths, newMonths);

  raiseAmountInput.value = formatGrossInput(String(Math.round(inputs.raiseAmount)));
  raisePercentInput.value = formatPercentInput(inputs.raisePercent);

  renderSummary({
    currentGross: inputs.currentGross,
    newGross: inputs.newGross,
    raiseAmount: inputs.raiseAmount,
    raisePercent: inputs.raisePercent,
    totals,
  });
  renderCompareTable(totals);
  renderChart(currentMonths, newMonths);
}

function syncUrlParams(inputs) {
  const params = new URLSearchParams(window.location.search);
  params.set("current", String(Math.round(inputs.currentGross)));
  params.set("mode", inputs.mode);
  params.set("start", String(inputs.startMonth));
  if (inputs.mode === "percent") {
    params.set("value", String(inputs.raisePercent));
  } else {
    params.set("value", String(Math.round(inputs.raiseAmount)));
  }

  if (inputs.monthlyBonus > 0) {
    params.set("mb", String(Math.round(inputs.monthlyBonus)));
  } else {
    params.delete("mb");
  }
  if (inputs.oneTimePayments && inputs.oneTimePayments.length > 0) {
    params.set("p", inputs.oneTimePayments.map((p) => `${p.month}:${Math.round(p.amount)}`).join(","));
  } else {
    params.delete("p");
  }
  const hasBonus = inputs.monthlyBonus > 0 || (inputs.oneTimePayments && inputs.oneTimePayments.length > 0);
  if (hasBonus && inputs.bonusAfterMode && inputs.bonusAfterMode !== "same") {
    params.set("bam", inputs.bonusAfterMode === "proportional" ? "prop" : "custom");
  } else {
    params.delete("bam");
  }
  if (inputs.bonusAfterMode === "custom") {
    if (inputs.newMonthlyBonus > 0) {
      params.set("nmb", String(Math.round(inputs.newMonthlyBonus)));
    } else {
      params.delete("nmb");
    }
    if (inputs.newOneTimePayments && inputs.newOneTimePayments.length > 0) {
      params.set("np", inputs.newOneTimePayments.map((p) => `${p.month}:${Math.round(p.amount)}`).join(","));
    } else {
      params.delete("np");
    }
  } else {
    params.delete("nmb");
    params.delete("np");
  }

  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}`;
  window.history.replaceState(null, "", nextUrl);
}

function handleSubmit(event) {
  event.preventDefault();
  if (isCalculating) return;
  const shouldScroll = event?.isTrusted;
  const mode = getSelectedMode();
  const currentGross = clampNumber(parseGrossInput(currentGrossInput.value));
  if (shouldScroll && currentGross <= 0) {
    currentGrossInput.setCustomValidity("Введите значение больше 0.");
    currentGrossInput.reportValidity();
    return;
  }
  currentGrossInput.setCustomValidity("");
  if (shouldScroll && !validateRaiseInput(mode)) return;
  setCalculatingState(true);

  const inputs = getCurrentInputs();
  renderAll(inputs);
  syncUrlParams(inputs);
  setDirtyState(false);
  if (shouldScroll) {
    trackGoal("calc_submit", { calculator: "raise" });
  }

  window.setTimeout(() => {
    setCalculatingState(false);
    if (shouldScroll) {
      scrollToResults();
    }
  }, 420);
}

form.addEventListener("submit", handleSubmit);

currentGrossInput.addEventListener("input", () => {
  const rawValue = currentGrossInput.value;
  const caret = currentGrossInput.selectionStart;
  const digitsBefore = countDigitsBefore(rawValue, caret);
  const formatted = formatGrossInput(rawValue);
  currentGrossInput.value = formatted;
  const nextCaret = caretFromDigits(formatted, digitsBefore);
  currentGrossInput.setSelectionRange(nextCaret, nextCaret);
  currentGrossInput.setCustomValidity("");
  setDirtyState(true);
});

raiseAmountInput.addEventListener("input", () => {
  const rawValue = raiseAmountInput.value;
  const caret = raiseAmountInput.selectionStart;
  const digitsBefore = countDigitsBefore(rawValue, caret);
  const formatted = formatGrossInput(rawValue);
  raiseAmountInput.value = formatted;
  const nextCaret = caretFromDigits(formatted, digitsBefore);
  raiseAmountInput.setSelectionRange(nextCaret, nextCaret);
  raiseAmountInput.setCustomValidity("");
  setDirtyState(true);
});

raisePercentInput.addEventListener("input", () => {
  const sanitized = raisePercentInput.value
    .replace(/[^\d.,]/g, "")
    .replace(/,/g, ".");
  raisePercentInput.value = sanitized;
  raisePercentInput.setCustomValidity("");
  setDirtyState(true);
});

raiseStartInput.addEventListener("change", () => {
  setDirtyState(true);
});

modeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    setMode(getSelectedMode());
    setDirtyState(true);
  });
});

modeLabels.forEach((label) => {
  label.addEventListener("click", () => {
    const input = label.querySelector('input[name="raise-mode"]');
    if (!input || input.checked) return;
    setMode(input.value);
    setDirtyState(true);
  });
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
  trackGoal("share_click", { calculator: "raise" });
  const inputs = getCurrentInputs();
  renderAll(inputs);
  syncUrlParams(inputs);
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
  const currentGross = Number(params.get("current"));
  const mode = params.get("mode");
  const value = params.get("value");
  const startMonth = Number(params.get("start"));
  const mb = Number(params.get("mb") || 0);
  const oneTimePayments = parsePaymentsParam(params.get("p") || "");
  const bamRaw = params.get("bam");
  const bonusAfterMode = bamRaw === "prop" ? "proportional" : bamRaw === "custom" ? "custom" : "same";
  const newMonthlyBonus = Number(params.get("nmb") || 0);
  const newOneTimePayments = parsePaymentsParam(params.get("np") || "");

  const hasGross = Number.isFinite(currentGross) && currentGross > 0;
  const hasMode = mode === "percent" || mode === "amount";
  const hasStart = Number.isFinite(startMonth) && startMonth >= 1 && startMonth <= 12;

  return {
    currentGross: hasGross ? currentGross : null,
    mode: hasMode ? mode : "percent",
    value,
    startMonth: hasStart ? startMonth : null,
    monthlyBonus: Number.isFinite(mb) && mb > 0 ? mb : 0,
    oneTimePayments,
    bonusAfterMode,
    newMonthlyBonus: Number.isFinite(newMonthlyBonus) && newMonthlyBonus > 0 ? newMonthlyBonus : 0,
    newOneTimePayments,
  };
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

if (monthlyBonusAfterInput) {
  monthlyBonusAfterInput.addEventListener("input", () => {
    const raw = monthlyBonusAfterInput.value;
    const caret = monthlyBonusAfterInput.selectionStart;
    const digitsBefore = countDigitsBefore(raw, caret);
    const formatted = formatGrossInput(raw);
    monthlyBonusAfterInput.value = formatted;
    const nextCaret = caretFromDigits(formatted, digitsBefore);
    monthlyBonusAfterInput.setSelectionRange(nextCaret, nextCaret);
    setDirtyState(true);
  });
}

bonusAddBtn?.addEventListener("click", () => {
  bonusPaymentsList.appendChild(createPaymentRow(1, 0, bonusPaymentsList));
  setDirtyState(true);
});

bonusAfterAddBtn?.addEventListener("click", () => {
  bonusPaymentsAfterList.appendChild(createPaymentRow(1, 0, bonusPaymentsAfterList));
  setDirtyState(true);
});

bonusAfterModeSelect?.addEventListener("change", () => {
  if (bonusAfterPanel) {
    bonusAfterPanel.hidden = bonusAfterModeSelect.value !== "custom";
  }
  setDirtyState(true);
});

const {
  currentGross: presetGross,
  mode: presetMode,
  value: presetValue,
  startMonth: presetStartMonth,
  monthlyBonus: presetMb,
  oneTimePayments: presetPayments,
  bonusAfterMode: presetBam,
  newMonthlyBonus: presetNmb,
  newOneTimePayments: presetNewPayments,
} = readUrlParams();

if (presetGross !== null) {
  currentGrossInput.value = formatGrossInput(String(presetGross));
}

const nowMonth = new Date().getMonth() + 1;
raiseStartInput.value = String(presetStartMonth ?? nowMonth);

setMode(presetMode || "percent");

if (presetValue) {
  if (presetMode === "amount") {
    raiseAmountInput.value = formatGrossInput(String(presetValue));
  } else {
    raisePercentInput.value = formatPercentInput(parsePercentInput(presetValue));
  }
}

if (presetMb > 0 && monthlyBonusInput) {
  monthlyBonusInput.value = formatGrossInput(String(presetMb));
}
presetPayments.forEach(({ month, amount }) => {
  bonusPaymentsList?.appendChild(createPaymentRow(month, amount, bonusPaymentsList));
});

if (presetBam && presetBam !== "same" && bonusAfterModeSelect) {
  bonusAfterModeSelect.value = presetBam;
  if (bonusAfterPanel) bonusAfterPanel.hidden = presetBam !== "custom";
}
if (presetNmb > 0 && monthlyBonusAfterInput) {
  monthlyBonusAfterInput.value = formatGrossInput(String(presetNmb));
}
presetNewPayments.forEach(({ month, amount }) => {
  bonusPaymentsAfterList?.appendChild(createPaymentRow(month, amount, bonusPaymentsAfterList));
});

setDirtyState(false);
if (presetGross !== null && presetValue) {
  handleSubmit(new Event("submit"));
}
