import {
  monthNames,
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
  calculateMonthlyNetSequence,
  createPaymentRow,
  getOneTimePayments,
  bindFormattedInput,
  createShareHandler,
  updateUrl,
} from "./shared.js";

// ── DOM refs ───────────────────────────────────────────────

const form = document.querySelector("#raise-form");
const currentGrossInput = document.querySelector("#current-gross");
const raisePercentInput = document.querySelector("#raise-percent");
const raiseAmountInput = document.querySelector("#raise-amount");
const raiseStartInput = document.querySelector("#raise-start");
const modeInputs = document.querySelectorAll('input[name="raise-mode"]');
const modeFields = document.querySelectorAll("[data-mode-field]");
const modeLabels = document.querySelectorAll(".segmented__item");
const monthlyBonusInput = document.querySelector("#monthly-bonus");
const bonusPaymentsList = document.querySelector("#bonus-payments-list");
const bonusAddBtn = document.querySelector("#bonus-add");
const bonusAfterModeSelect = document.querySelector("#bonus-after-mode");
const bonusAfterPanel = document.querySelector("#bonus-after-panel");
const monthlyBonusAfterInput = document.querySelector("#monthly-bonus-after");
const bonusPaymentsAfterList = document.querySelector("#bonus-payments-after-list");
const bonusAfterAddBtn = document.querySelector("#bonus-after-add");

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

// ── Init ───────────────────────────────────────────────────

initLoadingState();
setupCalcSwitchTransition("raise");
setupCalcSwitchMenu();

const calcState = createCalculatingState(submitButton, buttonLabels);

// ── Raise-specific utilities ───────────────────────────────

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

function getAfterBonuses({
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
    return { monthlyBonus: newMonthlyBonus, oneTimePayments: newOneTimePayments };
  }
  return { monthlyBonus, oneTimePayments };
}

function calculateMonthlyNet(gross, monthlyBonus = 0, oneTimePayments = []) {
  return calculateMonthlyNetSequence(
    Array(12).fill(gross),
    monthlyBonus,
    oneTimePayments
  );
}

// ── Mode switching ─────────────────────────────────────────

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

// ── Inputs ─────────────────────────────────────────────────

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
    raisePercent =
      currentGross === 0 ? 0 : (raiseAmount / currentGross) * 100;
  }

  const newGross = clampNumber(currentGross + raiseAmount);
  const monthlyBonus = clampNumber(
    parseGrossInput(monthlyBonusInput?.value ?? "")
  );
  const oneTimePayments = getOneTimePayments(bonusPaymentsList);
  const bonusAfterMode = bonusAfterModeSelect?.value ?? "same";
  const newMonthlyBonus = clampNumber(
    parseGrossInput(monthlyBonusAfterInput?.value ?? "")
  );
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

// ── Render ─────────────────────────────────────────────────

