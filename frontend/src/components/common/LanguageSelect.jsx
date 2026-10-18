import { useId } from 'react';
import { FiGlobe } from 'react-icons/fi';
import { useT } from '../../i18n/I18nContext';
import { LANGUAGES } from '../../utils/preferences';

/**
 * Interface-language selector. It only changes the language of the HIMI interface; the language HIMI
 * explains concepts in is a separate setting on the Mentor page.
 */
export default function LanguageSelect({ className = '' }) {
  const id = useId();
  const { t, language, setLanguage } = useT();

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <label htmlFor={id} className="sr-only">
        {t('language.interface')}
      </label>
      <FiGlobe className="pointer-events-none absolute left-3 text-slate-500" aria-hidden="true" />
      <select
        id={id}
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        className="h-11 appearance-none rounded-2xl border border-slate-200 bg-white pl-9 pr-8 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-slate-50"
      >
        {LANGUAGES.map((item) => (
          <option key={item.code} value={item.code}>
            {item.nativeLabel}
          </option>
        ))}
      </select>
    </div>
  );
}
