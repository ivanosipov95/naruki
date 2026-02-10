const YM_COUNTER_ID = 106764917;
const CONSENT_KEY = "naruki_ym_consent";

function getStoredConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY);
  } catch (error) {
    return null;
  }
}

function setStoredConsent(value) {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch (error) {
    // Ignore storage errors (private mode / blocked storage).
  }
}

function loadMetrika() {
  if (window.__ymLoaded) return;
  window.__ymLoaded = true;
  (function (m, e, t, r, i, k, a) {
    m[i] =
      m[i] ||
      function () {
        (m[i].a = m[i].a || []).push(arguments);
      };
    m[i].l = 1 * new Date();
    if (e.querySelector(`script[src^="${r}"]`)) return;
    k = e.createElement(t);
    a = e.getElementsByTagName(t)[0];
    k.async = 1;
    k.src = r;
    a.parentNode.insertBefore(k, a);
  })(window, document, "script", `https://mc.yandex.ru/metrika/tag.js?id=${YM_COUNTER_ID}`, "ym");

  window.ym(YM_COUNTER_ID, "init", {
    ssr: true,
    webvisor: true,
    clickmap: true,
    ecommerce: "dataLayer",
    referrer: document.referrer,
    url: location.href,
    accurateTrackBounce: true,
    trackLinks: true,
  });
}

function trackGoal(name, params) {
  if (typeof window.ym !== "function") return;
  try {
    window.ym(YM_COUNTER_ID, "reachGoal", name, params);
  } catch (error) {
    // Ignore tracking errors.
  }
}

function setupConsentBanner() {
  const banner = document.querySelector("#cookie-banner");
  if (!banner) return;

  const acceptButton = banner.querySelector("[data-consent-accept]");
  const declineButton = banner.querySelector("[data-consent-decline]");

  const stored = getStoredConsent();
  if (stored === "granted") {
    loadMetrika();
    banner.hidden = true;
    banner.classList.add("cookie-banner--hidden");
    return;
  }
  if (stored === "denied") {
    banner.hidden = true;
    banner.classList.add("cookie-banner--hidden");
    return;
  }

  banner.hidden = false;
  banner.classList.remove("cookie-banner--hidden");

  acceptButton?.addEventListener("click", () => {
    setStoredConsent("granted");
    loadMetrika();
    banner.hidden = true;
    banner.classList.add("cookie-banner--hidden");
  });

  declineButton?.addEventListener("click", () => {
    setStoredConsent("denied");
    banner.hidden = true;
    banner.classList.add("cookie-banner--hidden");
  });
}

function setupGoalTracking() {
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link) return;
    const href = link.getAttribute("href") || "";
    if (href.includes("contacts.html")) {
      trackGoal("contacts_click", { page: window.location.pathname });
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupConsentBanner, {
    once: true,
  });
  document.addEventListener("DOMContentLoaded", setupGoalTracking, { once: true });
} else {
  setupConsentBanner();
  setupGoalTracking();
}

window.narukiTrackGoal = trackGoal;
