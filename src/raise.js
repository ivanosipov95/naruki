const form = document.querySelector("#raise-form");
const currentGrossInput = document.querySelector("#current-gross");
const raisePercentInput = document.querySelector("#raise-percent");
const raiseAmountInput = document.querySelector("#raise-amount");
const raiseStartInput = document.querySelector("#raise-start");
const modeInputs = document.querySelectorAll('input[name="raise-mode"]');
const modeFields = document.querySelectorAll("[data-mode-field]");

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
const shareButton = document.querySelector("#share-link");
const shareStatusEl = document.querySelector("#share-status");
const submitButton = form.querySelector('button[type="submit"]');

const buttonLabels = {
  idle: submitButton?.textContent?.trim() || "Рассчитать",
  calculating: "Считаем...",
};

function clearLoadingState() {
  document.body.classList.remove("is-loading");
}

if (document.readyState === "complete") {
  clearLoadingState();
} else {
  window.addEventListener("load", clearLoadingState, { once: true });
}

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
  return String(rounded).replace(/\./g, ",");
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

function calculateMonthlyNet(gross) {
  return calculateMonthlyNetSequence(Array(12).fill(gross));
}

function calculateMonthlyNetSequence(grosses) {
  const months = [];
  let cumulativeIncome = 0;
  let cumulativeTax = 0;

  for (let month = 1; month <= 12; month += 1) {
    const gross = clampNumber(grosses[month - 1] ?? 0);
    cumulativeIncome += gross;
    const { totalTax } = calculateTaxForIncome(cumulativeIncome);
    const monthTax = totalTax - cumulativeTax;
    cumulativeTax = totalTax;
    months.push({
      month,
      gross,
      tax: monthTax,
      net: gross - monthTax,
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

  return {
    currentGross,
    raisePercent,
    raiseAmount,
    newGross,
    mode,
    startMonth,
  };
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

  const header = document.createElement("div");
  header.className = "compare-row compare-row--header";
  header.innerHTML = `
    <span></span>
    <span>Сейчас</span>
    <span>После</span>
    <span>Разница</span>
  `;
  compareTableEl.appendChild(header);

  rows.forEach((row) => {
    const rowEl = document.createElement("div");
    rowEl.className = "compare-row";
    rowEl.innerHTML = `
      <span class="compare-row__label">${row.label}</span>
      <span>${formatter.format(row.current)}</span>
      <span>${formatter.format(row.next)}</span>
      <span class="compare-row__delta">${formatter.format(row.delta)}</span>
    `;
    compareTableEl.appendChild(rowEl);
  });
}

function renderChart(currentMonths, newMonths) {
  chartGridEl.innerHTML = "";
  const maxNet = Math.max(
    ...currentMonths.map((item) => item.net),
    ...newMonths.map((item) => item.net)
  );
  currentMonths.forEach((item, index) => {
    const nextItem = newMonths[index];
    const label = monthNames[item.month - 1];
    const delta = nextItem.net - item.net;

    const row = document.createElement("div");
    row.className = "month-row month-row--compare";
    row.innerHTML = `
      <div class="month-row__label month-row__label--compare">
        <span>${label}</span>
        <span class="month-row__values">
          <span class="pill">Было: ${formatter.format(item.net)}</span>
          <span class="pill pill--new">Стало: ${formatter.format(nextItem.net)}</span>
          <span class="pill pill--delta">Разница: ${formatter.format(delta)}</span>
        </span>
      </div>
    `;
    chartGridEl.appendChild(row);
  });
}

function calculateTotalsFromMonths(currentMonths, newMonths) {
  const sum = (items, key) => items.reduce((acc, item) => acc + item[key], 0);
  const currentYearGross = sum(currentMonths, "gross");
  const currentTax = sum(currentMonths, "tax");
  const currentNet = sum(currentMonths, "net");
  const newYearGross = sum(newMonths, "gross");
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
  const currentMonths = calculateMonthlyNet(inputs.currentGross);
  const grosses = Array.from({ length: 12 }, (_, index) =>
    index + 1 < inputs.startMonth ? inputs.currentGross : inputs.newGross
  );
  const newMonths = calculateMonthlyNetSequence(grosses);
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

  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}`;
  window.history.replaceState(null, "", nextUrl);
}

function handleSubmit(event) {
  event.preventDefault();
  if (isCalculating) return;
  setCalculatingState(true);

  const inputs = getCurrentInputs();
  renderAll(inputs);
  syncUrlParams(inputs);
  setDirtyState(false);

  window.setTimeout(() => {
    setCalculatingState(false);
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
  setDirtyState(true);
});

raisePercentInput.addEventListener("input", () => {
  const sanitized = raisePercentInput.value.replace(/[^\d.,]/g, "");
  raisePercentInput.value = sanitized;
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
  handleSubmit(new Event("submit"));
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

  const hasGross = Number.isFinite(currentGross) && currentGross > 0;
  const hasMode = mode === "percent" || mode === "amount";
  const hasStart = Number.isFinite(startMonth) && startMonth >= 1 && startMonth <= 12;

  return {
    currentGross: hasGross ? currentGross : null,
    mode: hasMode ? mode : "percent",
    value,
    startMonth: hasStart ? startMonth : null,
  };
}

const {
  currentGross: presetGross,
  mode: presetMode,
  value: presetValue,
  startMonth: presetStartMonth,
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

setDirtyState(false);
handleSubmit(new Event("submit"));
