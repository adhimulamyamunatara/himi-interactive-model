import { FiMessageSquare, FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import { formatRelativeTime } from '../../utils/formatters';
import Button from '../common/Button';
import EmptyState from '../common/EmptyState';
import SidebarItem from './SidebarItem';

const LOAD_ISSUE_MESSAGES = {
  unavailable: 'Your browser is blocking local storage, so chats will be lost when you refresh.',
  unreadable: 'Your saved chats could not be read, so you are starting fresh. A copy of the damaged data was kept in this browser.',
  unsupported: 'Your saved chats were created by a newer version of HIMI, so they were not loaded. A copy was kept in this browser.',
  'legacy-unreadable': 'Your earlier chat history could not be recovered. It was left untouched in this browser.'
};

function describeLoadIssue(issue) {
  if (issue.type === 'partial' || issue.type === 'legacy-partial') {
    const count = issue.dropped;
    return `${count} damaged message${count === 1 ? ' was' : 's were'} skipped while loading your saved chats. Everything else was restored.`;
  }

  return LOAD_ISSUE_MESSAGES[issue.type] ?? 'Some saved chat data could not be loaded.';
}

/**
 * Conversation history: start a new chat, open an older one, rename or delete it.
 * Chats are saved in this browser only.
 */
export default function ChatSidebar({
  conversations,
  activeConversationId,
  pendingConversationIds,
  loadIssue,
  onNewChat,
  onSelect,
  onRename,
  onDelete,
  onClearActive,
  onDismissIssue,
  canClearActive
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="pr-10 xl:pr-0">
        <p className="eyebrow">Chats</p>
        <h2 className="mt-2 text-xl font-bold text-slate-950">Your conversations</h2>
      </div>

      <Button size="sm" className="w-full" onClick={onNewChat}>
        <FiPlus aria-hidden="true" /> New chat
      </Button>

      {loadIssue ? (
        <div role="status" className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900">
          <p className="min-w-0 flex-1">{describeLoadIssue(loadIssue)}</p>
          <button
            type="button"
            onClick={onDismissIssue}
            className="rounded-md p-0.5 text-amber-800 hover:bg-amber-100"
            aria-label="Dismiss this notice"
          >
            <FiX aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div className="scrollbar-thin -mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
        {conversations.length === 0 ? (
          <EmptyState
            compact
            icon={FiMessageSquare}
            title="No chats yet"
            description="Type a question to start your first chat. Each chat is kept separate, so you can have one per topic."
          />
        ) : (
          <ul className="space-y-2" aria-label="Conversations">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <SidebarItem
                  title={conversation.title}
                  subject={conversation.subject}
                  time={formatRelativeTime(conversation.updatedAt)}
                  messageCount={conversation.messages.length}
                  active={conversation.id === activeConversationId}
                  pending={pendingConversationIds.includes(conversation.id)}
                  onSelect={() => onSelect(conversation.id)}
                  onRename={(title) => onRename(conversation.id, title)}
                  onDelete={() => onDelete(conversation.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-center text-xs text-slate-500">Saved in this browser only.</p>

      <Button variant="secondary" size="sm" className="w-full" onClick={onClearActive} disabled={!canClearActive}>
        <FiTrash2 aria-hidden="true" /> Clear this chat
      </Button>
    </div>
  );
}
