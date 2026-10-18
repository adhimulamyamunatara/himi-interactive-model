import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { FiClock, FiMessageCircle, FiPlus, FiZap } from 'react-icons/fi';
import ChatRobot from '../components/companion/ChatRobot';
import ChatComposer from '../components/chat/ChatComposer';
import ChatMessage from '../components/chat/ChatMessage';
import ChatSidebar from '../components/chat/ChatSidebar';
import TypingIndicator from '../components/chat/TypingIndicator';
import { SubjectBadge } from '../components/common/Badge';
import Card from '../components/common/Card';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Drawer from '../components/common/Drawer';
import Select from '../components/common/Select';
import { voiceInputLanguageFor } from '../utils/voice';
import { useAutoRead } from '../hooks/useAutoRead';
import { usePreferences } from '../hooks/usePreferences';
import { useStopSpeechOnLeave } from '../hooks/useSpeechOutput';
import { useChat } from '../context/ChatContext';
import { useToast } from '../context/ToastContext';
import { useUser } from '../context/UserContext';
import { calculateStreak, getSubjectActivity } from '../utils/messageModel';
import { QUICK_QUESTIONS, SUBJECTS } from '../utils/subjects';

function StatRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

export default function Chat() {
  const { user } = useUser();
  const toast = useToast();
  const {
    conversations,
    activeConversationId,
    activeConversation,
    pendingConversationIds,
    messages,
    allMessages,
    selectedSubject,
    loading,
    loadIssue,
    sendMessage,
    retryMessage,
    setSelectedSubject,
    createConversation,
    selectConversation,
    renameConversation,
    deleteConversation,
    clearActiveConversation,
    dismissLoadIssue
  } = useChat();
  const { preferences } = usePreferences();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const scrollRef = useRef(null);
  const isFirstScrollRef = useRef(true);
  const lastConversationRef = useRef(activeConversationId);

  // Replies read aloud stop when another chat opens, when this one is deleted, and when leaving the page.
  useStopSpeechOnLeave(activeConversationId);

  // New replies are read aloud only when the student turned that on in their profile settings.
  const readableReplies = useMemo(
    () => messages.filter((message) => message.role === 'assistant' && !message.error).map((message) => ({ id: message.id, text: message.content })),
    [messages]
  );
  useAutoRead({ ownerKey: activeConversationId, replies: readableReplies, voiceEnabled: preferences.voiceEnabled, autoReadReplies: preferences.autoReadReplies });

  // Learning stats cover everything the student has asked, across all conversations.
  const stats = useMemo(() => {
    const activity = getSubjectActivity(allMessages);

    return {
      questions: allMessages.filter((message) => message.role === 'user').length,
      replies: allMessages.filter((message) => message.role === 'assistant' && !message.error).length,
      subjectsExplored: activity.length,
      subjectQuestions: activity.find((item) => item.subject === selectedSubject)?.count ?? 0,
      streak: calculateStreak(allMessages)
    };
  }, [allMessages, selectedSubject]);

  const deleteTarget = conversations.find((conversation) => conversation.id === deleteTargetId) ?? null;

  // Keep the conversation in view. A finished assistant reply scrolls to its *start* so long answers
  // are read from the top; everything else (your message, the typing indicator) scrolls to the bottom.
  // Opening a different conversation always jumps (without animation) to its latest message.
  useEffect(() => {
    const container = scrollRef.current;

    if (!container) {
      return;
    }

    const switched = lastConversationRef.current !== activeConversationId;
    lastConversationRef.current = activeConversationId;

    const behavior = isFirstScrollRef.current || switched ? 'auto' : 'smooth';
    isFirstScrollRef.current = false;

    const lastMessage = messages[messages.length - 1];
    const replyElement =
      !switched && !loading && lastMessage?.role === 'assistant'
        ? document.getElementById(`message-${lastMessage.id}`)
        : null;

    if (replyElement) {
      const offset =
        replyElement.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 16;
      container.scrollTo({ top: Math.max(0, offset), behavior });
      return;
    }

    container.scrollTo({ top: container.scrollHeight, behavior });
  }, [messages, loading, activeConversationId]);

  const handleNewChat = useCallback(() => {
    setHistoryOpen(false);
    createConversation();
  }, [createConversation]);

  const handleSelect = useCallback(
    (id) => {
      setHistoryOpen(false);
      selectConversation(id);
    },
    [selectConversation]
  );

  const handleRename = useCallback(
    (id, title) => {
      if (renameConversation(id, title)) {
        toast.success('Chat renamed', 'Your new title is saved in this browser.');
      }
    },
    [renameConversation, toast]
  );

  const requestClear = useCallback(() => {
    setHistoryOpen(false);
    setConfirmOpen(true);
  }, []);

  const confirmClear = () => {
    clearActiveConversation();
    setConfirmOpen(false);
    toast.success('Chat cleared', 'The messages in this chat were deleted. Your other chats are untouched.');
  };

  const requestDelete = useCallback((id) => {
    setHistoryOpen(false);
    setDeleteTargetId(id);
  }, []);

  const confirmDelete = () => {
    const title = deleteTarget?.title;
    deleteConversation(deleteTargetId);
    setDeleteTargetId(null);
    toast.success('Chat deleted', title ? `"${title}" was removed. Your other chats are untouched.` : undefined);
  };

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  const sidebar = (
    <ChatSidebar
      conversations={conversations}
      activeConversationId={activeConversationId}
      pendingConversationIds={pendingConversationIds}
      loadIssue={loadIssue}
      canClearActive={messages.length > 0}
      onNewChat={handleNewChat}
      onSelect={handleSelect}
      onRename={handleRename}
      onDelete={requestDelete}
      onClearActive={requestClear}
      onDismissIssue={dismissLoadIssue}
    />
  );

  return (
    <section className="section-shell py-4 lg:py-6">
      <div className="grid h-[calc(100dvh-7rem)] min-h-[560px] gap-6 xl:grid-cols-[300px_minmax(0,1fr)_300px]">
        <Card className="hidden min-h-0 p-5 xl:block">
          {sidebar}
        </Card>

        <Card className="flex min-h-0 flex-col overflow-hidden p-0">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 xl:hidden"
                aria-label="Open your chats"
              >
                <FiClock aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={handleNewChat}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 xl:hidden"
                aria-label="New chat"
              >
                <FiPlus aria-hidden="true" />
              </button>
              <div className="min-w-0">
                <p className="eyebrow">Learning chat</p>
                <h1 className="truncate text-xl font-bold text-slate-950 sm:text-2xl" title={activeConversation?.title}>
                  {activeConversation?.title ?? 'New chat'}
                </h1>
              </div>
            </div>
            <Select
              label="Subject"
              hideLabel
              className="w-full sm:w-56"
              value={selectedSubject}
              onChange={(event) => setSelectedSubject(event.target.value)}
            >
              {SUBJECTS.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </Select>
          </header>

          <div
            ref={scrollRef}
            className="scrollbar-thin min-h-0 flex-1 space-y-5 overflow-y-auto bg-gradient-to-b from-slate-50/60 to-white px-4 py-6 sm:px-6"
            role="log"
            aria-label="Conversation"
            aria-live="polite"
          >
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <ChatRobot className="h-32 w-32" />
                <h2 className="mt-6 text-2xl font-bold text-slate-950">Hi {firstName}, what shall we learn today?</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
                  Ask me anything about <SubjectBadge subject={selectedSubject} className="align-middle" />. I will
                  explain it step by step, with examples.
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <ChatMessage key={message.id} message={message} onRetry={retryMessage} disabled={loading} voiceEnabled={preferences.voiceEnabled} />
              ))
            )}
            <AnimatePresence>{loading ? <TypingIndicator key="typing" /> : null}</AnimatePresence>
          </div>

          <footer className="scrollbar-thin max-h-[65%] overflow-y-auto border-t border-slate-200/80 bg-white px-4 py-4 sm:px-6">
            <div
              className="scrollbar-thin -mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1"
              role="group"
              aria-label="Suggested questions"
            >
              {QUICK_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  disabled={loading}
                  onClick={() => sendMessage(question)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FiZap className="text-cyan-500" aria-hidden="true" />
                  {question}
                </button>
              ))}
            </div>
            <ChatComposer
              onSend={sendMessage}
              disabled={loading}
              subject={selectedSubject}
              voiceKey={activeConversationId}
              voiceEnabled={preferences.voiceEnabled}
              dictationLanguage={voiceInputLanguageFor(preferences.explanationLanguage)}
            />
          </footer>
        </Card>

        <aside className="scrollbar-thin hidden min-h-0 flex-col gap-6 overflow-y-auto xl:flex" aria-label="Chat details">
          <Card>
            <p className="eyebrow">AI information</p>
            <div className="mt-4 flex items-center gap-4">
              <ChatRobot className="h-20 w-20 shrink-0" />
              <div>
                <p className="font-semibold text-slate-900">HIMI Mentor</p>
                <p className="text-sm text-slate-600">Patient, step-by-step engineering guide.</p>
              </div>
            </div>
            <p className="mt-4 flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <FiMessageCircle className="text-blue-600" aria-hidden="true" />
              Answers are generated by Gemini and can be wrong. Verify important details.
            </p>
          </Card>

          <Card>
            <p className="eyebrow">Selected subject</p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <SubjectBadge subject={selectedSubject} />
              <span className="text-sm text-slate-600">
                {stats.subjectQuestions} question{stats.subjectQuestions === 1 ? '' : 's'}
              </span>
            </div>
          </Card>

          <Card>
            <p className="eyebrow">Learning stats</p>
            <div className="mt-4 space-y-3">
              <StatRow label="Questions asked" value={stats.questions} />
              <StatRow label="Replies received" value={stats.replies} />
              <StatRow label="Learning streak" value={`${stats.streak} day${stats.streak === 1 ? '' : 's'}`} />
              <div>
                <StatRow label="Subjects explored" value={`${stats.subjectsExplored}/${SUBJECTS.length}`} />
                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
                  role="progressbar"
                  aria-label="Subjects explored"
                  aria-valuemin={0}
                  aria-valuemax={SUBJECTS.length}
                  aria-valuenow={stats.subjectsExplored}
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-700"
                    style={{ width: `${(stats.subjectsExplored / SUBJECTS.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>
        </aside>
      </div>

      <Drawer open={historyOpen} onClose={() => setHistoryOpen(false)} title="Your chats">
        {sidebar}
      </Drawer>

      <ConfirmDialog
        open={confirmOpen}
        title="Clear this chat?"
        description="All messages in this chat will be permanently deleted from this browser. The chat and its title stay, and your other chats are not affected."
        confirmLabel="Clear this chat"
        onConfirm={confirmClear}
        onCancel={() => setConfirmOpen(false)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={deleteTarget ? `Delete "${deleteTarget.title}"?` : 'Delete this chat?'}
        description="This chat and all of its messages will be permanently deleted from this browser. Your other chats are not affected. This cannot be undone."
        confirmLabel="Delete chat"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </section>
  );
}
