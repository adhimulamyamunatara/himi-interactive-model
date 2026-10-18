import { Link, useLocation } from 'react-router-dom';
import { FiMic, FiSend, FiSquare } from 'react-icons/fi';
import VoicePanel from '../voice/VoicePanel';
import { useT } from '../../i18n/I18nContext';
import { quickActionsFor } from '../../utils/companionIntents';

const SHORTCUT =
  'inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200';

/** Shortcuts, the optional voice panel, and the message box. Typing always works, whatever the microphone does. */
export default function CompanionComposer({ view, textareaRef, idPrefix, shortcutLimit = 4, onNavigate }) {
  const { t } = useT();
  const { pathname } = useLocation();
  const { thinking, voice, showVoice, voiceAllowed, listening } = view;
  const shortcuts = quickActionsFor(pathname, { subject: view.subject, limit: shortcutLimit });
  const inputId = `${idPrefix}-input`;

  return (
    <div className="border-t border-slate-200/80 px-4 pb-4 pt-3">
      <div className="mb-3" role="group" aria-label={t('companion.shortcuts')}>
        <p className="mb-1.5 text-xs font-semibold text-slate-600">{t('companion.shortcuts')}</p>
        <div className="flex flex-wrap gap-2">
          {shortcuts.map((action) =>
            action.kind === 'draft' ? (
              <button
                key={action.id}
                type="button"
                className={SHORTCUT}
                onClick={() => {
                  view.setDraft(t(`companion.draft.${action.id}`));
                  view.requestFocus();
                }}
              >
                {t(`companion.action.${action.id}`)}
              </button>
            ) : (
              <Link key={action.id} to={action.to} onClick={onNavigate} className={SHORTCUT}>
                {t(`companion.action.${action.id}`)}
              </Link>
            )
          )}
        </div>
      </div>

      {showVoice ? <VoicePanel voice={voice} onClose={view.closeVoice} submitLabel={t('companion.send')} /> : null}

      {!voiceAllowed ? (
        <p className="mb-2 text-xs leading-5 text-slate-600">
          {t('companion.voiceOff')}{' '}
          <Link to="/profile" onClick={onNavigate} className="font-semibold text-blue-700 underline">
            {t('companion.voiceSettings')}
          </Link>
        </p>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          view.submit();
        }}
        className="flex items-end gap-2"
      >
        <div className="min-w-0 flex-1">
          <label htmlFor={inputId} className="sr-only">
            {t('companion.input')}
          </label>
          <textarea
            id={inputId}
            ref={textareaRef}
            rows={1}
            value={view.draft}
            maxLength={view.maxLength}
            onChange={(event) => view.setDraft(event.target.value)}
            onKeyDown={view.onKeyDown}
            placeholder={t('companion.placeholder')}
            enterKeyHint="send"
            className="max-h-36 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />
        </div>

        {voiceAllowed ? (
          <button
            type="button"
            onClick={view.toggleVoice}
            aria-pressed={showVoice}
            aria-label={t('voice.input')}
            title={t('voice.input')}
            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 ${
              listening
                ? 'animate-pulse border-rose-300 bg-rose-50 text-rose-700 motion-reduce:animate-none'
                : showVoice
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
            }`}
          >
            <FiMic aria-hidden="true" />
          </button>
        ) : null}

        {thinking ? (
          <button
            type="button"
            onClick={view.cancel}
            aria-label={t('companion.stop')}
            title={t('companion.stop')}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
          >
            <FiSquare aria-hidden="true" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!view.canSend}
            aria-label={t('companion.send')}
            title={t('companion.send')}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiSend aria-hidden="true" />
          </button>
        )}
      </form>

      <p className="mt-2 text-[11px] leading-4 text-slate-600">{t('companion.note')}</p>
    </div>
  );
}
