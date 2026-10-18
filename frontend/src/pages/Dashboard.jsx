import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FiAward, FiBarChart2, FiBookOpen, FiCalendar, FiCheckSquare, FiEdit3, FiFileText, FiMessageCircle, FiPenTool, FiPlus, FiShuffle, FiSliders, FiTarget, FiZap } from 'react-icons/fi';
import { LuFlame } from 'react-icons/lu';
import Badge, { SubjectBadge } from '../components/common/Badge';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import EmptyState from '../components/common/EmptyState';
import ProgressRing from '../components/common/ProgressRing';
import UserAvatar from '../components/common/UserAvatar';
import ChatPreview from '../components/dashboard/ChatPreview';
import QuickAction from '../components/dashboard/QuickAction';
import StatCard from '../components/dashboard/StatCard';
import { useChat } from '../context/ChatContext';
import { useUser } from '../context/UserContext';
import { formatGreeting, formatLongDate, formatRelativeTime, getDailyQuote } from '../utils/formatters';
import { getRecentConversations } from '../utils/chatConversations';
import { calculateStreak, getSubjectActivity } from '../utils/messageModel';
import { SUBJECTS } from '../utils/subjects';

const UPCOMING = [
  'Hands-free spoken conversations',
  'Animated mentor avatar',
  'Camera and emotion awareness',
  'Accounts and sync across devices'
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } }
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } }
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useUser();
  const {
    conversations,
    activeConversation,
    allMessages: messages,
    selectedSubject,
    createConversation,
    selectConversation
  } = useChat();

  const quote = useMemo(() => getDailyQuote(), []);
  const stats = useMemo(() => {
    const activity = getSubjectActivity(messages);

    return {
      activity,
      totalQuestions: messages.filter((message) => message.role === 'user').length,
      streak: calculateStreak(messages),
      progress: (activity.length / SUBJECTS.length) * 100
    };
  }, [messages]);

  const recentConversations = useMemo(() => getRecentConversations({ conversations }, 3), [conversations]);
  const hasActivity = messages.length > 0;

  // Starting from a subject opens a fresh chat, so an existing conversation's subject is never changed.
  const openSubject = (subject) => {
    createConversation(subject);
    navigate('/chat');
  };

  const startNewChat = () => {
    createConversation();
    navigate('/chat');
  };

  const surpriseMe = () => {
    const unexplored = SUBJECTS.filter((subject) => !stats.activity.some((entry) => entry.subject === subject));
    const pool = unexplored.length > 0 ? unexplored : SUBJECTS;
    openSubject(pool[Math.floor(Math.random() * pool.length)]);
  };

  return (
    <motion.section
      className="section-shell py-10 lg:py-14"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <div className="grid gap-6">
        {/* Welcome ------------------------------------------------------------------ */}
        <motion.div variants={item}>
          <Card className="relative overflow-hidden border-0 bg-slate-950 p-8 text-white sm:p-10">
            <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-violet-600/40 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-cyan-500/30 blur-3xl" />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="flex items-center gap-4">
                  <UserAvatar size="lg" className="ring-2 ring-white/30" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-cyan-300">{formatLongDate()}</p>
                    <h1 className="mt-1 break-words text-3xl font-black tracking-tight sm:text-4xl">
                      {formatGreeting(user?.name?.split(' ')[0] || 'Student')}
                    </h1>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-300">
                  {hasActivity
                    ? `You have asked ${stats.totalQuestions} question${stats.totalQuestions === 1 ? '' : 's'} so far. Pick up where you left off.`
                    : 'Your learning journey starts with a single question. Choose a subject and ask HIMI anything.'}
                </p>
                <figure className="mt-6 border-l-2 border-cyan-400/70 pl-4">
                  <blockquote className="text-sm italic leading-6 text-slate-200">“{quote.text}”</blockquote>
                  <figcaption className="mt-1 text-xs text-slate-400">{quote.author}</figcaption>
                </figure>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  Current subject <SubjectBadge subject={selectedSubject} />
                </div>
                <Button to="/chat" size="lg" variant="light">
                  <FiMessageCircle aria-hidden="true" /> Continue Learning
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Stats -------------------------------------------------------------------- */}
        <motion.div variants={item} className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={FiMessageCircle}
            title="Total messages"
            value={messages.length}
            caption="Saved locally in this browser."
            accent="blue"
          />
          <StatCard
            icon={FiTarget}
            title="Questions asked"
            value={stats.totalQuestions}
            caption="Every question builds understanding."
            accent="purple"
          />
          <StatCard
            icon={LuFlame}
            title="Learning streak"
            value={`${stats.streak} day${stats.streak === 1 ? '' : 's'}`}
            caption={stats.streak > 0 ? 'Ask a question daily to keep it alive.' : 'Ask a question today to start a streak.'}
            accent="amber"
          />
          <StatCard
            icon={FiBookOpen}
            title="Subjects explored"
            value={`${stats.activity.length}/${SUBJECTS.length}`}
            caption="Across your engineering syllabus."
            accent="cyan"
          />
        </motion.div>

        {/* Progress + quick actions -------------------------------------------------- */}
        <motion.div variants={item} className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <p className="eyebrow">Learning progress</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Syllabus coverage</h2>
            <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row">
              <ProgressRing value={stats.progress} label="Syllabus coverage" caption="explored" />
              <div className="w-full space-y-3 text-sm text-slate-600">
                <p>
                  You have explored <strong className="text-slate-900">{stats.activity.length}</strong> of{' '}
                  <strong className="text-slate-900">{SUBJECTS.length}</strong> subjects.
                </p>
                <p>
                  {stats.activity.length === SUBJECTS.length
                    ? 'Amazing: you have touched every subject. Time to go deeper.'
                    : 'Try a new subject to widen your foundation.'}
                </p>
                <Badge tone="purple">
                  <FiAward aria-hidden="true" /> Keep exploring
                </Badge>
              </div>
            </div>
          </Card>

          <Card>
            <p className="eyebrow">Quick actions</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Jump back in</h2>
            <div className="mt-5 grid gap-3">
              <QuickAction
                icon={FiMessageCircle}
                label="Resume learning"
                description={activeConversation ? `Continue "${activeConversation.title}"` : `Continue with ${selectedSubject}`}
                to="/chat"
              />
              <QuickAction
                icon={FiPlus}
                label="New chat"
                description="Start a separate conversation on any topic"
                onClick={startNewChat}
              />
              <QuickAction
                icon={FiCheckSquare}
                label="Quiz Generator"
                description="Practise with an AI-written quiz on any subject"
                to="/quiz"
              />
              <QuickAction
                icon={FiCalendar}
                label="Study Planner"
                description="Get a day-by-day plan for your exam"
                to="/study-planner"
              />
              <QuickAction
                icon={FiBarChart2}
                label="Progress and revision"
                description="See quiz scores, study plan progress and topics to revise"
                to="/progress"
              />
              <QuickAction
                icon={FiFileText}
                label="Summarise PDF notes"
                description="Upload a PDF and get key concepts and revision questions"
                to="/notes"
              />
              <QuickAction
                icon={FiPenTool}
                label="Whiteboard"
                description="Sketch diagrams and formulas, then export them as an image"
                to="/whiteboard"
              />
              <QuickAction
                icon={FiSliders}
                label="Learning memory"
                description="Tell HIMI how you like to learn"
                to="/learning-memory"
              />
              <QuickAction
                icon={FiShuffle}
                label="Surprise me with a subject"
                description="Start a fresh topic you have not tried yet"
                onClick={surpriseMe}
              />
              <QuickAction icon={FiEdit3} label="Complete your profile" description="Add college, branch and goals" to="/profile" />
            </div>
          </Card>
        </motion.div>

        {/* Recent activity ------------------------------------------------------------ */}
        <motion.div variants={item} className="grid gap-6 lg:grid-cols-2">
          <Card>
            <p className="eyebrow">Recent subjects</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Where you studied</h2>
            <div className="mt-5">
              {stats.activity.length === 0 ? (
                <EmptyState
                  compact
                  icon={FiBookOpen}
                  title="No subjects yet"
                  description="Ask your first question and your subjects will appear here."
                  actionLabel="Start learning"
                  actionTo="/chat"
                />
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {stats.activity.slice(0, 4).map((entry) => (
                    <li key={entry.subject}>
                      <button
                        type="button"
                        onClick={() => openSubject(entry.subject)}
                        className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-200 hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                      >
                        <SubjectBadge subject={entry.subject} />
                        <p className="mt-3 text-sm font-semibold text-slate-900">
                          {entry.count} question{entry.count === 1 ? '' : 's'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">Last active {formatRelativeTime(entry.lastActive)}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card>
            <p className="eyebrow">Recent conversations</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Pick up a chat</h2>
            <div className="mt-5">
              {recentConversations.length === 0 ? (
                <EmptyState
                  compact
                  icon={FiMessageCircle}
                  title="No conversations yet"
                  description="Your most recently active chats will be listed here for quick access."
                  actionLabel="Ask a question"
                  actionTo="/chat"
                />
              ) : (
                <div className="space-y-3">
                  {recentConversations.map((conversation) => (
                    <ChatPreview
                      key={conversation.id}
                      title={conversation.title}
                      subject={conversation.subject}
                      time={formatRelativeTime(conversation.updatedAt)}
                      onClick={() => selectConversation(conversation.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Coming next ----------------------------------------------------------------- */}
        <motion.div variants={item}>
          <Card>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="eyebrow">Coming next</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">The roadmap ahead</h2>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
                {UPCOMING.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                    <FiZap className="shrink-0 text-cyan-600" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </motion.div>
      </div>
    </motion.section>
  );
}
