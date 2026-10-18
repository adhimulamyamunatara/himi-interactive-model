/**
 * Dependency-free translation lookup.
 *
 * - Keys are flat dotted strings ("nav.dashboard").
 * - A key missing in the chosen language falls back to English, and a key missing everywhere falls back to the
 *   key itself, so a gap never blanks the UI or throws.
 * - `{name}` placeholders are filled from `params`; unknown placeholders are left visible rather than hidden.
 */

const PLACEHOLDER = /\{(\w+)\}/g;

export function interpolate(template, params) {
  if (!params) {
    return template;
  }

  return template.replace(PLACEHOLDER, (match, name) => (Object.hasOwn(params, name) && params[name] != null ? String(params[name]) : match));
}

/**
 * @param {Record<string, Record<string, string>>} dictionaries language code -> (key -> text)
 * @param {string} language
 * @param {string} key
 * @param {Record<string, string | number>} [params]
 */
export function translate(dictionaries, language, key, params) {
  const own = dictionaries[language]?.[key];

  if (typeof own === 'string') {
    return interpolate(own, params);
  }

  const english = dictionaries.en?.[key];

  if (typeof english === 'string') {
    return interpolate(english, params);
  }

  return key;
}

/** Keys present in `base` but missing from `other` (used by tests to keep dictionaries in step). */
export function missingKeys(base, other) {
  return Object.keys(base).filter((key) => typeof other[key] !== 'string' || other[key].trim() === '');
}
