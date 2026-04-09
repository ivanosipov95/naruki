// ── Constants ──────────────────────────────────────────────

export const monthNames = [
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

export const brackets = [
  { label: "До 2 400 000", limit: 2_400_000, rate: 0.13 },
  { label: "2 400 000 – 5 000 000", limit: 5_000_000, rate: 0.15 },
  { label: "5 000 000 – 20 000 000", limit: 20_000_000, rate: 0.18 },
  { label: "20 000 000 – 50 000 000", limit: 50_000_000, rate: 0.2 },
  { label: "Свыше 50 000 000", limit: Infinity, rate: 0.22 },
];

export const formatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

export const percentFormatter = new Intl.NumberFormat("ru-RU", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const inputNumberFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

// ── Analytics ──────────────────────────────────────────────

export function trackGoal(name, params) {
  if (typeof window.narukiTrackGoal === "function") {
    window.narukiTrackGoal(name, params);
  }
}

// ── Loading & Navigation ───────────────────────────────────

export function clearLoadingState() {
  document.body.classList.remove("is-loading");
  document.body.classList.remove("is-transitioning");
}

export function initLoadingState() {
  if (document.readyState === "complete") {
    clearLoadingState();
  } else {
    window.addEventListener("load", clearLoadingState, { once: true });
  }
}

export function setupCalcSwitchTransition(fromPage) {
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
      trackGoal("switch_calc", { from: fromPage, to: href });
      event.preventDefault();
      document.body.classList.add("is-transitioning");
      window.setTimeout(() => {
        window.location.href = href;
      }, 30);
    });
  });
}

export function setupCalcSwitchMenu() {
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

// ── Number Utilities ───────────────────────────────────────

export function clampNumber(value) {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

export function normalizeGrossInput(value) {
  return value.replace(/[^\d]/g, "");
}

export function formatGrossInput(value) {
  const digits = normalizeGrossInput(value);
  if (!digits) return "";
  return inputNumberFormatter.format(Number(digits));
}

export function parseGrossInput(value) {
  const digits = normalizeGrossInput(value);
  if (!digits) return 0;
  return Number(digits);
}

export function countDigitsBefore(value, caretIndex) {
  if (!Number.isFinite(caretIndex) || caretIndex <= 0) return 0;
  let count = 0;
  for (let i = 0; i < Math.min(caretIndex, value.length); i += 1) {
    if (/\d/.test(value[i])) count += 1;
  }
  return count;
}

export function caretFromDigits(formattedValue, digitsCount) {
  if (digitsCount <= 0) return 0;
  let count = 0;
  for (let i = 0; i < formattedValue.length; i += 1) {
    if (/\d/.test(formattedValue[i])) count += 1;
    if (count >= digitsCount) return i + 1;
  }
  return formattedValue.length;
}

export function parsePaymentsParam(raw) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => {
      const [m, a] = s.split(":").map(Number);
      return { month: m, amount: a };
    })
    .filter((p) => p.month >= 1 && p.month <= 12 && p.amount > 0);
}

// ── UI State ───────────────────────────────────────────────

export function setDirtyState(isDirty) {
  document.body.classList.toggle("is-dirty", isDirty);
}

export function createCalculatingState(submitButton, buttonLabels) {
  let isCalculating = false;
  return {
    get active() {
      return isCalculating;
    },
    set(active) {
      isCalculating = active;
      document.body.classList.toggle("is-calculating", active);
      if (!submitButton) return;
      submitButton.classList.toggle("is-calculating", active);
      submitButton.disabled = active;
      submitButton.textContent = active
        ? buttonLabels.calculating
        : buttonLabels.idle;
    },
  };
}

export function scrollToResults(summarySection) {
  if (!summarySection) return;
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  const prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  const behavior = prefersReduced ? "auto" : "smooth";
  summarySection.scrollIntoView({ behavior, block: "start" });
  const top =
    summarySection.getBoundingClientRect().top + window.pageYOffset - 12;
  window.setTimeout(() => {
    window.scrollTo({ top, behavior });
  }, 40);
}

// ── Tax Calculation ────────────────────────────────────────

export function calculateTaxForIncome(income) {
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

export function getBonusForMonth(month, monthlyBonus, oneTimePayments) {
  const oneTime = oneTimePayments
    .filter((p) => p.month === month)
    .reduce((s, p) => s + p.amount, 0);
  return monthlyBonus + oneTime;
}

export function calculateMonthlyNetSequence(
  grosses,
  monthlyBonus = 0,
  oneTimePayments = []
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

// ── DOM: Bonus Payment Rows ────────────────────────────────

export function createPaymentRow(month = 1, amount = 0) {
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
  row.querySelector(".bonus-payment-row__remove").addEventListener(
    "click",
    () => {
      row.remove();
      setDirtyState(true);
    }
  );
  row.querySelector(".bonus-payment-row__amount").addEventListener(
    "input",
    (e) => {
      const raw = e.target.value;
      const caret = e.target.selectionStart;
      const digitsBefore = countDigitsBefore(raw, caret);
      const formatted = formatGrossInput(raw);
      e.target.value = formatted;
      const nextCaret = caretFromDigits(formatted, digitsBefore);
      e.target.setSelectionRange(nextCaret, nextCaret);
      setDirtyState(true);
    }
  );
  row
    .querySelector(".bonus-payment-row__month")
    .addEventListener("change", () => setDirtyState(true));
  return row;
}

export function getOneTimePayments(listEl) {
  const rows = listEl?.querySelectorAll(".bonus-payment-row") ?? [];
  return Array.from(rows)
    .map((row) => ({
      month: Number(row.querySelector(".bonus-payment-row__month").value),
      amount: clampNumber(
        parseGrossInput(
          row.querySelector(".bonus-payment-row__amount").value
        )
      ),
    }))
    .filter((p) => p.amount > 0);
}

// ── DOM: Formatted Input Binding ───────────────────────────

export function bindFormattedInput(input, onChange) {
  if (!input) return;
  input.addEventListener("input", () => {
    const raw = input.value;
    const caret = input.selectionStart;
    const digitsBefore = countDigitsBefore(raw, caret);
    const formatted = formatGrossInput(raw);
    input.value = formatted;
    const nextCaret = caretFromDigits(formatted, digitsBefore);
    input.setSelectionRange(nextCaret, nextCaret);
    if (onChange) onChange();
  });
}

// ── Share Link ─────────────────────────────────────────────

export function createShareHandler(shareStatusEl) {
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

  return async function copyShareLink(beforeCopy) {
    if (beforeCopy) beforeCopy();
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
      setShareStatus(
        copied ? "Ссылка скопирована." : "Не удалось скопировать ссылку."
      );
    }
  };
}

// ── URL Params Helper ──────────────────────────────────────

export function updateUrl(params) {
  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}`;
  window.history.replaceState(null, "", nextUrl);
}
