import { useId } from 'react';
import { FiCheckCircle, FiChevronDown } from 'react-icons/fi';
import Badge from '../common/Badge';
import { calculateDayStats, daysBetween, formatMinutes, formatPlanDate } from '../../utils/studyPlanner';
import PlanTaskItem from './PlanTaskItem';

/**
 * One day of the plan as a collapsible section. `tasks` may be a filtered subset of the day's tasks.
 */
export default function PlanDayCard({ day, tasks, today, expanded, onToggleExpanded, onToggleTask, filterActive }) {
  const panelId = useId();
  const stats = calculateDayStats(day);
  const relative = daysBetween(today, day.date);
  const isToday = relative === 0;
  const isPast = relative < 0;

  return (
    <section
      aria-label={`${formatPlanDate(day.date)}: ${day.focus}`}
      className={`section-card overflow-hidden ${isToday ? 'ring-2 ring-blue-300' : ''}`}
    >
      <h3>
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-blue-200 sm:px-6"
        >
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-base font-bold text-slate-950">{formatPlanDate(day.date)}</span>
              {isToday ? <Badge tone="blue">Today</Badge> : null}
              {isPast && !stats.isComplete ? <Badge tone="amber">Earlier</Badge> : null}
              {stats.isComplete ? (
                <Badge tone="emerald">
                  <FiCheckCircle aria-hidden="true" /> Done
                </Badge>
              ) : null}
            </span>
            <span className="mt-1 block break-words text-sm font-normal text-slate-600">{day.focus}</span>
            <span className="mt-1 block text-xs font-medium text-slate-500">
              {stats.completedTasks}/{stats.totalTasks} tasks · {formatMinutes(stats.totalMinutes)} planned
            </span>
          </span>
          <FiChevronDown className={`mt-1 shrink-0 text-lg text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </h3>

      {expanded ? (
        <div id={panelId} className="border-t border-slate-100 px-5 py-4 sm:px-6">
          {tasks.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              {filterActive ? 'No tasks on this day match the filter.' : 'No tasks planned for this day.'}
            </p>
          ) : (
            <ul className="space-y-3">
              {tasks.map((task) => (
                <PlanTaskItem key={task.id} task={task} onToggle={onToggleTask} />
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
