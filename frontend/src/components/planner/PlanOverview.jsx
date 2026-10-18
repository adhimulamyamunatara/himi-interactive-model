import { FiAlertTriangle, FiAward, FiInfo, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import Badge, { SubjectBadge } from '../common/Badge';
import Button from '../common/Button';
import Card from '../common/Card';
import ProgressBar from '../common/ProgressBar';
import ProgressRing from '../common/ProgressRing';
import {
  calculateProgress,
  calculateSubjectProgress,
  describeDaysUntil,
  formatMinutes,
  formatPlanDate,
  getDaysUntilExam,
  isExamPassed
} from '../../utils/studyPlanner';

function Stat({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-50 text-slate-900',
    emerald: 'bg-emerald-50 text-emerald-800',
    blue: 'bg-blue-50 text-blue-800'
  };

  return (
    <div className={`rounded-2xl px-4 py-3 ${tones[tone]}`}>
      <p className="text-xl font-black leading-tight">{value}</p>
      <p className="mt-0.5 text-xs font-semibold opacity-75">{label}</p>
    </div>
  );
}

/**
 * Summary of one plan: dates, totals and progress. All progress comes from the saved task states.
 */
export default function PlanOverview({ record, today, onRegenerate, onDelete }) {
  const { plan } = record;
  const progress = calculateProgress(plan);
  const subjectProgress = calculateSubjectProgress(plan);
  const passed = isExamPassed(plan.exam_date, today);
  const daysLeft = getDaysUntilExam(plan.exam_date, today);
  const allDone = progress.totalTasks > 0 && progress.remainingTasks === 0;

  return (
    <Card className="space-y-6 p-6 sm:p-8">
      {passed ? (
        <div role="status" className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm font-medium text-amber-800">
            <FiAlertTriangle className="mt-0.5 shrink-0" aria-hidden="true" />
            The exam date for this plan has passed. You can keep it for reference, build a new plan, or delete it.
          </p>
          <Button variant="secondary" size="sm" onClick={onRegenerate} className="shrink-0">
            <FiRefreshCw aria-hidden="true" /> Plan again
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <div className="flex justify-center lg:block">
          <ProgressRing value={progress.percentage} size={160} strokeWidth={13} label="Overall plan progress" caption="complete" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {passed ? <Badge tone="amber">Exam date passed</Badge> : <Badge tone={daysLeft <= 3 ? 'rose' : 'blue'}>{describeDaysUntil(plan.exam_date, today)}</Badge>}
            {plan.plan_type === 'crash_revision' ? <Badge tone="rose">Crash revision plan</Badge> : null}
            {allDone ? (
              <Badge tone="emerald">
                <FiAward aria-hidden="true" /> All tasks completed
              </Badge>
            ) : null}
          </div>

          <h2 className="mt-3 break-words text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{record.title}</h2>
          <p className="mt-1 text-sm text-slate-600">Exam on {formatPlanDate(plan.exam_date, 'full')}</p>

          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Subjects in this plan">
            {plan.subjects.map((subject) => (
              <li key={subject}>
                <SubjectBadge subject={subject} />
              </li>
            ))}
          </ul>

          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Study time per day" value={formatMinutes(plan.daily_available_minutes)} />
            <Stat label="Total scheduled" value={formatMinutes(progress.totalMinutes)} />
            <Stat label="Completed tasks" value={`${progress.completedTasks}/${progress.totalTasks}`} tone="emerald" />
            <Stat label="Remaining tasks" value={progress.remainingTasks} tone="blue" />
          </dl>
          <p className="mt-3 text-sm text-slate-600" aria-live="polite">
            <strong className="text-slate-900">{Math.round(progress.percentage)}%</strong> complete · {formatMinutes(progress.completedMinutes)} of{' '}
            {formatMinutes(progress.totalMinutes)} studied
          </p>
        </div>
      </div>

      <section aria-labelledby="subject-progress-heading">
        <h3 id="subject-progress-heading" className="text-sm font-bold text-slate-950">
          Progress by subject
        </h3>
        <ul className="mt-3 grid gap-4 sm:grid-cols-2">
          {subjectProgress.map((item) => (
            <li key={item.subject} className="rounded-2xl border border-slate-100 p-4">
              <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
                <span className="font-semibold text-slate-900">{item.subject}</span>
                <span className="shrink-0 text-slate-500">
                  {item.completedTasks}/{item.totalTasks} tasks · {Math.round(item.percentage)}%
                </span>
              </div>
              <ProgressBar percentage={item.percentage} label={`${item.subject} progress`} />
              <p className="mt-2 text-xs text-slate-500">
                {formatMinutes(item.completedMinutes)} of {formatMinutes(item.totalMinutes)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {plan.suggested_topic_subjects.length > 0 ? (
        <p className="flex items-start gap-2 rounded-2xl bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
          <FiInfo className="mt-1 shrink-0" aria-hidden="true" />
          <span>
            You did not list topics for <strong>{plan.suggested_topic_subjects.join(', ')}</strong>, so HIMI suggested standard ones (marked &ldquo;Suggested&rdquo;). Compare them
            with your own syllabus.
          </span>
        </p>
      ) : null}

      {plan.notes.length > 0 ? (
        <section aria-labelledby="plan-notes-heading">
          <h3 id="plan-notes-heading" className="text-sm font-bold text-slate-950">
            Notes from HIMI
          </h3>
          <ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-600">
            {plan.notes.map((note) => (
              <li key={note} className="flex items-start gap-2">
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" aria-hidden="true" />
                {note}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:flex-wrap sm:items-center">
        <Button variant="secondary" onClick={onRegenerate}>
          <FiRefreshCw aria-hidden="true" /> Regenerate plan
        </Button>
        <Button variant="ghost" onClick={onDelete}>
          <FiTrash2 aria-hidden="true" /> Delete plan
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        An AI-generated suggestion, not an official college timetable, and no guarantee of exam results. Saved in this browser only, not synced to any account or device.
      </p>
    </Card>
  );
}
