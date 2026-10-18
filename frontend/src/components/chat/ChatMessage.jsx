import { memo } from 'react';
import { motion } from 'framer-motion';
import { FiAlertTriangle, FiCheck, FiCopy, FiRefreshCw } from 'react-icons/fi';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { formatTime } from '../../utils/formatters';
import AssistantAvatar from '../avatar/AssistantAvatar';
import { SubjectBadge } from '../common/Badge';
import ListenButton from '../voice/ListenButton';
import UserAvatar from '../common/UserAvatar';
import MarkdownMessage from './MarkdownMessage';

function UserBubble({ message }) {
  return (
    <div className="flex items-end justify-end gap-3">
      <div className="flex min-w-0 max-w-[88%] flex-col items-end gap-1.5 sm:max-w-[75%]">
        <div className="max-w-full whitespace-pre-wrap break-words rounded-3xl rounded-br-lg bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 px-5 py-3 text-sm leading-6 text-white shadow-glow">
          {message.content}
        </div>
        <div className="flex items-center gap-2 pr-1">
          <SubjectBadge subject={message.subject} />
          <time dateTime={message.timestamp} className="text-xs text-slate-500">
            {formatTime(message.timestamp)}
          </time>
        </div>
      </div>
      <UserAvatar size="sm" className="!h-9 !w-9 !rounded-xl !text-sm" />
    </div>
  );
}

function AssistantBubble({ message, onRetry, disabled, voiceEnabled }) {
  const { copied, copy } = useCopyToClipboard();

  if (message.error) {
    return (
      <div className="flex items-end gap-3">
        <AssistantAvatar size="sm" />
        <div role="alert" className="max-w-[88%] rounded-3xl rounded-bl-lg border border-rose-200 bg-rose-50 px-5 py-4 sm:max-w-[75%]">
          <p className="flex items-center gap-2 text-sm font-semibold text-rose-700">
            <FiAlertTriangle aria-hidden="true" /> Something went wrong
          </p>
          <p className="mt-1 text-sm leading-6 text-rose-700/90">{message.content}</p>
          <button
            type="button"
            onClick={() => onRetry(message.id)}
            disabled={disabled}
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiRefreshCw aria-hidden="true" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-end gap-3">
      <AssistantAvatar size="sm" />
      <div className="min-w-0 max-w-[92%] sm:max-w-[80%]">
        <div className="rounded-3xl rounded-bl-lg border border-slate-200 bg-white px-5 py-3 shadow-sm">
          <MarkdownMessage content={message.content} />
        </div>
        <div className="mt-1.5 flex items-center gap-2 pl-1">
          <SubjectBadge subject={message.subject} />
          <time dateTime={message.timestamp} className="text-xs text-slate-500">
            {formatTime(message.timestamp)}
          </time>
          <button
            type="button"
            onClick={() => copy(message.content)}
            className="ml-1 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 opacity-100 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            aria-label={copied ? 'Reply copied' : 'Copy reply'}
          >
            {copied ? <FiCheck aria-hidden="true" className="text-emerald-600" /> : <FiCopy aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          {voiceEnabled ? <ListenButton messageId={message.id} text={message.content} /> : null}
        </div>
      </div>
    </div>
  );
}

/** A single chat bubble. Memoised so typing in the composer does not re-render the whole history. */
function ChatMessage({ message, onRetry, disabled = false, voiceEnabled = true }) {
  return (
    <motion.article
      id={`message-${message.id}`}
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      aria-label={message.role === 'user' ? 'Your message' : 'HIMI reply'}
    >
      {message.role === 'user' ? (
        <UserBubble message={message} />
      ) : (
        <AssistantBubble message={message} onRetry={onRetry} disabled={disabled} voiceEnabled={voiceEnabled} />
      )}
    </motion.article>
  );
}

export default memo(ChatMessage);
