const form = document.querySelector("#calc-form");
const grossInput = document.querySelector("#gross");
const startInput = document.querySelector("#start");

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

function calculateMonthlyNet(gross, startMonth) {
  const months = [];
  let cumulativeIncome = 0;
  let cumulativeTax = 0;

  for (let month = 1; month <= 12; month += 1) {
    const working = month >= startMonth;
    if (!working) {
      months.push({
        month,
        gross: 0,
        tax: 0,
        net: 0,
        working,
      });
      continue;
    }

    cumulativeIncome += gross;
    const { totalTax } = calculateTaxForIncome(cumulativeIncome);
    const monthTax = totalTax - cumulativeTax;
    cumulativeTax = totalTax;
    months.push({
      month,
      gross,
      tax: monthTax,
      net: gross - monthTax,
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
  const maxNet = months.reduce((max, month) => Math.max(max, month.net), 0);

  months.forEach((item) => {
    const row = document.createElement("div");
    row.className = "month-row";
    const width = maxNet === 0 ? 0 : (item.net / maxNet) * 100;
    const label = monthNames[item.month - 1];
    const value = item.working ? formatter.format(item.net) : "—";
    row.innerHTML = `
      <div class="month-row__label">
        <span>${label}</span>
        <span>${value}</span>
      </div>
      <div class="month-row__bar">
        <div class="month-row__fill" style="width: ${width}%"></div>
      </div>
    `;
    chartGridEl.appendChild(row);
  });
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
  return { gross, startMonth };
}

function calculateAll(gross, startMonth) {
  const monthsCount = Math.max(0, 12 - startMonth + 1);
  const totalGross = gross * monthsCount;
  const { totalTax, breakdown } = calculateTaxForIncome(totalGross);
  const totalNet = totalGross - totalTax;
  const months = calculateMonthlyNet(gross, startMonth);
  return { totalGross, totalTax, totalNet, monthsCount, breakdown, months };
}

function handleSubmit(event) {
  event.preventDefault();
  if (isCalculating) return;
  const shouldScroll = event?.isTrusted;
  setCalculatingState(true);
  const { gross, startMonth } = getCurrentInputs();
  if (shouldScroll && gross <= 0) {
    grossInput.setCustomValidity("Введите значение больше 0.");
    grossInput.reportValidity();
    setCalculatingState(false);
    return;
  }
  grossInput.setCustomValidity("");
  const results = calculateAll(gross, startMonth);

  renderSummary(results);
  renderBrackets(results.breakdown, results.totalGross);
  renderChart(results.months);

  syncUrlParams({ gross, startMonth });
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
  const { gross, startMonth } = getCurrentInputs();
  const results = calculateAll(gross, startMonth);

  renderSummary(results);
  renderBrackets(results.breakdown, results.totalGross);
  renderChart(results.months);
  syncUrlParams({ gross, startMonth });
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

  const hasGross = Number.isFinite(gross) && gross > 0;
  const hasStart = Number.isFinite(startMonth) && startMonth >= 1 && startMonth <= 12;

  return {
    gross: hasGross ? gross : null,
    startMonth: hasStart ? startMonth : null,
  };
}

function syncUrlParams({ gross, startMonth }) {
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

  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}`;
  window.history.replaceState(null, "", nextUrl);
}

const { gross: presetGross, startMonth: presetStart } = readUrlParams();

if (presetGross !== null) {
  grossInput.value = formatGrossInput(String(presetGross));
}

startInput.value = String(presetStart ?? 1);
setDirtyState(false);

handleSubmit(new Event("submit"));
