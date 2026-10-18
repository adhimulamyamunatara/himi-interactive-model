import { useState } from 'react';
import { FiArrowLeft, FiCheckCircle, FiList } from 'react-icons/fi';
import Button from '../common/Button';
import EmptyState from '../common/EmptyState';
import SegmentedControl from '../common/SegmentedControl';
import { TASK_FILTERS, countByFilter, filterSchedule, getFocusDate } from '../../utils/studyPlanner';
import PlanDayCard from './PlanDayCard';
import PlanOverview from './PlanOverview';

/**
 * A saved plan: overview, task filter and the day-by-day schedule.
 * Mount it with `key` set to the record and plan ids so its UI state resets after a regeneration.
 */
export default function PlanView({ record, today, onBack, onToggleTask, onRegenerate, onDelete }) {
  const { plan } = record;
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(() => new Set([getFocusDate(plan, today)]));

  const counts = countByFilter(plan);
  const entries = filterSchedule(plan, filter);
  const filterOptions = TASK_FILTERS.map((item) => ({ value: item.value, label: `${item.label} (${counts[item.value]})` }));

  const changeFilter = (value) => {
    setFilter(value);
    // While filtering, open every day that still has matching tasks; otherwise return to the focus day.
    setExpanded(new Set(value === 'all' ? [getFocusDate(plan, today)] : filterSchedule(plan, value).map((entry) => entry.day.date)));
  };

  const toggleDay = (date) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(date)) next.add(date);
      return next;
    });
  };

  const allOpen = entries.length > 0 && entries.every((entry) => expanded.has(entry.day.date));

  return (
    <div className="space-y-8">
      <div>
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-3">
          <FiArrowLeft aria-hidden="true" /> All plans
        </Button>
      </div>

      <PlanOverview record={record} today={today} onRegenerate={onRegenerate} onDelete={onDelete} />

      <section aria-labelledby="schedule-heading" className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">Schedule</p>
            <h2 id="schedule-heading" className="mt-1 text-2xl font-bold text-slate-950">
              Day by day
            </h2>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end lg:w-auto">
            <SegmentedControl legend="Show tasks" options={filterOptions} value={filter} onChange={changeFilter} className="w-full sm:w-96" />
            <Button
              variant="secondary"
              onClick={() => setExpanded(allOpen ? new Set() : new Set(entries.map((entry) => entry.day.date)))}
              disabled={entries.length === 0}
              className="shrink-0"
            >
              <FiList aria-hidden="true" /> {allOpen ? 'Collapse all' : 'Expand all'}
            </Button>
          </div>
        </div>

        {entries.length === 0 ? (
          filter === 'incomplete' ? (
            <EmptyState
              compact
              icon={FiCheckCircle}
              title="Everything is done!"
              description="You have completed every task in this plan. Nice work. Review the finished days or build a new plan."
              actionLabel="Show all tasks"
              onAction={() => changeFilter('all')}
            />
          ) : (
            <EmptyState
              compact
              icon={FiList}
              title="No completed tasks yet"
              description="Tick tasks off as you finish them and they will show up here."
              actionLabel="Show all tasks"
              onAction={() => changeFilter('all')}
            />
          )
        ) : (
          <div className="space-y-4">
            {entries.map(({ day, tasks }) => (
              <PlanDayCard
                key={day.date}
                day={day}
                tasks={tasks}
                today={today}
                expanded={expanded.has(day.date)}
                filterActive={filter !== 'all'}
                onToggleExpanded={() => toggleDay(day.date)}
                onToggleTask={onToggleTask}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
