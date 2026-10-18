import { useId } from 'react';
import { Link } from 'react-router-dom';
import { FiClock, FiExternalLink } from 'react-icons/fi';
import Badge, { SubjectBadge } from '../common/Badge';
import { ACTIVITY_LABELS, formatMinutes } from '../../utils/studyPlanner';

const ACTIVITY_TONES = { learn: 'blue', practice: 'purple', revise: 'cyan', quiz: 'amber', mock_test: 'rose' };

/** One task with a native checkbox, so it is keyboard and screen-reader friendly. */
export default function PlanTaskItem({ task, onToggle }) {
  const descriptionId = useId();
  const isPractice = task.activity_type === 'quiz' || task.activity_type === 'mock_test';

  return (
    <li
      className={`flex items-start gap-4 rounded-2xl border px-4 py-4 transition ${
        task.completed ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white'
      }`}
    >
      <input
        type="checkbox"
        checked={task.completed}
        onChange={(event) => onToggle(task.id, event.target.checked)}
        aria-label={`${task.title} (${task.subject}, ${formatMinutes(task.duration_minutes)})`}
        aria-describedby={descriptionId}
        className="mt-1 h-5 w-5 shrink-0 cursor-pointer rounded border-slate-300 accent-blue-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <SubjectBadge subject={task.subject} />
          <Badge tone={ACTIVITY_TONES[task.activity_type]}>{ACTIVITY_LABELS[task.activity_type]}</Badge>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
            <FiClock aria-hidden="true" /> {formatMinutes(task.duration_minutes)}
          </span>
        </div>
        <p className={`mt-2 break-words text-sm font-semibold ${task.completed ? 'text-slate-500 line-through' : 'text-slate-950'}`}>{task.title}</p>
        <p id={descriptionId} className={`mt-1 break-words text-sm leading-6 ${task.completed ? 'text-slate-400' : 'text-slate-600'}`}>
          {task.description}
        </p>
        {isPractice ? (
          <Link
            to="/quiz"
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
          >
            Open the Quiz Generator <FiExternalLink aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </li>
  );
}
