import { useId } from 'react';
import MarkdownMessage from '../chat/MarkdownMessage';

const LETTERS = ['A', 'B', 'C', 'D'];

/**
 * One question with four radio options. Correct answers are never passed in here,
 * so nothing can leak before the quiz is submitted.
 */
export default function QuizQuestionCard({ question, number, total, selectedIndex, onSelect }) {
  const headingId = useId();
  const groupName = `answer-${question.id}`;

  return (
    <fieldset aria-labelledby={headingId} className="min-w-0">
      <legend className="sr-only">
        Question {number} of {total}
      </legend>
      <p className="eyebrow">
        Question {number} of {total}
      </p>
      <div id={headingId} className="mt-3 text-slate-950 [&_.markdown-body]:text-base [&_.markdown-body]:font-medium [&_.markdown-body]:text-slate-950">
        <MarkdownMessage content={question.question} />
      </div>

      <div className="mt-6 grid gap-3">
        {question.options.map((option, index) => (
          <label key={`${question.id}-${option}`} className="relative block cursor-pointer">
            <input
              type="radio"
              name={groupName}
              value={index}
              checked={selectedIndex === index}
              onChange={() => onSelect(question.id, index)}
              className="peer sr-only"
            />
            <span className="flex min-h-[3.5rem] items-start gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm leading-6 text-slate-800 transition hover:border-blue-300 hover:bg-blue-50/40 peer-checked:border-blue-500 peer-checked:bg-blue-50 peer-checked:shadow-card peer-focus-visible:ring-4 peer-focus-visible:ring-blue-200 [&>span:first-child]:peer-checked:bg-blue-600 [&>span:first-child]:peer-checked:text-white">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600 transition">
                {LETTERS[index]}
              </span>
              <span className="min-w-0 break-words pt-0.5">{option}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
