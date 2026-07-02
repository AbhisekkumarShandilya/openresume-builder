// App-level appearance setting: System / Light / Dark.
//
// This is a *global* preference (like which template is selected), not part of
// any resume, so it lives under its own localStorage key rather than inside a
// profile body. "system" defers to the OS via prefers-color-scheme; light/dark
// pin the theme regardless of the OS.
//
// Kept as a pure module (no React, no direct DOM/window access) so it's cheap
// to unit-test — App.jsx owns the wiring (matchMedia listener, applying the
// data-theme attribute, and pushing the setting to nativeTheme over IPC).

export const THEME_KEY = 'resume-builder:theme';
export const THEME_SETTINGS = ['system', 'light', 'dark'];

// Read the saved setting, defaulting to "system" for anything unrecognized
// (never persisted, corrupted, or an old value).
export function readThemeSetting(storage) {
  try {
    const v = storage.getItem(THEME_KEY);
    return THEME_SETTINGS.includes(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

export function writeThemeSetting(storage, setting) {
  const value = THEME_SETTINGS.includes(setting) ? setting : 'system';
  try {
    storage.setItem(THEME_KEY, value);
  } catch {
    // Storage full/unavailable — the in-memory setting still applies for the
    // session; persistence is best-effort.
  }
  return value;
}

// Resolve a setting + the OS preference into the concrete theme to apply.
// `prefersDark` is the boolean from matchMedia('(prefers-color-scheme: dark)').
export function resolveTheme(setting, prefersDark) {
  if (setting === 'light' || setting === 'dark') return setting;
  return prefersDark ? 'dark' : 'light';
}
