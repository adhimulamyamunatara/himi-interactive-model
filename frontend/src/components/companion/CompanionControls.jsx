import { FiRefreshCw, FiSquare, FiVolume2, FiVolumeX } from 'react-icons/fi';
import { useT } from '../../i18n/I18nContext';
import { LANGUAGES } from '../../utils/preferences';
import { SUBJECTS } from '../../utils/subjects';

export const ICON_BUTTON =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:bg-slate-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50';

/** Subject, explanation language, read-aloud and start-over. All of them are plain labelled controls. */
export default function CompanionControls({ view, idPrefix, compact = false }) {
  const { t } = useT();
  const { subject, setSubject, explanationLanguage, setExplanationLanguage, thinking } = view;
  const canReadAloud = view.voiceAllowed && view.speechSupported;

  return (
    <div className={`flex flex-wrap items-end gap-3 ${compact ? '' : 'sm:gap-4'}`}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <label htmlFor={`${idPrefix}-subject`} className="text-xs font-semibold text-slate-600">
          {t('companion.subject')}
        </label>
        <select
          id={`${idPrefix}-subject`}
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className="w-full min-w-[8rem] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
        >
          {SUBJECTS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div role="group" aria-label={t('companion.language')} className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-slate-600">{t('companion.language')}</span>
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5">
          {LANGUAGES.map((language) => {
            const active = explanationLanguage === language.code;

            return (
              <button
                key={language.code}
                type="button"
                lang={language.code}
                aria-pressed={active}
                onClick={() => setExplanationLanguage(language.code)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 ${
                  active ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {language.nativeLabel}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {canReadAloud ? (
          <button
            type="button"
            onClick={view.toggleReadAloud}
            aria-pressed={view.autoRead}
            aria-label={t('companion.readAloud')}
            title={t('companion.readAloud')}
            className={`${ICON_BUTTON} ${view.autoRead ? 'border-blue-300 bg-blue-50 text-blue-700' : ''}`}
          >
            {view.autoRead ? <FiVolume2 aria-hidden="true" /> : <FiVolumeX aria-hidden="true" />}
          </button>
        ) : null}
        {view.speaking ? (
          <button type="button" onClick={view.stopSpeaking} aria-label={t('companion.stopSpeaking')} title={t('companion.stopSpeaking')} className={`${ICON_BUTTON} border-rose-200 bg-rose-50 text-rose-700`}>
            <FiSquare aria-hidden="true" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={view.reset}
          disabled={view.entries.length === 0 && !thinking && view.draft.length === 0}
          aria-label={t('companion.clear')}
          title={t('companion.clear')}
          className={ICON_BUTTON}
        >
          <FiRefreshCw aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
