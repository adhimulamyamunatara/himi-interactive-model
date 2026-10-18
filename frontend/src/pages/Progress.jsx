import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FiAlertTriangle, FiAward, FiBarChart2, FiCheckSquare, FiTarget, FiTrash2, FiTrendingUp } from 'react-icons/fi';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import ConfirmDialog from '../components/common/ConfirmDialog';
import EmptyState from '../components/common/EmptyState';
import { SubjectBadge } from '../components/common/Badge';
import ScoreBars from '../components/analytics/ScoreBars';
import ScoreTrendChart from '../components/analytics/ScoreTrendChart';
import DateRangeFilter from '../components/analytics/DateRangeFilter';
import StatCard from '../components/dashboard/StatCard';
import { useToast } from '../context/ToastContext';
import { useProgressData } from '../hooks/useProgressData';
import { useToday } from '../hooks/useToday';
import { REVISION_THRESHOLD, attemptDate, buildAnalytics, filterAttempts, resolveRange } from '../utils/analytics';
import { formatPlanDate } from '../utils/studyPlanner';
import { getLearningProfileStore } from '../utils/learningProfileStore';

const percent = (value) => (value === null ? '—' : `${Math.round(value)}%`);

function Section({ eyebrow, title, description, children }) {
  return (
    <Card>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-bold text-slate-950">{title}</h2>
      {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </Card>
  );
}

const practiceLink = (item) =>
  `/quiz?subject=${encodeURIComponent(item.subject)}${item.topic ? `&topic=${encodeURIComponent(item.topic)}` : ''}`;

export default function Progress() {
  const toast = useToast();
  const today = useToday();
  const data = useProgressData();
  const [filter, setFilter] = useState({ preset: 'all', from: '', to: '' });
  const [confirmingClear, setConfirmingClear] = useState(false);

  const { range, error: rangeError } = useMemo(() => resolveRange(filter, today), [filter, today]);
  const analytics = useMemo(
    () => buildAnalytics({ attempts: data.attempts, plans: data.plans, range: rangeError ? null : range }),
    [data.attempts, data.plans, range, rangeError]
  );
  const recentAttempts = useMemo(() => filterAttempts(data.attempts, rangeError ? null : range).slice(-10).reverse(), [data.attempts, range, rangeError]);

  const { quiz, plans } = analytics;
  const nothingAtAll = !analytics.hasAnyQuizData && !analytics.hasAnyPlanData;
  const filtered = filter.preset !== 'all';

  const markDifficult = (item) => {
    const result = getLearningProfileStore().markTopicDifficult(item.subject, item.topic);

    if (result.added) {
      toast.success('Marked as difficult', 'HIMI will give this topic extra care while personalisation is on.');
    } else {
      toast.info('Already marked', result.error);
    }
  };

  const handleClear = () => {
    const ok = data.clearQuizHistory();
    setConfirmingClear(false);

    if (ok) {
      toast.success('Quiz history deleted', 'Your study plans were not changed.');
    } else {
      toast.error('Could not update storage', 'Your browser refused the change.');
    }
  };

  return (
    <motion.section
      className="section-shell py-10 lg:py-14"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-8">
        <p className="eyebrow">Progress</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Your learning progress</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Built only from the quizzes you finish and the study plans you tick off, on this device. Quiz scores are for practice, not
          official grades.
        </p>
      </div>

      {data.issue ? (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
          <FiAlertTriangle className="mt-0.5 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1">
            {data.issue === 'unavailable'
              ? 'Your browser is blocking local storage, so quiz history cannot be shown or saved.'
              : 'Some saved quiz history could not be read and was skipped. A copy of the original data was kept on this device.'}
          </p>
          <button type="button" onClick={data.dismissIssue} className="shrink-0 font-semibold underline">
            Dismiss
          </button>
        </div>
      ) : null}

      {nothingAtAll ? (
        <EmptyState
          icon={FiBarChart2}
          title="No progress to show yet"
          description="Finish a quiz or tick off tasks in a study plan and your progress will appear here. Nothing is estimated: every number comes from your own activity."
          actionLabel="Take a quiz"
          actionTo="/quiz"
        />
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <Card>
            <DateRangeFilter filter={filter} onChange={setFilter} error={rangeError} />
            {plans.planCount > 0 || analytics.hasAnyPlanData ? (
              <p className="mt-3 text-xs text-slate-500">
                Study plan progress follows the day each task is scheduled for, because completion times are not recorded.
              </p>
            ) : null}
          </Card>

          {rangeError ? (
            <EmptyState compact icon={FiAlertTriangle} title="Fix the date range" description="Pick a valid start and end date to see your progress for that period." />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard icon={FiCheckSquare} title="Quizzes attempted" value={quiz.count} caption={quiz.count === 0 ? 'No quizzes in this period.' : `${quiz.totalCorrect} of ${quiz.totalQuestions} questions correct.`} accent="blue" />
                <StatCard icon={FiTarget} title="Average score" value={percent(quiz.averageScore)} caption={quiz.count === 0 ? 'Finish a quiz to see this.' : `Best: ${percent(quiz.bestScore)}`} accent="purple" />
                <StatCard icon={FiTrendingUp} title="Recent average" value={percent(quiz.recentAverage)} caption={quiz.count === 0 ? 'Your last five quizzes appear here.' : 'Average of your latest five quizzes.'} accent="cyan" />
                <StatCard
                  icon={FiAward}
                  title="Tasks completed"
                  value={plans.totalTasks === 0 ? '—' : `${plans.completedTasks}/${plans.totalTasks}`}
                  caption={plans.totalTasks === 0 ? 'No study plan tasks in this period.' : `${plans.remainingTasks} remaining across ${plans.planCount} plan${plans.planCount === 1 ? '' : 's'}.`}
                  accent="amber"
                />
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Section eyebrow="Quizzes" title="Scores over time" description="Your most recent quizzes, oldest to newest.">
                  {analytics.trend.length === 0 ? (
                    <EmptyState compact icon={FiTrendingUp} title="No quizzes in this period" description="Take a quiz and your scores will be charted here." actionLabel="Take a quiz" actionTo="/quiz" />
                  ) : (
                    <ScoreTrendChart points={analytics.trend} />
                  )}
                </Section>

                <Section eyebrow="Quizzes" title="Average score by subject" description="Only subjects you have taken a quiz in are listed.">
                  {analytics.subjects.length === 0 ? (
                    <EmptyState compact icon={FiBarChart2} title="No subject scores yet" description="Subjects appear after you finish a quiz in them." />
                  ) : (
                    <ScoreBars
                      label="Average quiz score by subject"
                      rows={analytics.subjects.map((row) => ({
                        label: row.subject,
                        value: row.averageScore,
                        valueText: percent(row.averageScore),
                        caption: `${row.attempts} quiz${row.attempts === 1 ? '' : 'zes'} · latest ${percent(row.latestScore)}`
                      }))}
                    />
                  )}
                </Section>
              </div>

              <Section
                eyebrow="Revision"
                title="Topics to revise"
                description={`Based on your results: topics and subjects where your latest scores average below ${REVISION_THRESHOLD}%. Topics are the ones you typed when generating a quiz.`}
              >
                {analytics.revision.length === 0 ? (
                  <p className="text-sm text-slate-600">
                    {quiz.count === 0
                      ? 'Nothing to suggest yet. Finish a quiz first.'
                      : `Nothing needs revision right now. Every topic you were quizzed on averages ${REVISION_THRESHOLD}% or more.`}
                  </p>
                ) : (
                  <ul className="space-y-3" aria-label="Topics needing revision">
                    {analytics.revision.map((item) => (
                      <li key={`${item.subject}|${item.topic ?? ''}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <SubjectBadge subject={item.subject} />
                            <span className="break-words text-sm font-semibold text-slate-900">{item.topic ?? 'Whole subject'}</span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            Average {percent(item.averageScore)} over your latest {item.attemptsUsed} quiz{item.attemptsUsed === 1 ? '' : 'zes'} · last on{' '}
                            {formatPlanDate(item.lastAttemptDate, 'short')}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" to={practiceLink(item)} aria-label={`Practise ${item.topic ?? item.subject}`}>
                            Practise
                          </Button>
                          {item.topic ? (
                            <Button size="sm" variant="secondary" onClick={() => markDifficult(item)} aria-label={`Mark ${item.topic} as difficult`}>
                              Mark as difficult
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section eyebrow="Study plans" title="Study plan progress" description="Tasks you ticked off in your saved study plans.">
                {!analytics.hasAnyPlanData ? (
                  <EmptyState compact icon={FiCheckSquare} title="No study plans yet" description="Create a plan and tick tasks off to track your progress here." actionLabel="Open study planner" actionTo="/study-planner" />
                ) : plans.totalTasks === 0 ? (
                  <p className="text-sm text-slate-600">None of your plans have tasks scheduled in this period.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                    <div>
                      <h3 className="mb-3 text-sm font-semibold text-slate-800">By subject</h3>
                      <ScoreBars
                        label="Study plan completion by subject"
                        rows={plans.bySubject.map((row) => ({
                          label: row.subject,
                          value: row.percentage ?? 0,
                          valueText: `${row.completed}/${row.total}`,
                          caption: `${row.remaining} remaining`
                        }))}
                      />
                    </div>
                    <div>
                      <h3 className="mb-3 text-sm font-semibold text-slate-800">By plan</h3>
                      <ul className="space-y-3" aria-label="Progress by study plan">
                        {plans.perPlan.map((plan) => (
                          <li key={plan.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="flex items-baseline justify-between gap-3">
                              <Link to={`/study-planner?plan=${encodeURIComponent(plan.id)}`} className="min-w-0 truncate text-sm font-semibold text-blue-700 hover:underline">
                                {plan.title}
                              </Link>
                              <span className="shrink-0 text-sm font-semibold text-slate-950">{percent(plan.percentage)}</span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              {plan.completed} of {plan.total} tasks · exam {formatPlanDate(plan.examDate, 'short')}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </Section>

              {recentAttempts.length > 0 ? (
                <Section eyebrow="History" title="Recent quizzes">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[32rem] text-left text-sm">
                      <caption className="sr-only">Your most recent quiz attempts</caption>
                      <thead>
                        <tr className="text-xs uppercase tracking-wide text-slate-500">
                          <th scope="col" className="py-2 pr-4">Date</th>
                          <th scope="col" className="py-2 pr-4">Subject</th>
                          <th scope="col" className="py-2 pr-4">Topic</th>
                          <th scope="col" className="py-2 pr-4">Level</th>
                          <th scope="col" className="py-2">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentAttempts.map((attempt) => (
                          <tr key={attempt.id} className="border-t border-slate-100">
                            <td className="py-2 pr-4">{formatPlanDate(attemptDate(attempt), 'short')}</td>
                            <td className="py-2 pr-4">{attempt.subject}</td>
                            <td className="py-2 pr-4">{attempt.topic ?? 'Whole subject'}</td>
                            <td className="py-2 pr-4">{attempt.difficulty}</td>
                            <td className="py-2 font-semibold">
                              {attempt.correct}/{attempt.total} ({percent(attempt.percentage)})
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              ) : null}
            </>
          )}

          <Card>
            <h2 className="text-base font-bold text-slate-950">Your data</h2>
            <p className="mt-2 text-sm text-slate-600">
              Quiz history is stored in this browser only (scores, subject, topic and date; never the questions) and is not synced
              anywhere. Study plan progress comes from your plans in the Study Planner.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button variant="danger" size="sm" onClick={() => setConfirmingClear(true)} disabled={!analytics.hasAnyQuizData}>
                <FiTrash2 aria-hidden="true" /> Clear quiz history
              </Button>
              {filtered ? <span className="text-xs text-slate-500">Clearing deletes all quiz history, not just the selected period.</span> : null}
            </div>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={confirmingClear}
        title="Clear all quiz history?"
        description="This deletes every saved quiz score, so your averages, charts and revision suggestions start from zero. Your study plans and their progress are not affected (delete plans in the Study Planner). It cannot be undone."
        confirmLabel="Clear history"
        onConfirm={handleClear}
        onCancel={() => setConfirmingClear(false)}
      />
    </motion.section>
  );
}
