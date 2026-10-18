import { FiMic } from 'react-icons/fi';
import CompanionComposer from './CompanionComposer';
import CompanionControls from './CompanionControls';
import CompanionTranscript from './CompanionTranscript';
import HimiRobot from './HimiRobot';
import Card from '../common/Card';
import { useUser } from '../../context/UserContext';
import { useCompanionSpeech, useCompanionView } from '../../hooks/useCompanionView';
import { useT } from '../../i18n/I18nContext';
import { robotStateLabelKey } from '../../utils/companionState';

/**
 * HIMI as the centre of the dashboard: the robot beside the conversation. It is a second view of the same
 * companion the floating dock shows (one conversation, one voice), and it is never mounted together with the
 * dock, so a reply is never spoken twice.
 */
export default function HimiStage() {
  const { t } = useT();
  const { user } = useUser();
  const { view, textareaRef } = useCompanionView();
  const stateLabel = t(robotStateLabelKey(view.robotState));
  const firstName = user?.name?.split(' ')[0] || t('companion.friend');

  useCompanionSpeech();

  return (
    <section aria-labelledby="himi-stage-title">
      <Card className="overflow-hidden p-0">
        <div className="grid lg:grid-cols-[19rem_minmax(0,1fr)]">
          <div className="flex flex-col items-center gap-4 border-b border-slate-200/80 bg-gradient-to-b from-blue-50 via-white to-violet-50 p-6 text-center lg:border-b-0 lg:border-r">
            <HimiRobot state={view.robotState} className="h-40 w-40 sm:h-44 sm:w-44" decorative />
            <div>
              <h2 id="himi-stage-title" className="text-xl font-black tracking-tight text-slate-950">
                {t('companion.stage.title')}
              </h2>
              <p role="status" className="mt-1 inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">
                {stateLabel}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-600">{t('companion.stage.subtitle')}</p>
            </div>
            <button
              type="button"
              onClick={view.openLive}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-5 py-3 text-sm font-bold text-white shadow-glow transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
            >
              <FiMic aria-hidden="true" /> {t('companion.live.open')}
            </button>
            <p className="-mt-2 text-xs leading-5 text-slate-600">{t('companion.live.openHint')}</p>
            <div className="w-full text-left">
              <CompanionControls view={view} idPrefix="stage" compact />
            </div>
          </div>

          <div className="flex h-[34rem] min-h-0 flex-col">
            <CompanionTranscript
              entries={view.entries}
              thinking={view.thinking}
              greeting={t('companion.greeting', { name: firstName, subject: view.subject })}
              voiceEnabled={view.voiceAllowed}
              busy={view.thinking}
              onAsk={view.send}
              onRetry={view.retry}
              onCancel={view.cancel}
            />
            <CompanionComposer view={view} textareaRef={textareaRef} idPrefix="stage" shortcutLimit={6} />
          </div>
        </div>
      </Card>
    </section>
  );
}
