import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiArrowRight,
  FiBookOpen,
  FiCheckCircle,
  FiEye,
  FiHeart,
  FiLayers,
  FiMessageSquare,
  FiMic,
  FiTool,
  FiSmartphone,
  FiTrendingUp
} from 'react-icons/fi';
import { SiFastapi, SiFramer, SiGooglegemini, SiReact, SiTailwindcss, SiVite } from 'react-icons/si';
import AssistantAvatar from '../components/avatar/AssistantAvatar';
import Badge from '../components/common/Badge';
import BrandLogo from '../components/common/BrandLogo';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import HimiRobot from '../components/companion/HimiRobot';
import Reveal from '../components/common/Reveal';
import { useUser } from '../context/UserContext';

const FEATURES = [
  {
    icon: FiMessageSquare,
    title: 'Mentor-style conversations',
    text: 'Step-by-step explanations with examples, written the way a patient teacher would explain them.'
  },
  {
    icon: FiBookOpen,
    title: 'Ten engineering subjects',
    text: 'From Operating Systems and DBMS to Algorithms and Machine Learning, switch subjects in one click.'
  },
  {
    icon: FiLayers,
    title: 'History that stays',
    text: 'Your chats are saved on your device, so you can refresh, come back tomorrow, and continue.'
  },
  {
    icon: FiTrendingUp,
    title: 'Progress at a glance',
    text: 'A dashboard with streaks, subject coverage and recent questions keeps you motivated.'
  },
  {
    icon: FiSmartphone,
    title: 'Works on every screen',
    text: 'A responsive interface that feels at home on a laptop, tablet or phone.'
  },
  {
    icon: FiEye,
    title: 'Built to grow',
    text: 'A clean foundation that now includes memory, notes, quizzes and voice, with vision to come.'
  }
];

const STEPS = [
  { title: 'Sign in', text: 'Enter your name and email. No password, no setup.' },
  { title: 'Pick a subject', text: 'Choose what you want to study today.' },
  { title: 'Ask anything', text: 'Type a question or tap a suggestion.' },
  { title: 'Learn and revisit', text: 'Get a clear explanation and come back anytime.' }
];

const ROADMAP = [
  {
    phase: 'Phase 1',
    title: 'Working MVP',
    status: 'Live now',
    tone: 'emerald',
    items: ['Landing, login and dashboard', 'Gemini-powered AI chat', 'Subject selection and chat history', 'Profile and learning progress']
  },
  {
    phase: 'Phase 2',
    title: 'Smarter mentor',
    status: 'Live now',
    tone: 'emerald',
    items: ['Learning memory and personalisation', 'PDF upload and notes summaries', 'Quizzes, study planner and progress', 'Whiteboard, voice input and read-aloud']
  },
  {
    phase: 'Phase 3',
    title: 'Human-like companion',
    status: 'Partly live',
    tone: 'purple',
    items: ['Multi-agent mentor with code and diagram tools', 'Photo helper, voice and Telugu support', 'Animated robot companion on every page, campus assistant and solo study room', 'Not yet: emotion detection, shared classrooms']
  }
];

const TECHNOLOGIES = [
  { icon: SiReact, name: 'React 19', text: 'Component-based UI with routing and context state.', color: 'text-cyan-500' },
  { icon: SiVite, name: 'Vite', text: 'Lightning-fast dev server and optimised builds.', color: 'text-violet-500' },
  { icon: SiTailwindcss, name: 'Tailwind CSS', text: 'A consistent, responsive design system.', color: 'text-teal-500' },
  { icon: SiFramer, name: 'Framer Motion', text: 'Smooth transitions and micro-interactions.', color: 'text-indigo-500' },
  { icon: SiFastapi, name: 'FastAPI', text: 'A typed, modular Python API layer.', color: 'text-emerald-500' },
  { icon: SiGooglegemini, name: 'Gemini', text: 'The language model behind every answer.', color: 'text-blue-600' }
];

