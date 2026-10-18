import { useId, useState } from 'react';
import { FiCheckCircle, FiMinusCircle } from 'react-icons/fi';
import Card from '../common/Card';
import SegmentedControl from '../common/SegmentedControl';
import { useVoiceAvailability } from '../../hooks/useVoiceAvailability';
import { usePreferences } from '../../hooks/usePreferences';
import { useT } from '../../i18n/I18nContext';
import { LANGUAGES } from '../../utils/preferences';
import { getSpeechInputSupport } from '../../utils/speechInput';
import { isSpeechOutputSupported } from '../../utils/speechOutput';

function Switch({ label, hint, checked, onChange, disabled = false }) {
  const id = useId();

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-semibold text-slate-900">
          {label}
        </label>
        <p id={`${id}-hint`} className="mt-1 text-xs leading-5 text-slate-600">
          {hint}
        </p>
      </div>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-describedby={`${id}-hint`}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-slate-300 transition checked:bg-blue-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50 relative before:absolute before:left-0.5 before:top-0.5 before:h-5 before:w-5 before:rounded-full before:bg-paper before:transition checked:before:translate-x-5"
      />
    </div>
  );
}

function StatusRow({ label, state, text }) {
  const good = state === 'yes';
  const Icon = good ? FiCheckCircle : FiMinusCircle;

  return (
    <li className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-2.5 text-sm">
      <span className="text-slate-700">{label}</span>
      <span className={`inline-flex items-center gap-1.5 font-semibold ${good ? 'text-emerald-700' : 'text-slate-600'}`}>
        <Icon aria-hidden="true" /> {text}
      </span>
    </li>
  );
}

/**
 * Interface and explanation language, and the voice switches. The status list reports what this browser can
 * actually do, so a feature that is not available is never presented as working.
 */
export default function VoiceLanguageSettings() {
  const { t } = useT();
  const { preferences, update } = usePreferences();
  const [dictation] = useState(() => getSpeechInputSupport().supported);
  const [readAloud] = useState(() => isSpeechOutputSupported());
  const teluguVoice = useVoiceAvailability('te-IN');
  const options = LANGUAGES.map((language) => ({ value: language.code, label: language.nativeLabel }));

  return (
    <Card>
      <h2 className="text-2xl font-bold text-slate-950">{t('settings.voice.title')}</h2>
      <p className="mt-1 text-sm text-slate-600">{t('settings.voice.subtitle')}</p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <SegmentedControl legend={t('language.interface')} options={options} value={preferences.uiLanguage} onChange={(value) => update({ uiLanguage: value })} />
        <SegmentedControl legend={t('language.explanation')} options={options} value={preferences.explanationLanguage} onChange={(value) => update({ explanationLanguage: value })} />
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-600">{t('language.explanationHint')}</p>

      <div className="mt-6 space-y-5 border-t border-slate-100 pt-6">
        <Switch
          label={t('settings.voice.enabled')}
          hint={t('settings.voice.enabledHint')}
          checked={preferences.voiceEnabled}
          onChange={(value) => update({ voiceEnabled: value })}
        />
        <Switch
          label={t('settings.voice.autoRead')}
          hint={preferences.voiceEnabled ? t('settings.voice.autoReadHint') : t('settings.voice.autoReadOff')}
          checked={preferences.voiceEnabled && preferences.autoReadReplies}
          disabled={!preferences.voiceEnabled}
          onChange={(value) => update({ autoReadReplies: value })}
        />
        <Switch
          label={t('settings.camera.enabled')}
          hint={t('settings.camera.hint')}
          checked={preferences.cameraEnabled}
          onChange={(value) => update({ cameraEnabled: value })}
        />
        {!preferences.voiceEnabled ? (
          <p role="status" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {t('settings.voice.offNote')}
          </p>
        ) : null}
      </div>

      <div className="mt-6 border-t border-slate-100 pt-6">
        <h3 className="text-sm font-semibold text-slate-900">{t('settings.voice.support')}</h3>
        <ul className="mt-3 space-y-2">
          <StatusRow label={t('settings.voice.dictation')} state={dictation ? 'yes' : 'no'} text={dictation ? t('settings.voice.yes') : t('settings.voice.no')} />
          <StatusRow label={t('settings.voice.readAloud')} state={readAloud ? 'yes' : 'no'} text={readAloud ? t('settings.voice.yes') : t('settings.voice.no')} />
          <StatusRow
            label={t('settings.voice.teluguVoice')}
            state={readAloud && teluguVoice === 'available' ? 'yes' : 'no'}
            text={!readAloud ? t('settings.voice.no') : teluguVoice === 'available' ? t('settings.voice.yes') : teluguVoice === 'missing' ? t('settings.voice.missing') : t('settings.voice.unknown')}
          />
        </ul>
        <p className="mt-3 text-xs leading-5 text-slate-600">{t('settings.voice.teluguHint')}</p>
        <p className="mt-2 text-xs leading-5 text-slate-600">{t('settings.voice.privacy')}</p>
      </div>
    </Card>
  );
}
