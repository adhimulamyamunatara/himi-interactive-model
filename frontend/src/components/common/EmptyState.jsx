import { motion } from 'framer-motion';
import { FiInbox } from 'react-icons/fi';
import Button from './Button';

/**
 * Friendly placeholder for lists with no data yet. Use `compact` inside narrow panels.
 */
export default function EmptyState({
  icon: Icon = FiInbox,
  title,
  description,
  actionLabel,
  onAction,
  actionTo,
  compact = false
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/70 text-center ${
        compact ? 'px-4 py-8' : 'px-6 py-12'
      }`}
    >
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-2xl bg-brand-gradient opacity-20 blur-lg" aria-hidden="true" />
        <div className="relative rounded-2xl bg-gradient-to-br from-blue-50 to-violet-50 p-4 text-2xl text-blue-600">
          <Icon aria-hidden="true" />
        </div>
      </div>
      <h3 className={`font-semibold text-slate-900 ${compact ? 'text-base' : 'text-xl'}`}>{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
      ) : null}
      {actionLabel ? (
        <Button className="mt-6" size={compact ? 'sm' : 'md'} to={actionTo} onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </motion.div>
  );
}
