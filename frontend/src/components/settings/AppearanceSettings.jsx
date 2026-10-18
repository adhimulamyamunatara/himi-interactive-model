import Card from '../common/Card';
import SegmentedControl from '../common/SegmentedControl';
import { useTheme } from '../../hooks/useTheme';
import { useT } from '../../i18n/I18nContext';
import { THEMES } from '../../utils/preferences';

/** Light, dark or follow-the-device. The choice is stored on this device only. */
export default function AppearanceSettings() {
  const { t } = useT();
  const { choice, resolved, setTheme } = useTheme();

  return (
    <Card>
      <h2 className="text-2xl font-bold text-slate-950">{t('settings.appearance.title')}</h2>
      <p className="mt-1 text-sm text-slate-600">{t('settings.appearance.subtitle')}</p>

      <div className="mt-6 max-w-xl">
        <SegmentedControl
          legend={t('settings.appearance.theme')}
          options={THEMES.map((theme) => ({ value: theme, label: t(`theme.${theme}`) }))}
          value={choice}
          onChange={setTheme}
        />
        <p className="mt-3 text-xs text-slate-600" aria-live="polite">
          {t('settings.appearance.current', { theme: t(`theme.${resolved}`) })}
        </p>
      </div>
    </Card>
  );
}
