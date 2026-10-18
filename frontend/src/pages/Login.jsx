import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { FiArrowRight, FiMail, FiUser } from 'react-icons/fi';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import AssistantAvatar from '../components/avatar/AssistantAvatar';
import { useEffect } from 'react';
import { useUser } from '../context/UserContext';

export default function Login() {
  const [name, setName] = useState('Bhargav');
  const [email, setEmail] = useState('student@himi.ai');
  const { login, user, loading } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [loading, navigate, user]);

  const handleSubmit = (event) => {
    event.preventDefault();
    login({ name, email });
    navigate('/dashboard');
  };

  if (loading) {
    return null;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <section className="section-shell grid min-h-[calc(100vh-88px)] place-items-center py-16">
      <div className="grid w-full gap-10 lg:max-w-6xl lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex flex-col justify-center gap-6">
          <div className="inline-flex w-fit rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
            Dummy authentication for local MVP
          </div>
          <h1 className="text-4xl font-black leading-tight text-slate-950 sm:text-5xl">
            Sign in to continue your learning journey.
          </h1>
          <p className="max-w-xl text-lg leading-8 text-slate-600">
            This Phase 1 login stores the student locally so the dashboard, chat, and profile screens
            can feel like a real product without backend authentication logic.
          </p>
          <div className="flex items-center gap-4 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-soft">
            <AssistantAvatar />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">HIMI Mentor</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Welcome back. Continue from the dashboard and keep the experience consistent across pages.
              </p>
            </div>
          </div>
        </div>

        <Card className="glass-panel p-8 shadow-soft">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Login</p>
              <h2 className="mt-3 text-3xl font-bold text-slate-950">Student access</h2>
            </div>
            <Input
              label="Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter your name"
              icon={FiUser}
            />
            <Input
              label="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email"
              icon={FiMail}
              type="email"
            />
            <Button type="submit" className="w-full">
              Continue <FiArrowRight />
            </Button>
          </form>
        </Card>
      </div>
    </section>
  );
}