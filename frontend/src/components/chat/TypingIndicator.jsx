import { motion } from 'framer-motion';
import AssistantAvatar from '../avatar/AssistantAvatar';

const DOT_COLORS = ['bg-blue-500', 'bg-violet-500', 'bg-cyan-500'];

export default function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-end gap-3"
      role="status"
      aria-live="polite"
    >
      <AssistantAvatar size="sm" />
      <div className="inline-flex items-center gap-3 rounded-3xl rounded-bl-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <span className="text-sm text-slate-500">HIMI is thinking</span>
        <span className="flex items-center gap-1" aria-hidden="true">
          {DOT_COLORS.map((color, index) => (
            <motion.span
              key={color}
              className={`h-2 w-2 rounded-full ${color}`}
              animate={{ y: [0, -5, 0], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: index * 0.15 }}
            />
          ))}
        </span>
      </div>
    </motion.div>
  );
}
