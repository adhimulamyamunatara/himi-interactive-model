import { motion } from 'framer-motion';
import { FiBookOpen, FiCpu, FiMessageSquare, FiMic, FiSmartphone, FiUsers } from 'react-icons/fi';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import AssistantAvatar from '../components/avatar/AssistantAvatar';
import { Link } from 'react-router-dom';

const features = [
  { icon: FiMessageSquare, title: 'Conversational learning', text: 'A mentor-like interface designed for guided study sessions.' },
  { icon: FiMic, title: 'Voice-ready foundation', text: 'Phase 1 prepares the UI for future multimodal interactions.' },
  { icon: FiBookOpen, title: 'Engineering-first focus', text: 'Made for students who need structured explanations and context.' },
  { icon: FiSmartphone, title: 'Responsive product shell', text: 'A clean experience that adapts across laptop, tablet, and mobile.' }
];

const cards = [
  { title: 'React 19 + Vite', text: 'Fast client foundation with modern routing and component architecture.' },
  { title: 'FastAPI backend', text: 'A clean API surface ready for later services and integrations.' },
  { title: 'Tailwind CSS', text: 'Consistent utility-driven styling with soft gradients and spacing.' },
  { title: 'Framer Motion', text: 'Subtle motion for a polished product feel without clutter.' }
];

export default function Landing() {
  return (
    <div className="overflow-hidden">
      <section className="bg-mesh-gradient">
        <div className="section-shell grid min-h-[calc(100vh-88px)] items-center gap-16 py-16 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm">
              Human inspired AI learning companion
            </div>
            <h1 className="text-4xl font-black leading-tight text-slate-950 sm:text-5xl lg:text-7xl">
              Build a mentor-like AI experience for engineering students.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              HIMI Phase 1 establishes a clean, scalable foundation for a future multimodal learning
              companion with landing, authentication, dashboard, chat, and profile experiences.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link to="/login">
                <Button className="w-full sm:w-auto">Launch MVP</Button>
              </Link>
              <a href="#vision">
                <Button variant="secondary" className="w-full sm:w-auto">
                  Explore vision
                </Button>
              </a>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                ['Phase', '1 MVP'],
                ['Audience', 'Engineering students'],
                ['Focus', 'UI foundation']
              ].map(([label, value]) => (
                <Card key={label} className="p-4">
                  <p className="text-sm text-slate-500">{label}</p>
                  <p className="mt-2 text-lg font-bold text-slate-900">{value}</p>
                </Card>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="relative mx-auto w-full max-w-lg"
          >
            <div className="absolute -left-8 top-10 h-28 w-28 rounded-full bg-cyan-300/30 blur-3xl" />
            <div className="absolute -right-4 bottom-4 h-36 w-36 rounded-full bg-blue-300/30 blur-3xl" />
            <Card className="relative overflow-hidden p-8">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">HIMI</p>
                  <p className="text-xl font-bold text-slate-900">Learning companion interface</p>
                </div>
                <div className="rounded-2xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
                  Phase 1
                </div>
              </div>
              <div className="mt-10 flex items-center justify-center">
                <AssistantAvatar />
              </div>
              <div className="mt-8 space-y-3">
                {[
                  'Greeting card and study summary shell',
                  'Chat workspace with subject panel',
                  'Profile and learning progress layout'
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-cyan-500" />
                    <p className="text-sm font-medium text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      <section className="section-shell py-20" id="vision">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Features</p>
          <h2 className="mt-4 text-3xl font-bold text-slate-950 sm:text-4xl">A clean foundation for future multimodal learning.</h2>
        </motion.div>
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: index * 0.08 }}
              >
                <Card className="h-full">
                  <div className="mb-5 inline-flex rounded-2xl bg-blue-50 p-3 text-2xl text-blue-600">
                    <Icon />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{feature.text}</p>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="section-shell py-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-purple-50 p-3 text-xl text-purple-600">
                <FiCpu />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-purple-600">Project vision</p>
                <h3 className="text-2xl font-bold text-slate-950">From reactive chat to guided mentorship.</h3>
              </div>
            </div>
            <p className="mt-5 text-sm leading-7 text-slate-600">
              The Phase 1 experience is intentionally simple: polished UI, local-only authentication,
              and a clean layout that can later support personalized learning, multimodal interaction,
              and contextual teaching.
            </p>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-cyan-50 p-3 text-xl text-cyan-600">
                <FiUsers />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-600">Target audience</p>
                <h3 className="text-2xl font-bold text-slate-950">Built for engineering students first.</h3>
              </div>
            </div>
            <p className="mt-5 text-sm leading-7 text-slate-600">
              HIMI is positioned as a learning companion for students, colleges, and training centers
              that want a more structured educational interface than a generic chatbot.
            </p>
          </Card>
        </div>
      </section>

      <section className="section-shell py-20">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Technology cards</p>
        <div className="mt-4 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card, index) => (
            <Card key={card.title} className="relative overflow-hidden">
              <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 blur-2xl" />
              <p className="relative text-lg font-bold text-slate-900">{card.title}</p>
              <p className="relative mt-3 text-sm leading-7 text-slate-600">{card.text}</p>
              <div className="relative mt-6 h-1.5 rounded-full bg-slate-100">
                <div className={`h-full rounded-full bg-gradient-to-r ${index % 2 === 0 ? 'from-blue-500 to-cyan-400' : 'from-violet-500 to-indigo-400'} w-3/4`} />
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="section-shell pb-24">
        <Card className="flex flex-col items-start justify-between gap-6 bg-gradient-to-r from-slate-950 to-slate-800 p-8 text-white lg:flex-row lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Call to action</p>
            <h3 className="mt-3 text-3xl font-bold">Launch the Phase 1 learning companion shell.</h3>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              Start with the dashboard, open chat, and continue into the profile experience. The UI is
              ready for later AI services without locking in advanced logic today.
            </p>
          </div>
          <Link to="/login">
            <Button className="bg-white text-slate-900 hover:bg-slate-100">Get Started</Button>
          </Link>
        </Card>
      </section>
    </div>
  );
}