function renderSummary({
  currentGross,
  newGross,
  raiseAmount,
  raisePercent,
  totals,
}) {
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
  const currentYearGross =
    sum(currentMonths, "gross") + sum(currentMonths, "bonus");
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

  raiseAmountInput.value = formatGrossInput(
    String(Math.round(inputs.raiseAmount))
  );
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

// ── URL params ─────────────────────────────────────────────

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
    params.set(
      "p",
      inputs.oneTimePayments
        .map((p) => `${p.month}:${Math.round(p.amount)}`)
        .join(",")
    );
  } else {
    params.delete("p");
  }
  const hasBonus =
    inputs.monthlyBonus > 0 ||
    (inputs.oneTimePayments && inputs.oneTimePayments.length > 0);
  if (hasBonus && inputs.bonusAfterMode && inputs.bonusAfterMode !== "same") {
    params.set(
      "bam",
      inputs.bonusAfterMode === "proportional" ? "prop" : "custom"
    );
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
      params.set(
        "np",
        inputs.newOneTimePayments
          .map((p) => `${p.month}:${Math.round(p.amount)}`)
          .join(",")
      );
    } else {
      params.delete("np");
    }
  } else {
    params.delete("nmb");
    params.delete("np");
  }

  updateUrl(params);
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
  const bonusAfterMode =
    bamRaw === "prop"
      ? "proportional"
      : bamRaw === "custom"
        ? "custom"
        : "same";
  const newMonthlyBonus = Number(params.get("nmb") || 0);
  const newOneTimePayments = parsePaymentsParam(params.get("np") || "");

  const hasGross = Number.isFinite(currentGross) && currentGross > 0;
  const hasMode = mode === "percent" || mode === "amount";
  const hasStart =
    Number.isFinite(startMonth) && startMonth >= 1 && startMonth <= 12;

  return {
    currentGross: hasGross ? currentGross : null,
    mode: hasMode ? mode : "percent",
    value,
    startMonth: hasStart ? startMonth : null,
    monthlyBonus: Number.isFinite(mb) && mb > 0 ? mb : 0,
    oneTimePayments,
    bonusAfterMode,
    newMonthlyBonus:
      Number.isFinite(newMonthlyBonus) && newMonthlyBonus > 0
        ? newMonthlyBonus
        : 0,
    newOneTimePayments,
  };
}

// ── Submit ─────────────────────────────────────────────────

function handleSubmit(event) {
  event.preventDefault();
  if (calcState.active) return;
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
  calcState.set(true);

  const inputs = getCurrentInputs();
  renderAll(inputs);
  syncUrlParams(inputs);
  setDirtyState(false);
  if (shouldScroll) {
    trackGoal("calc_submit", { calculator: "raise" });
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

bindFormattedInput(currentGrossInput, () => {
  currentGrossInput.setCustomValidity("");
  setDirtyState(true);
});

bindFormattedInput(raiseAmountInput, () => {
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

raiseStartInput.addEventListener("change", () => setDirtyState(true));

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

bindFormattedInput(monthlyBonusInput, () => setDirtyState(true));
bindFormattedInput(monthlyBonusAfterInput, () => setDirtyState(true));

bonusAddBtn?.addEventListener("click", () => {
  bonusPaymentsList.appendChild(createPaymentRow());
  setDirtyState(true);
});

bonusAfterAddBtn?.addEventListener("click", () => {
  bonusPaymentsAfterList.appendChild(createPaymentRow());
  setDirtyState(true);
});

bonusAfterModeSelect?.addEventListener("change", () => {
  if (bonusAfterPanel) {
    bonusAfterPanel.hidden = bonusAfterModeSelect.value !== "custom";
  }
  setDirtyState(true);
});

const copyShareLink = createShareHandler(shareStatusEl);

if (shareButton) {
  shareButton.addEventListener("click", () => {
    trackGoal("share_click", { calculator: "raise" });
    const inputs = getCurrentInputs();
    renderAll(inputs);
    syncUrlParams(inputs);
    setDirtyState(false);
    copyShareLink();
  });
}

// ── Init from URL ──────────────────────────────────────────

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
    raisePercentInput.value = formatPercentInput(
      parsePercentInput(presetValue)
    );
  }
}

if (presetMb > 0 && monthlyBonusInput) {
  monthlyBonusInput.value = formatGrossInput(String(presetMb));
}
presetPayments.forEach(({ month, amount }) => {
  bonusPaymentsList?.appendChild(createPaymentRow(month, amount));
});

if (presetBam && presetBam !== "same" && bonusAfterModeSelect) {
  bonusAfterModeSelect.value = presetBam;
  if (bonusAfterPanel) bonusAfterPanel.hidden = presetBam !== "custom";
}
if (presetNmb > 0 && monthlyBonusAfterInput) {
  monthlyBonusAfterInput.value = formatGrossInput(String(presetNmb));
}
presetNewPayments.forEach(({ month, amount }) => {
  bonusPaymentsAfterList?.appendChild(createPaymentRow(month, amount));
});

setDirtyState(false);
if (presetGross !== null && presetValue) {
  handleSubmit(new Event("submit"));
}
