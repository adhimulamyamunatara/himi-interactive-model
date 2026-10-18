import { FiAlertCircle, FiCheckCircle, FiMinusCircle } from 'react-icons/fi';
import Card from '../common/Card';
import { useT } from '../../i18n/I18nContext';

const STATE_STYLES = {
  tested: { icon: FiCheckCircle, tone: 'text-emerald-700' },
  untested_hardware: { icon: FiAlertCircle, tone: 'text-amber-700' },
  unavailable: { icon: FiMinusCircle, tone: 'text-slate-600' }
};

/** Why a capability is unavailable (translation key suffix), when it is. */
const REASONS = { preview: 'camera', capture: 'camera', face: 'face', emotion: 'emotion', attention: 'attention', gestures: 'gestures' };

/** Honest status of every perception capability. Nothing unavailable or untested is presented as working. */
export default function CapabilityList({ capabilities }) {
  const { t } = useT();

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-lg font-bold text-slate-900">{t('camera.caps.title')}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">{t('camera.caps.subtitle')}</p>
      <ul className="mt-4 space-y-3">
        {capabilities.map((item) => {
          const { icon: Icon, tone } = STATE_STYLES[item.state];
          const reason = item.state === 'unavailable' && REASONS[item.id] ? t(`camera.caps.reason.${REASONS[item.id]}`) : null;

          return (
            <li key={item.id} data-capability={item.id} data-state={item.state} className="rounded-2xl bg-slate-50 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-900">{t(`camera.caps.${item.id}`)}</span>
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${tone}`}>
                  <Icon aria-hidden="true" /> {t(`camera.caps.state.${item.state}`)}
                </span>
              </div>
              {reason ? <p className="mt-1 text-xs leading-5 text-slate-600">{reason}</p> : null}
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs leading-5 text-slate-600">{t('camera.caps.privacy')}</p>
    </Card>
  );
}
