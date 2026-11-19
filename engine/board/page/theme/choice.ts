export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_KEY = 'celetis:theme';

export const readTheme = (): Theme => {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
};

export const writeTheme = (theme: Theme): void => {
  try {
    if (theme === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {}
};

export const applyTheme = (theme: Theme): void => {
  const root = document.documentElement.dataset;
  root.themeChoice = theme;
  root.theme = theme !== 'system' ? theme : matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};
