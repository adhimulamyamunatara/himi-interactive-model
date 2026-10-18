import { useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiChevronDown, FiMinus } from 'react-icons/fi';
import CompanionComposer from './CompanionComposer';
import CompanionControls, { ICON_BUTTON } from './CompanionControls';
import CompanionTranscript from './CompanionTranscript';
import HimiRobot from './HimiRobot';
import { useUser } from '../../context/UserContext';
import { useCompanionSpeech, useCompanionView } from '../../hooks/useCompanionView';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useT } from '../../i18n/I18nContext';
import { isDockVisibleOn } from '../../utils/companionIntents';
import { robotStateLabelKey } from '../../utils/companionState';

const PANEL_ID = 'himi-companion-panel';
const isWide = () => typeof window !== 'undefined' && window.matchMedia?.('(min-width: 768px)').matches === true;

function DockInner() {
  const { t } = useT();
  const { user } = useUser();
  const { view, textareaRef } = useCompanionView();
  const { open, setOpen, robotState } = view;
  const stateLabel = t(robotStateLabelKey(robotState));
  const firstName = user?.name?.split(' ')[0] || t('companion.friend');

  // Reads new answers aloud when the student asked for that, and stops speech when the dock goes away.
  useCompanionSpeech();

  const minimize = useCallback(() => {
    // The microphone never stays on behind a closed panel.
    view.closeVoice();
    setOpen(false);
  }, [setOpen, view]);

  const expand = () => {
    setOpen(true);
    view.requestFocus();
  };

  // Following a link from the panel: a phone's full-screen sheet gets out of the way; the desktop panel stays.
  const handleNavigate = useCallback(() => {
    if (!isWide()) {
      minimize();
    }
  }, [minimize]);

  useEscapeKey(minimize, open);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[55] flex flex-col items-end gap-3 print:hidden">
      {open ? (
        <>
          <div className="pointer-events-auto fixed inset-0 z-[55] bg-slate-950/40 md:hidden" onClick={minimize} aria-hidden="true" />
          <section
            id={PANEL_ID}
            role="dialog"
            aria-modal="false"
            aria-label={t('companion.panelLabel')}
            className="pointer-events-auto fixed inset-x-0 bottom-0 z-[56] flex h-[88dvh] flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-soft md:static md:h-[min(40rem,calc(100dvh-7.5rem))] md:w-[26rem] md:rounded-3xl"
          >
            <header className="flex items-center gap-3 border-b border-slate-200/80 bg-gradient-to-r from-blue-50 to-violet-50 px-4 py-3">
              <HimiRobot state={robotState} className="h-16 w-16 shrink-0" decorative />
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-black tracking-tight text-slate-950">{t('companion.title')}</h2>
                <p role="status" className="text-sm font-semibold text-blue-700">
                  {stateLabel}
                </p>
                <p className="truncate text-xs text-slate-600">{t('companion.tagline')}</p>
              </div>
              <button type="button" onClick={minimize} aria-label={t('companion.close')} title={t('companion.close')} className={ICON_BUTTON}>
                <FiMinus aria-hidden="true" />
              </button>
            </header>

            <div className="border-b border-slate-200/80 px-4 py-3">
              <CompanionControls view={view} idPrefix="dock" compact />
            </div>

            <CompanionTranscript
              entries={view.entries}
              thinking={view.thinking}
              greeting={t('companion.greeting', { name: firstName, subject: view.subject })}
              voiceEnabled={view.voiceAllowed}
              busy={view.thinking}
              onAsk={view.send}
              onRetry={view.retry}
              onCancel={view.cancel}
              onNavigate={handleNavigate}
            />

            <CompanionComposer view={view} textareaRef={textareaRef} idPrefix="dock" shortcutLimit={4} onNavigate={handleNavigate} />

            <footer className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-200/80 bg-slate-50 px-4 py-2 text-xs">
              <Link to="/chat" onClick={handleNavigate} className="font-semibold text-blue-700 underline">
                {t('companion.openChat')}
              </Link>
              <Link to="/mentor" onClick={handleNavigate} className="font-semibold text-blue-700 underline">
                {t('companion.openMentor')}
              </Link>
            </footer>
          </section>
        </>
      ) : null}

      {/* One button toggles the panel. While the panel is open on a phone it is covered by the sheet. */}
      {open ? (
        <button
          type="button"
          onClick={minimize}
          aria-expanded="true"
          aria-controls={PANEL_ID}
          aria-label={t('companion.close')}
          title={t('companion.close')}
          className="pointer-events-auto hidden h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-soft transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 md:inline-flex"
        >
          <FiChevronDown aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          onClick={expand}
          aria-expanded="false"
          aria-controls={PANEL_ID}
          aria-label={t('companion.launchLabel')}
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white py-1.5 pl-1.5 pr-2 shadow-glow-soft transition hover:shadow-glow focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 sm:pr-4"
        >
          <HimiRobot state={robotState} className="h-12 w-12" decorative />
          <span className="hidden text-sm font-bold text-slate-900 sm:inline">{t('companion.launch')}</span>
          {/* Names the state for screen readers and for anyone who cannot see the animation. */}
          <span role="status" className="sr-only">
            {stateLabel}
          </span>
          {robotState !== 'idle' ? <span className="hidden text-xs font-semibold text-blue-700 sm:inline">{stateLabel}</span> : null}
        </button>
      )}
    </div>
  );
}

/** The floating HIMI companion. It only appears for signed-in students, on pages that have no conversation of their own. */
export default function CompanionDock() {
  const { user } = useUser();
  const { pathname } = useLocation();

  if (!user || !isDockVisibleOn(pathname)) {
    return null;
  }

  return <DockInner />;
}
