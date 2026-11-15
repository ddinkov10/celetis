(() => {
  // engine/board/page/theme-choice.ts
  var THEME_KEY = "celetis:theme";
  var readTheme = () => {
    try {
      const value = localStorage.getItem(THEME_KEY);
      return value === "light" || value === "dark" ? value : "system";
    } catch {
      return "system";
    }
  };
  var applyTheme = (theme) => {
    const root = document.documentElement.dataset;
    root.themeChoice = theme;
    root.theme = theme !== "system" ? theme : matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  };

  // engine/board/page/theme.ts
  applyTheme(readTheme());
})();
