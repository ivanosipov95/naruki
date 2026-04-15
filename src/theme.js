(() => {
  const STORAGE_KEY = "naruki-theme";
  const DARK_THEME_COLOR = "#101417";
  const LIGHT_THEME_COLOR = "#f6f0e9";
  const root = document.documentElement;
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  function getStoredTheme() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      if (value === "dark" || value === "light") return value;
    } catch {
      /* private mode */
    }
    return null;
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* private mode */
    }
  }

  function getCurrentTheme() {
    const applied = root.getAttribute("data-theme");
    if (applied === "dark" || applied === "light") return applied;
    const stored = getStoredTheme();
    if (stored) return stored;
    return "light";
  }

  function updateThemeMeta(theme) {
    if (!themeMeta) return;
    themeMeta.setAttribute(
      "content",
      theme === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR,
    );
  }

  function updateToggleA11y(theme) {
    const toggles = document.querySelectorAll("[data-theme-toggle]");
    if (!toggles.length) return;
    const nextLabel =
      theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему";
    toggles.forEach((toggle) => {
      toggle.setAttribute("aria-label", nextLabel);
      toggle.setAttribute("title", nextLabel);
      toggle.setAttribute("aria-pressed", String(theme === "dark"));
    });
  }

  function applyTheme(theme, persist) {
    root.setAttribute("data-theme", theme);
    updateThemeMeta(theme);
    updateToggleA11y(theme);
    if (persist) {
      saveTheme(theme);
    }
  }

  function toggleTheme() {
    const current = getCurrentTheme();
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next, true);
  }

  function initToggle() {
    const toggles = document.querySelectorAll("[data-theme-toggle]");
    toggles.forEach((toggle) => {
      toggle.addEventListener("click", toggleTheme);
    });
  }

  applyTheme(getCurrentTheme(), false);
  initToggle();

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    const theme = event.newValue === "dark" ? "dark" : "light";
    applyTheme(theme, false);
  });
})();
