import { useEffect, useId, useRef, useState } from 'react';
import { FiCheck, FiEdit2, FiTrash2, FiX } from 'react-icons/fi';
import { MAX_MANUAL_TITLE_LENGTH, sanitizeTitle } from '../../utils/chatConversations';
import { SubjectBadge } from '../common/Badge';

const ICON_BUTTON =
  'inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300';

/** Inline title editor. Enter saves, Escape cancels, and an empty title is rejected with a message. */
function RenameForm({ title, onSave, onCancel }) {
  const inputRef = useRef(null);
  const errorId = useId();
  const [draft, setDraft] = useState(title);
  const [error, setError] = useState('');

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = (event) => {
    event.preventDefault();

    if (!sanitizeTitle(draft)) {
      setError('Enter a title.');
      return;
    }

    onSave(draft);
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-blue-300 bg-white px-3 py-2.5 ring-4 ring-blue-100" noValidate>
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          value={draft}
          maxLength={MAX_MANUAL_TITLE_LENGTH}
          aria-label="Conversation title"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            setDraft(event.target.value);
            setError('');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation(); // do not also close the history drawer
              onCancel();
            }
          }}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm font-semibold text-slate-900 outline-none focus:border-blue-400"
        />
        <button type="submit" className={ICON_BUTTON} aria-label="Save title">
          <FiCheck aria-hidden="true" />
        </button>
        <button type="button" className={ICON_BUTTON} aria-label="Cancel renaming" onClick={onCancel}>
          <FiX aria-hidden="true" />
        </button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-rose-600">
          {error}
        </p>
      ) : null}
    </form>
  );
}

/**
 * One conversation in the history list: select it, rename it inline, or delete it.
 * The rename/delete buttons appear on hover or keyboard focus on large screens and are always visible on touch layouts.
 */
export default function SidebarItem({ title, subject, time, active, pending, messageCount, onSelect, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <RenameForm
        title={title}
        onSave={(next) => {
          onRename(next);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? 'true' : undefined}
        className={`w-full rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 ${
          active
            ? 'border-blue-300 bg-blue-50 shadow-sm'
            : 'border-transparent bg-slate-50/80 hover:border-blue-200 hover:bg-blue-50/70'
        }`}
      >
        <p className={`truncate pr-14 text-sm font-semibold xl:pr-0 xl:group-focus-within:pr-14 xl:group-hover:pr-14 ${active ? 'text-blue-900' : 'text-slate-900'}`} title={title}>
          {title}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <SubjectBadge subject={subject} />
          <span className="shrink-0 text-xs text-slate-500">
            {pending ? 'Replying…' : messageCount === 0 ? 'No messages' : time}
          </span>
        </div>
      </button>
      <div className="absolute right-2.5 top-2.5 flex gap-0.5 rounded-xl bg-white/90 p-0.5 opacity-100 shadow-sm focus-within:opacity-100 xl:opacity-0 xl:group-hover:opacity-100">
        <button type="button" className={ICON_BUTTON} aria-label={`Rename conversation: ${title}`} onClick={() => setEditing(true)}>
          <FiEdit2 aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={`${ICON_BUTTON} hover:!bg-rose-50 hover:!text-rose-600`}
          aria-label={`Delete conversation: ${title}`}
          onClick={onDelete}
        >
          <FiTrash2 aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
