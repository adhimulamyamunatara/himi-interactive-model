import { useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../common/Card';
import { useT } from '../../i18n/I18nContext';
import { CHECK_IN_OPTIONS, CHECK_IN_SUGGESTIONS } from '../../utils/camera';

/**
 * Self-report check-in. The student chooses how they feel; the suggestions are fixed, visible rules. Nothing is
 * inferred from the camera, stored, ranked or sent anywhere: the choice only lives in this component.
 */
export default function CheckIn() {
  const { t } = useT();
  const [choice, setChoice] = useState(null);

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-lg font-bold text-slate-900">{t('camera.checkin.title')}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">{t('camera.checkin.subtitle')}</p>

      <div role="group" aria-label={t('camera.checkin.title')} className="mt-4 grid grid-cols-2 gap-2">
        {CHECK_IN_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={choice === option}
            onClick={() => setChoice(choice === option ? null : option)}
            className={`rounded-2xl border px-3 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 ${
              choice === option ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-slate-50'
            }`}
          >
            {t(`camera.checkin.${option}`)}
          </button>
        ))}
      </div>

      {choice ? (
        <div role="status" className="mt-4 rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-900">{t(`camera.checkin.say.${choice}`)}</p>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
            {CHECK_IN_SUGGESTIONS[choice].map((tip) => (
              <li key={tip.key}>
                {tip.to ? (
                  <Link to={tip.to} className="font-semibold text-blue-700 underline">
                    {t(tip.key)}
                  </Link>
                ) : (
                  t(tip.key)
                )}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setChoice(null)} className="mt-3 text-xs font-semibold text-slate-600 underline">
            {t('camera.checkin.clear')}
          </button>
        </div>
      ) : null}
    </Card>
  );
}
