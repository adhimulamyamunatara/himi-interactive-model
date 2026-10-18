import { useEffect, useId, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiAlertTriangle } from 'react-icons/fi';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import Button from './Button';

const TONES = {
  danger: { icon: 'bg-rose-50 text-rose-600', confirm: 'danger' },
  warning: { icon: 'bg-amber-50 text-amber-600', confirm: 'primary' }
};

/**
 * Accessible modal confirmation. Focus moves to the safe (cancel) action and Escape dismisses it.
 * Use `tone="warning"` for non-destructive confirmations.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onCancel
}) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef(null);
  const toneStyle = TONES[tone];

  useEscapeKey(onCancel, open);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previouslyFocused = document.activeElement;
    cancelRef.current?.focus();

    return () => previouslyFocused?.focus?.();
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-soft"
          >
            <div className="flex items-start gap-4">
              <div className={`rounded-2xl p-3 text-xl ${toneStyle.icon}`}>
                <FiAlertTriangle aria-hidden="true" />
              </div>
              <div>
                <h2 id={titleId} className="text-lg font-bold text-slate-950">
                  {title}
                </h2>
                <p id={descriptionId} className="mt-2 text-sm leading-6 text-slate-600">
                  {description}
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
                {cancelLabel}
              </Button>
              <Button variant={toneStyle.confirm} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
