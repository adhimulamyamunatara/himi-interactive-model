import { motion } from 'framer-motion';
import { FiX } from 'react-icons/fi';
import AssistantAvatar from '../avatar/AssistantAvatar';
import Button from '../common/Button';
import Card from '../common/Card';
import Skeleton from '../common/Skeleton';
import { describeDaysUntil, formatPlanDate } from '../../utils/studyPlanner';

/** Shown while Gemini builds the plan. A month-long plan can take up to a minute with larger models. */
export default function PlanGenerating({ config, today, onCancel }) {
  const subjectCount = config.subjects.length;

  return (
    <Card className="mx-auto max-w-2xl p-8 text-center sm:p-10" role="status" aria-live="polite">
      <div className="flex justify-center">
        <AssistantAvatar className="animate-float" />
      </div>
      <h2 className="mt-6 text-2xl font-bold text-slate-950">Building your study plan…</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        HIMI is planning {subjectCount} {subjectCount === 1 ? 'subject' : 'subjects'} for your exam on{' '}
        <strong className="text-slate-900">{formatPlanDate(config.examDate, 'short')}</strong> ({describeDaysUntil(config.examDate, today).toLowerCase()}). This can take up to a minute.
      </p>

      <div className="mt-8 space-y-3 text-left" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 * index, duration: 0.4 }}
            className="rounded-2xl border border-slate-100 p-4"
          >
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-3 h-4 w-3/4" />
            <Skeleton className="mt-2 h-3 w-1/2" />
          </motion.div>
        ))}
      </div>

      <Button variant="secondary" className="mt-8" onClick={onCancel}>
        <FiX aria-hidden="true" /> Cancel
      </Button>
    </Card>
  );
}
