import { FiMoon, FiSun } from 'react-icons/fi';
import { useT } from '../../i18n/I18nContext';
import { useTheme } from '../../hooks/useTheme';
import { oppositeTheme } from '../../utils/theme';

/**
 * Header button that flips between light and dark. It always shows what you would switch TO, and sets an explicit
 * choice (the "follow my device" option lives in the profile settings).
 */
export default function ThemeToggle({ className = '' }) {
  const { t } = useT();
  const { resolved, setTheme } = useTheme();
  const next = oppositeTheme(resolved);
  const Icon = next === 'dark' ? FiMoon : FiSun;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={t(next === 'dark' ? 'theme.switchToDark' : 'theme.switchToLight')}
      title={t(next === 'dark' ? 'theme.switchToDark' : 'theme.switchToLight')}
      data-theme-toggle={resolved}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:border-blue-200 hover:bg-slate-50 ${className}`}
    >
      <Icon aria-hidden="true" />
    </button>
  );
}
