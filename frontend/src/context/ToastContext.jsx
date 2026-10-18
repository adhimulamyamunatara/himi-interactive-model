import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiAlertCircle, FiCheckCircle, FiInfo, FiX } from 'react-icons/fi';

const ToastContext = createContext(null);

const TOAST_STYLES = {
  success: { icon: FiCheckCircle, accent: 'text-emerald-600', ring: 'ring-emerald-100' },
  error: { icon: FiAlertCircle, accent: 'text-rose-600', ring: 'ring-rose-100' },
  info: { icon: FiInfo, accent: 'text-blue-600', ring: 'ring-blue-100' }
};

function Toast({ toast, onDismiss }) {
  const { icon: Icon, accent, ring } = TOAST_STYLES[toast.type];

  useEffect(() => {
    const timeoutId = window.setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => window.clearTimeout(timeoutId);
  }, [onDismiss, toast.duration, toast.id]);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className={`pointer-events-auto flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft ring-4 ${ring}`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${accent}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
        {toast.message ? <p className="mt-1 text-sm leading-5 text-slate-600">{toast.message}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        aria-label="Dismiss notification"
      >
        <FiX className="h-4 w-4" />
      </button>
    </motion.li>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counterRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((type, title, message, duration = 4200) => {
    counterRef.current += 1;
    const id = counterRef.current;

    // Keep the stack short: drop the oldest toast when more than three are visible.
    setToasts((current) => [...current.slice(-2), { id, type, title, message, duration }]);
    return id;
  }, []);

  const api = useMemo(
    () => ({
      success: (title, message) => show('success', title, message),
      error: (title, message) => show('error', title, message, 6000),
      info: (title, message) => show('info', title, message),
      dismiss
    }),
    [dismiss, show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex justify-center px-4 pb-4 sm:inset-x-auto sm:right-0 sm:justify-end sm:px-6 sm:pb-6"
        role="region"
        aria-label="Notifications"
        aria-live="polite"
      >
        <ul className="flex w-full max-w-sm flex-col gap-3">
          <AnimatePresence initial={false}>
            {toasts.map((toast) => (
              <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  return context;
}
