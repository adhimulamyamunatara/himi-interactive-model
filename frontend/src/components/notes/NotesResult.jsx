import { FiCheck, FiCopy } from 'react-icons/fi';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { summaryToPlainText } from '../../utils/notes';
import Button from '../common/Button';

function Block({ title, children }) {
  return (
    <section aria-label={title} className="rounded-2xl border border-slate-100 bg-white p-5">
      <h3 className="text-base font-bold text-slate-950">{title}</h3>
      <div className="mt-3 text-sm leading-7 text-slate-700">{children}</div>
    </section>
  );
}

/** The structured summary. `actions` renders extra buttons (save, close...) next to Copy. */
export default function NotesResult({ title, notes, actions }) {
  const { copied, copy } = useCopyToClipboard();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="min-w-0 break-words text-2xl font-bold text-slate-950">{title || 'Your summary'}</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => copy(summaryToPlainText(notes, title))}>
            {copied ? <FiCheck aria-hidden="true" /> : <FiCopy aria-hidden="true" />} {copied ? 'Copied' : 'Copy'}
          </Button>
          {actions}
        </div>
      </div>

      <Block title="Short summary">
        <p className="whitespace-pre-line">{notes.summary}</p>
      </Block>

      <Block title="Key concepts">
        <dl className="space-y-3">
          {notes.key_concepts.map((item) => (
            <div key={item.term}>
              <dt className="font-semibold text-slate-900">{item.term}</dt>
              <dd>{item.explanation}</dd>
            </div>
          ))}
        </dl>
      </Block>

      {notes.definitions.length > 0 ? (
        <Block title="Definitions">
          <dl className="space-y-3">
            {notes.definitions.map((item) => (
              <div key={item.term}>
                <dt className="font-semibold text-slate-900">{item.term}</dt>
                <dd>{item.definition}</dd>
              </div>
            ))}
          </dl>
        </Block>
      ) : null}

      <Block title="Key takeaways">
        <ul className="list-disc space-y-1 pl-5">
          {notes.takeaways.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Block>

      <Block title="Revision questions">
        <ol className="list-decimal space-y-1 pl-5">
          {notes.revision_questions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </Block>
    </div>
  );
}
