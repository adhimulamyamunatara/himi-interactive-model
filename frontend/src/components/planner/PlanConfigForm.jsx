import { useState } from 'react';
import { FiAlertCircle, FiCalendar, FiClock, FiEdit3, FiInfo, FiRefreshCw, FiZap } from 'react-icons/fi';
import Badge from '../common/Badge';
import Button from '../common/Button';
import Card from '../common/Card';
import ChipCheckbox from '../common/ChipCheckbox';
import Input from '../common/Input';
import Select from '../common/Select';
import Textarea from '../common/Textarea';
import { SUBJECTS } from '../../utils/subjects';
import {
  ALL_WEEKDAY_KEYS,
  CONFIDENCE_LEVELS,
  DAILY_MINUTE_OPTIONS,
  DEFAULT_CONFIDENCE,
  MAX_INSTRUCTIONS_LENGTH,
  MAX_PLAN_DAYS,
  MAX_TITLE_LENGTH,
  WEEKDAYS,
  WEEKDAYS_ONLY_KEYS,
  addDays,
  describeDaysUntil,
  getPlanType,
  getStudyDates,
  validateConfig,
  validateExamDate
} from '../../utils/studyPlanner';

const FIELD_IDS = {
  title: 'plan-title',
  examDate: 'plan-exam-date',
  subjects: 'plan-subjects',
  dailyMinutes: 'plan-daily-minutes',
  studyDays: 'plan-study-days',
  instructions: 'plan-instructions'
};
const FIELD_ORDER = ['title', 'examDate', 'subjects', 'subjectItems', 'dailyMinutes', 'studyDays', 'instructions'];

function SectionTitle({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-2xl bg-blue-50 p-3 text-lg text-blue-600">
        <Icon aria-hidden="true" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-slate-600">{description}</p> : null}
      </div>
    </div>
  );
}

function FieldError({ children }) {
  return children ? (
    <p className="mt-2 text-xs font-medium text-rose-600" role="alert">
      {children}
    </p>
  ) : null;
}

/**
 * Controlled form: the page owns `config`, so the student's values survive a failed request.
 */
