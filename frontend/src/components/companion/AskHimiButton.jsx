import { FiMessageCircle } from 'react-icons/fi';
import Button from '../common/Button';
import { useCompanion } from '../../context/CompanionContext';
import { useT } from '../../i18n/I18nContext';

/**
 * "Ask HIMI about this". It opens the companion with `prompt` in the message box, built from what is really
 * on the page. It never sends anything: the student reads and edits the text, then presses Send.
 */
export default function AskHimiButton({ prompt, label, variant = 'secondary', size = 'md', className = '' }) {
  const { t } = useT();
  const { askHimi } = useCompanion();

  return (
    <Button type="button" variant={variant} size={size} className={className} onClick={() => askHimi(prompt)}>
      <FiMessageCircle aria-hidden="true" /> {label ?? t('companion.askAbout')}
    </Button>
  );
}
