import { FiBook, FiMessageCircle, FiPlus, FiPlay, FiZap } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import ChatPreview from '../components/dashboard/ChatPreview';
import QuickAction from '../components/dashboard/QuickAction';
import StatCard from '../components/dashboard/StatCard';
import { useChat } from '../context/ChatContext';
import { useUser } from '../context/UserContext';
import { formatGreeting } from '../utils/formatters';
import { DEFAULT_SUBJECT } from '../utils/subjects';

export default function Dashboard() {
  const { user } = useUser();
  const { messages, selectedSubject } = useChat();
  const greeting = formatGreeting(user?.name || 'Student');
  const todayDate = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const userMessageCount = messages.filter((message) => message.role === 'user').length;
  const recentConversationCount = messages.slice(-4).length;

  return (
    <section className="section-shell py-10 lg:py-14">
      <div className="grid gap-6">
        <Card className="bg-gradient-to-r from-slate-950 to-slate-800 text-white">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Welcome</p>
              <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{greeting}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                Your dashboard summarizes today's learning context and lets you jump back into the chat
                workspace immediately.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
              <p className="text-sm text-slate-300">Today's date</p>
              <p className="mt-2 text-2xl font-bold">{todayDate}</p>
              <p className="mt-3 text-sm text-slate-300">Keep learning from your last session.</p>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-3">
          <StatCard
            title="Selected subject"
            value={selectedSubject || DEFAULT_SUBJECT}
            caption="The active subject used throughout chat and quick actions."
            accent="blue"
          />
          <StatCard
            title="Total messages"
            value={String(messages.length)}
            caption="Conversation history saved locally in the browser."
            accent="purple"
          />
          <StatCard
            title="Recent conversation count"
            value={String(recentConversationCount)}
            caption="Recent turns available for quick continuation."
            accent="cyan"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Quick start</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">Continue learning</h2>
              </div>
              <Link to="/chat">
                <Button variant="secondary">Continue Learning</Button>
              </Link>
            </div>
            <div className="mt-6 space-y-4">
              <ChatPreview
                title="Resume the latest conversation"
                subtitle="Open chat to continue the last learning exchange immediately."
                time="Now"
              />
              <ChatPreview
                title="Switch to a different subject"
                subtitle="Use the chat subject selector when you want a new context."
                time="Later"
              />
            </div>
          </Card>

          <Card>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Quick actions</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Session shortcuts</h2>
            <div className="mt-6 grid gap-3">
              <QuickAction icon={<FiPlay />} label="Resume lesson" />
              <QuickAction icon={<FiMessageCircle />} label="Open chat" />
              <QuickAction icon={<FiBook />} label="Review notes" />
              <QuickAction icon={<FiPlus />} label="Add subject" />
            </div>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <Card>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Upcoming features</p>
            <div className="mt-5 space-y-4">
              {[
                'Voice input and response flow',
                'Personalized learning context',
                'Study progress analytics',
                'AI subject recommendations'
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                  <FiZap className="text-cyan-600" />
                  <p className="text-sm font-medium text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="flex flex-col justify-between gap-6 bg-gradient-to-br from-blue-600 to-cyan-500 text-white">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-100">Dashboard CTA</p>
              <h2 className="mt-2 text-3xl font-bold">Open the chat workspace</h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-blue-50/90">
                The chat layout is functional now and keeps history locally across refreshes.
              </p>
            </div>
            <Link to="/chat">
              <Button className="bg-white text-slate-900 hover:bg-slate-100">Go to chat</Button>
            </Link>
          </Card>
        </div>

        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Recent conversation count</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">Recent learning sessions</h2>
            </div>
            <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
              {userMessageCount} user messages
            </span>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {messages.slice(-3).map((message) => (
              <ChatPreview
                key={message.id}
                title={message.subject}
                subtitle={message.content}
                time={new Date(message.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              />
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}
