import { FiMessageSquare, FiTrash2 } from 'react-icons/fi';
import { formatRelativeTime } from '../../utils/formatters';
import { getRecentQuestions } from '../../utils/messageModel';
import Button from '../common/Button';
import EmptyState from '../common/EmptyState';
import SidebarItem from './SidebarItem';

/**
 * Recent chats list. Selecting an entry scrolls the conversation to that question.
 */
export default function ChatSidebar({ messages, onSelect, onClear }) {
  const recent = getRecentQuestions(messages, 12);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="pr-10 xl:pr-0">
        <p className="eyebrow">Recent chats</p>
        <h2 className="mt-2 text-xl font-bold text-slate-950">Your questions</h2>
      </div>

      <div className="scrollbar-thin -mr-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-2">
        {recent.length === 0 ? (
          <EmptyState
            compact
            icon={FiMessageSquare}
            title="No chats yet"
            description="Questions you ask will show up here so you can jump back to them."
          />
        ) : (
          recent.map((message) => (
            <SidebarItem
              key={message.id}
              title={message.content}
              subject={message.subject}
              time={formatRelativeTime(message.timestamp)}
              onClick={() => onSelect(message.id)}
            />
          ))
        )}
      </div>

      <Button variant="secondary" size="sm" className="w-full" onClick={onClear} disabled={messages.length === 0}>
        <FiTrash2 aria-hidden="true" /> Clear conversation
      </Button>
    </div>
  );
}
