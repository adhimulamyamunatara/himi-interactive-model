import { FiAlertTriangle, FiArrowRight, FiCalendar, FiInfo, FiPlus, FiTrash2 } from 'react-icons/fi';
import Badge, { SubjectBadge } from '../common/Badge';
import Button from '../common/Button';
import Card from '../common/Card';
import EmptyState from '../common/EmptyState';
import ProgressBar from '../common/ProgressBar';
import { MAX_SAVED_PLANS } from '../../utils/studyPlanStorage';
import { calculateProgress, describeDaysUntil, formatPlanDate, isExamPassed } from '../../utils/studyPlanner';

function LoadIssueNotice({ issue, onDismiss }) {
  const messages = {
    unavailable: 'Your browser is blocking local storage, so study plans cannot be saved or restored here.',
    unreadable: 'Your saved study plans could not be read, so the list is empty. A copy of the unreadable data was kept in this browser.',
    partial: `${issue?.skipped ?? 'Some'} saved ${issue?.skipped === 1 ? 'plan' : 'plans'} could not be read and ${issue?.skipped === 1 ? 'was' : 'were'} skipped. The rest are shown below.`
  };

  return (
    <div role="alert" className="flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <p className="flex items-start gap-2">
        <FiAlertTriangle className="mt-0.5 shrink-0" aria-hidden="true" />
        {messages[issue.type]}
      </p>
      <button type="button" onClick={onDismiss} className="shrink-0 rounded-lg px-2 py-0.5 font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200">
        Dismiss
      </button>
    </div>
  );
}

/**
 * Saved plans (this browser only), with a clear way to start a new one.
 */
export default function PlanList({ records, today, loadIssue, onDismissIssue, missingPlan, canAddMore, onCreate, onOpen, onDelete }) {
  return (
    <div className="space-y-6">
      {loadIssue ? <LoadIssueNotice issue={loadIssue} onDismiss={onDismissIssue} /> : null}

      {missingPlan ? (
        <div role="status" className="flex items-start gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <FiInfo className="mt-0.5 shrink-0" aria-hidden="true" />
          That plan no longer exists on this device. It may have been deleted.
        </div>
      ) : null}

      {records.length === 0 ? (
        <EmptyState
          icon={FiCalendar}
          title="No study plans yet"
          description="Tell HIMI your exam date, subjects and how much time you have. You will get a day-by-day plan you can tick off as you go."
          actionLabel="Create your first plan"
          onAction={onCreate}
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              {records.length} saved {records.length === 1 ? 'plan' : 'plans'} · stored in this browser only
            </p>
            <Button onClick={onCreate} disabled={!canAddMore}>
              <FiPlus aria-hidden="true" /> New plan
            </Button>
          </div>
          {!canAddMore ? (
            <p className="text-sm text-amber-700">You have {MAX_SAVED_PLANS} saved plans. Delete one to create another.</p>
          ) : null}

          <ul className="grid gap-5 lg:grid-cols-2">
            {records.map((record) => {
              const { plan } = record;
              const progress = calculateProgress(plan);
              const passed = isExamPassed(plan.exam_date, today);

              return (
                <li key={record.id}>
                  <Card className="flex h-full flex-col p-6">
                    <div className="flex flex-wrap items-center gap-2">
                      {passed ? <Badge tone="amber">Exam date passed</Badge> : <Badge tone="blue">{describeDaysUntil(plan.exam_date, today)}</Badge>}
                      {plan.plan_type === 'crash_revision' ? <Badge tone="rose">Crash revision</Badge> : null}
                    </div>
                    <h2 className="mt-3 break-words text-xl font-bold text-slate-950">{record.title}</h2>
                    <p className="mt-1 text-sm text-slate-600">Exam on {formatPlanDate(plan.exam_date, 'full')}</p>

                    <ul className="mt-4 flex flex-wrap gap-2" aria-label="Subjects">
                      {plan.subjects.map((subject) => (
                        <li key={subject}>
                          <SubjectBadge subject={subject} />
                        </li>
                      ))}
                    </ul>

                    <div className="mt-5">
                      <div className="mb-2 flex items-baseline justify-between text-sm">
                        <span className="font-semibold text-slate-900">{Math.round(progress.percentage)}% complete</span>
                        <span className="text-slate-500">
                          {progress.completedTasks}/{progress.totalTasks} tasks
                        </span>
                      </div>
                      <ProgressBar percentage={progress.percentage} label={`${record.title} progress`} />
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3 pt-1">
                      <Button onClick={() => onOpen(record.id)} aria-label={`Open plan: ${record.title}`}>
                        Open plan <FiArrowRight aria-hidden="true" />
                      </Button>
                      <Button variant="ghost" onClick={() => onDelete(record.id)} aria-label={`Delete plan: ${record.title}`}>
                        <FiTrash2 aria-hidden="true" /> Delete
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

