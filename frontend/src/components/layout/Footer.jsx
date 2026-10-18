import { Link } from 'react-router-dom';

const PRODUCT_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/chat', label: 'Chat' },
  { to: '/profile', label: 'Profile' }
];

const STACK = ['React 19 + Vite', 'Tailwind CSS', 'Framer Motion', 'FastAPI', 'Gemini API'];

export default function Footer() {
  return (
    <footer className="mt-10 border-t border-slate-200/80 bg-white/70">
      <div className="section-shell grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-gradient font-bold text-white shadow-glow">
              H
            </div>
            <p className="text-lg font-bold text-slate-950">HIMI</p>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-7 text-slate-600">
            Human Inspired Multimodal Interaction Model: an AI learning companion that aims to teach engineering
            students like a patient human mentor.
          </p>
        </div>

        <nav aria-label="Footer">
          <p className="text-sm font-semibold text-slate-900">Product</p>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            {PRODUCT_LINKS.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="transition hover:text-blue-600">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="text-sm font-semibold text-slate-900">Built with</p>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            {STACK.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-200/80">
        <div className="section-shell flex flex-col gap-2 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} HIMI. Phase 1 MVP · Final-year engineering project.</p>
          <p>Beyond chatbots: an AI companion that teaches like a human mentor.</p>
        </div>
      </div>
    </footer>
  );
}
