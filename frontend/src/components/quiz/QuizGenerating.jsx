import { motion } from 'framer-motion';
import { FiX } from 'react-icons/fi';
import AssistantAvatar from '../avatar/AssistantAvatar';
import Button from '../common/Button';
import Card from '../common/Card';
import Skeleton from '../common/Skeleton';

/** Shown while Gemini writes the quiz. Can take up to a minute with larger models. */
export default function QuizGenerating({ config, onCancel }) {
  const topicText = config.topic.trim() ? ` on ${config.topic.trim()}` : '';

  return (
    <Card className="mx-auto max-w-2xl p-8 text-center sm:p-10" role="status" aria-live="polite">
      <div className="flex justify-center">
        <AssistantAvatar className="animate-float" />
      </div>
      <h2 className="mt-6 text-2xl font-bold text-slate-950">Writing your quiz…</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        HIMI is creating {config.numQuestions} {config.difficulty.toLowerCase()} questions about{' '}
        <strong className="text-slate-900">{config.subject}</strong>
        {topicText}. This can take up to a minute.
      </p>

      <div className="mt-8 space-y-3 text-left" aria-hidden="true">
        <Skeleton className="h-4 w-3/4" />
        {[0, 1, 2, 3].map((index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 * index, duration: 0.4 }}
          >
            <Skeleton className="h-11 w-full rounded-2xl" />
          </motion.div>
        ))}
      </div>

      <Button variant="secondary" className="mt-8" onClick={onCancel}>
        <FiX aria-hidden="true" /> Cancel
      </Button>
    </Card>
  );
}