const PILLARS = [
  { icon: FiMic, title: 'Talk to HIMI', text: 'Ask by typing or by voice. HIMI answers in text and can read the reply aloud, in English or Telugu.' },
  { icon: FiBookOpen, title: 'Learn with HIMI', text: 'It teaches step by step, gives hints, asks you questions and points you to what to revise.' },
  { icon: FiEye, title: 'See what HIMI is doing', text: 'The robot listens, thinks, speaks and teaches on screen, matching what is really happening.' },
  { icon: FiTool, title: 'Do things with HIMI', text: 'Ask for a quiz, a study plan, a diagram or code help and HIMI opens the right tool for you.' }
];

// A preview only: on the signed-in pages the robot's state always follows what is really happening.
const PREVIEW_STATES = [
  ['idle', 'Ready'],
  ['listening', 'Listening'],
  ['thinking', 'Thinking'],
  ['speaking', 'Speaking'],
  ['teaching', 'Teaching'],
  ['celebrating', 'Celebrating'],
  ['error', 'Retry']
];

const BEFORE = ['Reactive: you must ask first', 'Generic answers for everyone', 'No context between sessions'];
const AFTER = ['Greets you and guides the session', 'Adapts to your subject and goal', 'Keeps your history and progress'];

function HeroChatPreview() {
  return (
    <Card className="relative overflow-hidden p-0 shadow-soft">
      <div className="absolute inset-x-0 top-0 h-1 bg-brand-gradient" />
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <AssistantAvatar size="sm" />
        <div>
          <p className="text-sm font-semibold text-slate-900">HIMI Mentor</p>
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Operating Systems
          </p>
        </div>
      </div>
      <div className="space-y-4 bg-slate-50/60 p-5">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="ml-auto w-fit max-w-[85%] rounded-3xl rounded-br-lg bg-gradient-to-br from-blue-600 to-violet-600 px-4 py-3 text-sm text-white shadow-glow"
        >
          What is a deadlock?
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="max-w-[90%] rounded-3xl rounded-bl-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm"
        >
          A <strong className="text-slate-900">deadlock</strong> happens when processes wait on each other forever.
          It needs four conditions:
          <ul className="mt-2 list-disc space-y-0.5 pl-5">
            <li>Mutual exclusion</li>
            <li>Hold and wait</li>
            <li>No preemption</li>
            <li>Circular wait</li>
          </ul>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="flex items-center gap-2 text-xs text-slate-500"
        >
          <span className="flex gap-1" aria-hidden="true">
            {[0, 1, 2].map((dot) => (
              <motion.span
                key={dot}
                className="h-1.5 w-1.5 rounded-full bg-blue-500"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: dot * 0.18 }}
              />
            ))}
          </span>
          Ready for your next question
        </motion.div>
      </div>
    </Card>
  );
}

