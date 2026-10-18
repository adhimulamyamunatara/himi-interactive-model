import { FiCheck, FiCopy } from 'react-icons/fi';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';

/** Dark code block with a language label and a copy-to-clipboard button. */
export default function CodeBlock({ code, language }) {
  const { copied, copy } = useCopyToClipboard();

  return (
    <div className="group my-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-card">
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-900 px-4 py-2">
        <span className="font-mono text-xs uppercase tracking-wider text-slate-400">{language ?? 'code'}</span>
        <button
          type="button"
          onClick={() => copy(code)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-white"
          aria-label={copied ? 'Code copied' : 'Copy code'}
        >
          {copied ? <FiCheck aria-hidden="true" className="text-emerald-400" /> : <FiCopy aria-hidden="true" />}
          <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="scrollbar-thin overflow-x-auto p-4 font-mono text-[13px] leading-6 text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}
