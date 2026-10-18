import en from './en.js';
import te from './te.js';
import { translate } from './translate.js';

/** Every supported UI language. Add a dictionary here (and a `LANGUAGES` entry in utils/preferences.js). */
export const DICTIONARIES = { en, te };

export function t(language, key, params) {
  return translate(DICTIONARIES, language, key, params);
}
