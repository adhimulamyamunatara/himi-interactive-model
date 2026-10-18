import HimiRobot from './HimiRobot';
import { useChat } from '../../context/ChatContext';
import { useSpeechOutput } from '../../hooks/useSpeechOutput';
import { useT } from '../../i18n/I18nContext';
import { deriveRobotState, robotStateLabelKey } from '../../utils/companionState';

/**
 * The same HIMI robot on the Chat page, driven by that page's real conversation: thinking while a reply is
 * pending, speaking while one of this chat's replies is being read aloud, and an error pose after a failure.
 * The Chat page has its own conversation, so the floating companion stays out of it.
 */
export default function ChatRobot({ className = 'h-28 w-28' }) {
  const { t } = useT();
  const { messages, loading } = useChat();
  const { speakingId } = useSpeechOutput();
  const last = messages[messages.length - 1];
  const state = deriveRobotState({
    thinking: loading,
    speaking: typeof speakingId === 'string' && messages.some((message) => message.id === speakingId),
    error: !loading && last?.error === true
  });

  return <HimiRobot state={state} className={className} label={t('companion.robotLabel', { state: t(robotStateLabelKey(state)) })} />;
}