export default function PlanConfigForm({
  config,
  onChange,
  today,
  onSubmit,
  onCancel,
  submitLabel = 'Generate plan',
  error,
  onRetry,
  profileHint
}) {
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const update = (patch, clearKeys = Object.keys(patch)) => {
    onChange({ ...config, ...patch });
    setErrors((current) => {
      const next = { ...current };
      clearKeys.forEach((key) => delete next[key]);
      return next;
    });
  };

  const toggleSubject = (subject, checked) => {
    const without = config.subjects.filter((item) => item.subject !== subject);
    const subjects = checked
      ? [...without, { subject, topics: '', confidence: DEFAULT_CONFIDENCE }].sort(
          (a, b) => SUBJECTS.indexOf(a.subject) - SUBJECTS.indexOf(b.subject)
        )
      : without;

    update({ subjects }, ['subjects', 'subjectItems']);
  };

  const updateSubject = (subject, patch) => {
    update({ subjects: config.subjects.map((item) => (item.subject === subject ? { ...item, ...patch } : item)) }, ['subjectItems']);
  };

  const toggleDay = (day, checked) => {
    const next = checked ? [...config.studyDays, day] : config.studyDays.filter((item) => item !== day);
    update({ studyDays: ALL_WEEKDAY_KEYS.filter((key) => next.includes(key)) }, ['studyDays']);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextErrors = validateConfig(config, today);
    setErrors(nextErrors);
    setSubmitted(true);

    const firstInvalid = FIELD_ORDER.find((key) => nextErrors[key]);

    if (firstInvalid) {
      // Wait for the error messages to render, then move focus to the first problem.
      requestAnimationFrame(() => {
        const target =
          firstInvalid === 'subjectItems'
            ? document.querySelector('[data-subject-card] [aria-invalid="true"]')
            : document.getElementById(FIELD_IDS[firstInvalid]);
        target?.focus();
        target?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      });
      return;
    }

    onSubmit(config);
  };

  const errorCount = Object.keys(errors).length;
  const examDateOk = config.examDate && !validateExamDate(config.examDate, today);
  const studyDates = examDateOk ? getStudyDates(today, config.examDate, config.studyDays) : [];
  const tomorrow = addDays(today, 1);
  const latest = addDays(today, MAX_PLAN_DAYS);
  const itemErrors = errors.subjectItems ?? {};

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {error ? (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm font-medium text-rose-700">
            <FiAlertCircle className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              {error}
              <span className="block font-normal text-rose-600">Your answers are still here. Nothing was lost.</span>
            </span>
          </p>
          {onRetry ? (
            <Button variant="secondary" size="sm" onClick={onRetry} className="shrink-0">
              <FiRefreshCw aria-hidden="true" /> Try again
            </Button>
          ) : null}
        </div>
      ) : null}

      {submitted && errorCount > 0 ? (
        <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Please fix the highlighted {errorCount === 1 ? 'field' : 'fields'} and try again.
        </div>
      ) : null}

      {/* 1. Basics ------------------------------------------------------------ */}
      <Card className="space-y-5 p-6 sm:p-8">
        <SectionTitle icon={FiCalendar} title="Your exam" description={profileHint} />

        <Input
          id={FIELD_IDS.title}
          label="Plan title (optional)"
          icon={FiEdit3}
          value={config.title}
          onChange={(event) => update({ title: event.target.value })}
          placeholder="e.g. End-semester revision plan"
          maxLength={MAX_TITLE_LENGTH + 20}
          error={errors.title}
          hint="Leave blank and HIMI will name the plan from your subjects."
        />

        <div>
          <Input
            id={FIELD_IDS.examDate}
            label="Exam date"
            type="date"
            icon={FiCalendar}
            value={config.examDate}
            onChange={(event) => update({ examDate: event.target.value }, ['examDate', 'studyDays'])}
            min={tomorrow}
            max={latest}
            error={errors.examDate}
            hint={`Your plan covers the days from today up to the day before your exam (up to ${MAX_PLAN_DAYS} days). The exam day itself is kept free.`}
          />
          {examDateOk ? (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-700" aria-live="polite">
              <Badge tone="blue">{describeDaysUntil(config.examDate, today)}</Badge>
              <span>
                {studyDates.length} study {studyDates.length === 1 ? 'day' : 'days'} available
                {getPlanType(studyDates.length) === 'crash_revision' && studyDates.length > 0 ? ' · this will be a short crash-revision plan' : ''}
              </span>
            </p>
          ) : null}
        </div>
      </Card>

      {/* 2. Subjects ---------------------------------------------------------- */}
      <Card className="space-y-5 p-6 sm:p-8">
        <SectionTitle
          icon={FiZap}
          title="Subjects and confidence"
          description="Pick every subject you need to prepare. HIMI gives more time to the ones you feel less sure about."
        />

        <fieldset id={FIELD_IDS.subjects} tabIndex={-1} className="min-w-0 outline-none" aria-describedby={errors.subjects ? 'plan-subjects-error' : undefined}>
          <legend className="mb-2 text-sm font-medium text-slate-700">Subjects ({config.subjects.length} selected)</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {SUBJECTS.map((subject) => (
              <ChipCheckbox
                key={subject}
                label={subject}
                checked={config.subjects.some((item) => item.subject === subject)}
                onChange={(checked) => toggleSubject(subject, checked)}
              />
            ))}
          </div>
          {errors.subjects ? (
            <p id="plan-subjects-error" className="mt-2 text-xs font-medium text-rose-600" role="alert">
              {errors.subjects}
            </p>
          ) : null}
        </fieldset>

        {config.subjects.length > 0 ? (
          <ul className="grid gap-4 lg:grid-cols-2">
            {config.subjects.map((item) => (
              <li key={item.subject} data-subject-card className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <p className="text-base font-bold text-slate-950">{item.subject}</p>
                <div className="mt-3 space-y-4">
                  <Select
                    label="How confident are you?"
                    value={item.confidence}
                    onChange={(event) => updateSubject(item.subject, { confidence: event.target.value })}
                    aria-invalid={itemErrors[item.subject]?.confidence ? 'true' : undefined}
                  >
                    {CONFIDENCE_LEVELS.map((level) => (
                      <option key={level.value} value={level.value}>
                        {level.label}
                      </option>
                    ))}
                  </Select>
                  <Input
                    label="Topics or chapters (optional)"
                    value={item.topics}
                    onChange={(event) => updateSubject(item.subject, { topics: event.target.value })}
                    placeholder="e.g. Normalization, Transactions"
                    error={itemErrors[item.subject]?.topics}
                    hint={item.topics.trim() ? 'Separate topics with commas.' : 'Blank: HIMI will suggest standard topics and label them as suggestions.'}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {/* 3. Schedule ---------------------------------------------------------- */}
      <Card className="space-y-6 p-6 sm:p-8">
        <SectionTitle icon={FiClock} title="Your schedule" description="Be realistic. A plan you can keep beats a perfect one you cannot." />

        <Select
          id={FIELD_IDS.dailyMinutes}
          label="Time you can study each day"
          value={config.dailyMinutes}
          onChange={(event) => update({ dailyMinutes: Number(event.target.value) })}
          aria-invalid={errors.dailyMinutes ? 'true' : undefined}
        >
          {DAILY_MINUTE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <FieldError>{errors.dailyMinutes}</FieldError>

        <fieldset id={FIELD_IDS.studyDays} tabIndex={-1} className="min-w-0 outline-none">
          <legend className="mb-2 text-sm font-medium text-slate-700">Days you can study</legend>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {WEEKDAYS.map((day) => (
              <ChipCheckbox
                key={day.key}
                label={day.short}
                checked={config.studyDays.includes(day.key)}
                onChange={(checked) => toggleDay(day.key, checked)}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => update({ studyDays: [...ALL_WEEKDAY_KEYS] })}>
              Every day
            </Button>
            <Button variant="ghost" size="sm" onClick={() => update({ studyDays: [...WEEKDAYS_ONLY_KEYS] })}>
              Weekdays only
            </Button>
          </div>
          <FieldError>{errors.studyDays}</FieldError>
        </fieldset>

        <Textarea
          id={FIELD_IDS.instructions}
          label="Anything else HIMI should know? (optional)"
          value={config.instructions}
          onChange={(event) => update({ instructions: event.target.value })}
          placeholder="e.g. Prioritize numerical problems. Reserve the last two days for revision."
          maxLength={MAX_INSTRUCTIONS_LENGTH}
          error={errors.instructions}
          hint="Treated as a preference only. It cannot change HIMI's planning rules."
        />
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-xs text-slate-500 sm:max-w-md">
          <FiInfo className="mt-0.5 shrink-0" aria-hidden="true" />
          AI-generated suggestions, not an official college timetable. Plans are saved in this browser only.
        </p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          {onCancel ? (
            <Button variant="secondary" size="lg" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit" size="lg">
            <FiZap aria-hidden="true" /> {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
