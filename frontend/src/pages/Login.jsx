import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiArrowRight, FiCheckCircle, FiMail, FiUser } from 'react-icons/fi';
import AssistantAvatar from '../components/avatar/AssistantAvatar';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import { useToast } from '../context/ToastContext';
import { useUser } from '../context/UserContext';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HIGHLIGHTS = ['Pick any of 10 engineering subjects', 'Step-by-step explanations with examples', 'Your history stays on your device'];

function validate({ name, email }) {
  const errors = {};

  if (name.trim().length < 2) {
    errors.name = 'Please enter your name (at least 2 characters).';
  }

  if (!EMAIL_PATTERN.test(email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }

  return errors;
}

export default function Login() {
  const { login, user, loading } = useUser();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '' });
  const [errors, setErrors] = useState({});

  // Already signed in (or just signed in): go straight to the dashboard.
  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    login(form);
    toast.success(`Welcome, ${form.name.trim().split(' ')[0]}!`, 'You are signed in. Let us start learning.');
  };

  return (
    <section className="relative overflow-hidden bg-mesh-gradient">
      <div className="section-shell grid min-h-[calc(100vh-76px)] place-items-center py-12 sm:py-16">
        <div className="grid w-full items-center gap-12 lg:max-w-6xl lg:grid-cols-[1fr_0.9fr]">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col gap-6"
          >
            <span className="inline-flex w-fit rounded-full border border-blue-100 bg-white/80 px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm">
              Local demo sign-in · no password needed
            </span>
            <h1 className="text-4xl font-black leading-tight tracking-tight text-slate-950 sm:text-5xl">
              Sign in to continue your <span className="text-gradient">learning journey</span>.
            </h1>
            <p className="max-w-xl text-lg leading-8 text-slate-600">
              Tell HIMI who you are and it will greet you, remember your subject, and keep your conversations
              ready when you come back.
            </p>
            <ul className="space-y-3">
              {HIGHLIGHTS.map((highlight) => (
                <li key={highlight} className="flex items-center gap-3 text-sm font-medium text-slate-700">
                  <FiCheckCircle className="shrink-0 text-emerald-500" aria-hidden="true" />
                  {highlight}
                </li>
              ))}
            </ul>
            <div className="glass-panel flex items-center gap-4 rounded-3xl p-5 shadow-card">
              <AssistantAvatar size="md" />
              <p className="text-sm leading-6 text-slate-600">
                “Welcome! I am your engineering mentor. Ask me anything and we will work through it together.”
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className="glass-panel p-8 shadow-soft sm:p-10">
              <form className="space-y-6" onSubmit={handleSubmit} noValidate>
                <div>
                  <p className="eyebrow">Student access</p>
                  <h2 className="mt-3 text-3xl font-bold text-slate-950">Welcome to HIMI</h2>
                </div>
                <Input
                  label="Name"
                  value={form.name}
                  onChange={handleChange('name')}
                  placeholder="e.g. Yamuna Tara"
                  icon={FiUser}
                  autoComplete="name"
                  error={errors.name}
                  autoFocus
                />
                <Input
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={handleChange('email')}
                  placeholder="you@college.edu"
                  icon={FiMail}
                  autoComplete="email"
                  error={errors.email}
                />
                <Button type="submit" size="lg" className="w-full">
                  Continue <FiArrowRight aria-hidden="true" />
                </Button>
                <p className="text-center text-xs leading-5 text-slate-500">
                  Your details are stored only in this browser. There is no account or password.
                </p>
              </form>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