function MeetHimi({ ctaTarget, ctaLabel }) {
  const [preview, setPreview] = useState('idle');

  return (
    <section className="section-shell py-20" id="meet-himi" aria-labelledby="meet-himi-title">
      <div className="grid items-center gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <Reveal className="mx-auto w-full max-w-sm text-center">
          <Card className="bg-gradient-to-b from-blue-50 via-white to-violet-50 p-8">
            <HimiRobot state={preview} className="mx-auto h-48 w-48" label={`HIMI robot preview: ${preview}`} />
            <p className="mt-2 text-xs font-semibold text-slate-600">Preview the robot&rsquo;s moods</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2" role="group" aria-label="Preview a robot state">
              {PREVIEW_STATES.map(([state, label]) => (
                <button
                  key={state}
                  type="button"
                  aria-pressed={preview === state}
                  onClick={() => setPreview(state)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 ${
                    preview === state ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="eyebrow">Meet HIMI</p>
          <h2 id="meet-himi-title" className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Not another chat box. A companion you learn with.
          </h2>
          <p className="mt-4 max-w-xl text-slate-600">
            HIMI is the robot at the centre of the app. It keeps your subject, your language and your conversation as you move between quizzes, plans, notes, code and diagrams.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {PILLARS.map((pillar) => (
              <li key={pillar.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                <pillar.icon className="text-xl text-blue-600" aria-hidden="true" />
                <h3 className="mt-3 text-base font-bold text-slate-900">{pillar.title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{pillar.text}</p>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs leading-5 text-slate-600">
            Honest limits: voice is turn-based (you speak, check the text, send, and HIMI replies). The robot&rsquo;s expressions show what the app is doing; HIMI does not detect your emotions or gestures.
          </p>
          <div className="mt-6">
            <Button to={ctaTarget} size="lg">
              {ctaLabel === 'Go to dashboard' ? 'Talk to HIMI' : 'Start talking to HIMI'} <FiArrowRight aria-hidden="true" />
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default function Landing() {
  const { user } = useUser();
  const ctaTarget = user ? '/dashboard' : '/login';
  const ctaLabel = user ? 'Go to dashboard' : 'Start learning free';

  return (
    <div className="overflow-hidden">
      {/* Hero ----------------------------------------------------------------------- */}
      <section className="relative bg-mesh-gradient">
        <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 animate-float rounded-full bg-cyan-300/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-10 h-80 w-80 animate-float rounded-full bg-violet-300/30 blur-3xl [animation-delay:2s]" />

        <div className="section-shell relative grid min-h-[calc(100vh-76px)] items-center gap-14 py-16 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl"
          >
            <Badge tone="blue" className="mb-6 bg-white/80 px-4 py-2 text-sm shadow-sm">
              <FiHeart aria-hidden="true" /> Human-inspired AI learning companion
            </Badge>
            <h1 className="text-4xl font-black leading-[1.08] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              Beyond chatbots. A <span className="text-gradient">personal AI mentor</span> for every engineering
              student.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              HIMI explains concepts step by step, remembers your conversations, and keeps you moving forward, like
              a patient teacher available any time.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Button to={ctaTarget} size="lg" className="w-full sm:w-auto">
                {ctaLabel} <FiArrowRight aria-hidden="true" />
              </Button>
              <Button href="#how-it-works" variant="secondary" size="lg" className="w-full sm:w-auto">
                See how it works
              </Button>
            </div>
            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6">
              {[
                ['10', 'Subjects'],
                ['24/7', 'Availability'],
                ['1 min', 'To get started']
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="sr-only">{label}</dt>
                  <dd className="text-2xl font-black text-slate-950">{value}</dd>
                  <dd className="mt-1 text-sm text-slate-600">{label}</dd>
                </div>
              ))}
            </dl>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mx-auto w-full max-w-md"
          >
            <div className="mb-4 hidden justify-center lg:flex" aria-hidden="true">
              <BrandLogo variant="mark" alt="" className="h-28 animate-float drop-shadow-[0_12px_24px_rgba(63,78,224,0.25)]" />
            </div>
            <HeroChatPreview />
          </motion.div>
        </div>
      </section>

      <MeetHimi ctaTarget={ctaTarget} ctaLabel={ctaLabel} />

      {/* Features ------------------------------------------------------------------- */}
      <section className="section-shell py-20" id="features">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Features</p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Everything you need to learn with confidence
          </h2>
          <p className="mt-4 text-slate-600">
            A focused toolkit that turns questions into understanding, without the clutter.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <Reveal key={feature.title} delay={(index % 3) * 0.08}>
              <Card interactive className="h-full">
                <div className="mb-5 inline-flex rounded-2xl bg-gradient-to-br from-blue-50 to-violet-50 p-3 text-2xl text-blue-600">
                  <feature.icon aria-hidden="true" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">{feature.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{feature.text}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works ---------------------------------------------------------------- */}
      <section className="force-light bg-slate-950 py-20 text-white" id="how-it-works">
        <div className="section-shell">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">How it works</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">From question to understanding in four steps</h2>
          </Reveal>
          <ol className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <Reveal delay={index * 0.1} className="h-full rounded-3xl border border-white/10 bg-white/5 p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gradient text-lg font-black shadow-glow">
                    {index + 1}
                  </span>
                  <h3 className="mt-5 text-lg font-bold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{step.text}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Vision --------------------------------------------------------------------- */}
      <section className="section-shell py-20" id="vision">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Project vision</p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            From a reactive chatbot to a guiding mentor
          </h2>
          <p className="mt-4 text-slate-600">
            Human teachers observe, remember and adapt. HIMI is being built to do the same.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <Reveal>
            <Card className="h-full border-slate-200 bg-slate-50/80">
              <Badge tone="slate">Before HIMI</Badge>
              <h3 className="mt-4 text-xl font-bold text-slate-900">Open a chatbot, type, close.</h3>
              <ul className="mt-5 space-y-3 text-sm text-slate-600">
                {BEFORE.map((line) => (
                  <li key={line} className="flex items-start gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                    {line}
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
          <Reveal delay={0.1}>
            <Card className="h-full border-blue-200 bg-gradient-to-br from-blue-50 via-white to-violet-50">
              <Badge tone="blue">With HIMI</Badge>
              <h3 className="mt-4 text-xl font-bold text-slate-900">A mentor that knows where you left off.</h3>
              <ul className="mt-5 space-y-3 text-sm text-slate-700">
                {AFTER.map((line) => (
                  <li key={line} className="flex items-start gap-3">
                    <FiCheckCircle className="mt-0.5 shrink-0 text-emerald-500" aria-hidden="true" />
                    {line}
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        </div>
      </section>

      {/* Roadmap timeline -------------------------------------------------------------- */}
      <section className="section-shell pb-20" id="roadmap">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Roadmap</p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Where HIMI is heading</h2>
        </Reveal>
        <ol className="relative mx-auto mt-14 max-w-3xl space-y-8 border-l-2 border-dashed border-blue-200 pl-8 sm:pl-10">
          {ROADMAP.map((entry, index) => (
            <li key={entry.phase} className="relative">
              <span className="absolute -left-[2.6rem] top-6 flex h-5 w-5 items-center justify-center rounded-full border-4 border-white bg-brand-gradient shadow-glow sm:-left-[3.1rem]" />
              <Reveal delay={index * 0.1}>
                <Card interactive>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge tone={entry.tone}>{entry.phase}</Badge>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{entry.status}</span>
                  </div>
                  <h3 className="mt-3 text-xl font-bold text-slate-950">{entry.title}</h3>
                  <ul className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    {entry.items.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <FiCheckCircle className="mt-0.5 shrink-0 text-blue-500" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </Card>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      {/* Technology ------------------------------------------------------------------ */}
      <section className="border-y border-slate-200/70 bg-white/60 py-20" id="technology">
        <div className="section-shell">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">Technology</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Built on a modern stack</h2>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TECHNOLOGIES.map((tech, index) => (
              <Reveal key={tech.name} delay={(index % 3) * 0.08}>
                <Card interactive className="flex h-full items-start gap-4">
                  <tech.icon className={`mt-1 h-8 w-8 shrink-0 ${tech.color}`} aria-hidden="true" />
                  <div>
                    <h3 className="font-bold text-slate-900">{tech.name}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{tech.text}</p>
                  </div>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Call to action --------------------------------------------------------------- */}
      <section className="section-shell py-20">
        <Reveal>
          <div className="relative overflow-hidden force-light rounded-[2rem] bg-slate-950 px-6 py-16 text-center text-white sm:px-12">
            <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-blue-600/40 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -right-10 h-72 w-72 rounded-full bg-violet-600/40 blur-3xl" />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Ready to meet your AI mentor?</h2>
              <p className="mt-4 text-slate-300">
                Sign in with just your name and email, pick a subject, and ask your first question in under a minute.
              </p>
              <div className="mt-8 flex justify-center">
                <Button to={ctaTarget} variant="light" size="lg">
                  {ctaLabel} <FiArrowRight aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
