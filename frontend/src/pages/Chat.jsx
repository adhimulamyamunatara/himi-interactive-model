import { useEffect, useMemo, useRef, useState } from 'react';
import { FiBookOpen, FiMessageCircle, FiMic, FiPlus, FiSend, FiTrash2 } from 'react-icons/fi';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import Select from '../components/common/Select';
import SidebarItem from '../components/chat/SidebarItem';
import ChatMessage from '../components/chat/ChatMessage';
import TypingIndicator from '../components/chat/TypingIndicator';
import { useChat } from '../context/ChatContext';
import { QUICK_QUESTIONS, SUBJECTS } from '../utils/subjects';

export default function Chat() {
  const { messages, selectedSubject, loading, sendMessage, setSelectedSubject, clearConversation } = useChat();
  const [draft, setDraft] = useState('');
  const bottomRef = useRef(null);
  const subjectItems = useMemo(() => SUBJECTS, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const content = draft;
    setDraft('');
    await sendMessage(content);
  };

  const handleQuickQuestion = async (question) => {
    await sendMessage(question);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit(event);
    }
  };

  return (
    <section className="section-shell py-10 lg:py-14">
      <div className="grid min-h-[calc(100vh-200px)] gap-6 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <Card className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Chat history</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950">Past sessions</h1>
          </div>
          <Button variant="secondary" className="justify-start" onClick={() => void clearConversation()}>
            <FiTrash2 /> Clear Conversation
          </Button>
          <div className="space-y-3">
            <SidebarItem title="Operating Systems" subtitle="CPU scheduling and synchronization" />
            <SidebarItem title="Computer Networks" subtitle="TCP, HTTP, and routing concepts" />
            <SidebarItem title="DBMS" subtitle="Normalization and transactions" />
          </div>
        </Card>

        <Card className="flex flex-col">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Conversation area</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">{selectedSubject}</h2>
              <p className="mt-2 text-sm text-slate-500">Functional chat with local history and FastAPI integration.</p>
            </div>
            <Button variant="secondary" type="button">
              <FiMic /> Voice
            </Button>
          </div>

          <div className="mt-5 grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {QUICK_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => void handleQuickQuestion(question)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50"
              >
                {question}
              </button>
            ))}
          </div>

          <div className="mt-6 flex-1 space-y-4 overflow-y-auto pr-1">
            {messages.map((message) => (
              <ChatMessage key={message.id} role={message.role} text={message.content} />
            ))}
            {loading ? <TypingIndicator /> : null}
            <div ref={bottomRef} />
          </div>

          <form className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-4 lg:flex-row">
              <label className="flex-1">
                <span className="mb-2 block text-sm font-medium text-slate-700">Message</span>
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={3}
                  placeholder="Ask HIMI anything about engineering topics..."
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                />
              </label>
              <div className="flex gap-3 lg:flex-col">
                <Button type="button" variant="secondary" className="flex-1 lg:flex-none">
                  <FiBookOpen /> Subject
                </Button>
                <Button type="button" variant="secondary" className="flex-1 lg:flex-none">
                  <FiPlus /> New
                </Button>
                <Button type="submit" className="flex-1 lg:flex-none" disabled={loading || !draft.trim()}>
                  <FiSend /> Send
                </Button>
              </div>
            </div>
          </form>
        </Card>

        <div className="space-y-6">
          <Card>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">AI information</p>
            <div className="mt-5 flex items-center gap-4 rounded-3xl bg-slate-50 p-4">
              <div className="rounded-2xl bg-blue-600 p-3 text-white">
                <FiMessageCircle />
              </div>
              <div>
                <p className="font-semibold text-slate-900">HIMI Mentor</p>
                <p className="text-sm text-slate-500">FastAPI powered response flow.</p>
              </div>
            </div>
          </Card>

          <Card>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Selected subject</p>
            <div className="mt-5 space-y-3">
              <Select value={selectedSubject} onChange={(event) => setSelectedSubject(event.target.value)}>
                {subjectItems.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </Select>
            </div>
          </Card>

          <Card>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Learning stats</p>
            <div className="mt-5 space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
                  <span>Lessons completed</span>
                  <span>{messages.filter((message) => message.role === 'assistant').length}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 w-2/3 rounded-full bg-gradient-to-r from-blue-600 to-cyan-400" />
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
                  <span>Focus sessions</span>
                  <span>{messages.filter((message) => message.role === 'user').length}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 w-1/2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-400" />
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
                  <span>Revision readiness</span>
                  <span>{messages.length > 0 ? 'Growing' : 'Starting'}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 w-[78%] rounded-full bg-gradient-to-r from-cyan-600 to-sky-400" />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
