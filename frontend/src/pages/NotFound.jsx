import { motion } from 'framer-motion';
import { FiArrowLeft, FiHome } from 'react-icons/fi';
import AssistantAvatar from '../components/avatar/AssistantAvatar';
import Button from '../components/common/Button';

export default function NotFound() {
  return (
    <section className="section-shell grid min-h-[calc(100vh-76px)] place-items-center py-16">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="max-w-xl text-center"
      >
        <div className="flex justify-center">
          <AssistantAvatar className="animate-float" />
        </div>
        <p className="mt-8 text-7xl font-black tracking-tight text-gradient">404</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950">This page wandered off</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          The page you are looking for does not exist or has moved. Let us get you back to learning.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button to="/">
            <FiHome aria-hidden="true" /> Go home
          </Button>
          <Button variant="secondary" onClick={() => window.history.back()}>
            <FiArrowLeft aria-hidden="true" /> Go back
          </Button>
        </div>
      </motion.div>
    </section>
  );
}
