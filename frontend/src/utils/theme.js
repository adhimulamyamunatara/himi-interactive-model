/**
 * Light / dark theme helpers. Pure and framework-free; the DOM and `matchMedia` are passed in so this can be tested.
 *
 * The stored choice is 'system' | 'light' | 'dark' (in the preferences). What is drawn is always 'light' or 'dark':
 * `resolveTheme` turns the choice plus the device setting into that. The theme is applied as
 * `<html data-theme="...">`; the same rule is repeated in `index.html` so the first paint already has the right theme.
 */

export const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Browser chrome colours (mobile address bar) for each resolved theme. */
export const THEME_COLORS = { light: '#ffffff', dark: '#0a1424' };

/** @returns {'light' | 'dark'} */
export function resolveTheme(choice, systemPrefersDark) {
  if (choice === 'dark') {
    return 'dark';
  }

  if (choice === 'light') {
    return 'light';
  }

  return systemPrefersDark ? 'dark' : 'light';
}

/** Whether the device asks for dark. False when `matchMedia` is missing. */
export function systemPrefersDark(win = globalThis.window) {
  try {
    return Boolean(win?.matchMedia?.(DARK_QUERY).matches);
  } catch {
    return false;
  }
}

/** The opposite of a resolved theme. */
export const oppositeTheme = (resolved) => (resolved === 'dark' ? 'light' : 'dark');

/**
 * Put a resolved theme on the document: the `data-theme` attribute, the native `color-scheme` and the mobile
 * `theme-color` meta tag. Safe to call repeatedly.
 */
export function applyTheme(resolved, doc = globalThis.document) {
  const root = doc?.documentElement;

  if (!root || !(resolved in THEME_COLORS)) {
    return false;
  }

  root.setAttribute('data-theme', resolved);
  root.style.colorScheme = resolved;

  const meta = doc.querySelector?.('meta[name="theme-color"]');
  meta?.setAttribute('content', THEME_COLORS[resolved]);
  return true;
}
