import { useState } from 'react';
import { FiAlertCircle, FiBookOpen, FiEdit3, FiRefreshCw, FiZap } from 'react-icons/fi';
import Button from '../common/Button';
import Card from '../common/Card';
import Input from '../common/Input';
import SegmentedControl from '../common/SegmentedControl';
import Select from '../common/Select';
import {
  DIFFICULTIES,
  MAX_TOPIC_LENGTH,
  QUESTION_COUNTS,
  createDefaultConfig,
  validateQuizConfig
} from '../../utils/quiz';
import { SUBJECTS } from '../../utils/subjects';

const COUNT_OPTIONS = QUESTION_COUNTS.map((count) => ({ value: count, label: `${count} questions` }));
const DIFFICULTY_OPTIONS = DIFFICULTIES.map((difficulty) => ({ value: difficulty, label: difficulty }));

const TIPS = [
  'Questions are written by Gemini for your subject, topic and level.',
  'You can move between questions and change answers before submitting.',
  'Answers and explanations appear only after you submit.',
  'Scores are for practice only. They are not an official grade.'
];

/**
 * Quiz options form. Starts from `initialConfig` (the previous options, or defaults).
 */
export default function QuizConfigForm({ initialConfig, defaultSubject, error, onGenerate, onRetry }) {
  const [config, setConfig] = useState(() => initialConfig ?? createDefaultConfig(defaultSubject));
  const [fieldErrors, setFieldErrors] = useState({});

  const update = (field) => (value) => {
    setConfig((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextErrors = validateQuizConfig(config);
    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length === 0) {
      onGenerate(config);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
      <Card className="p-6 sm:p-8">
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-950">Set up your quiz</h2>
            <p className="mt-1 text-sm text-slate-600">Pick what you want to practise. HIMI does the rest.</p>
          </div>

          {error ? (
            <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2 text-sm font-medium text-rose-700">
                <FiAlertCircle className="mt-0.5 shrink-0" aria-hidden="true" />
                {error}
              </p>
              {onRetry ? (
                <Button variant="secondary" size="sm" onClick={onRetry} className="shrink-0">
                  <FiRefreshCw aria-hidden="true" /> Try again
                </Button>
              ) : null}
            </div>
          ) : null}

          <Select
            label="Subject"
            value={config.subject}
            onChange={(event) => update('subject')(event.target.value)}
          >
            {SUBJECTS.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </Select>
          {fieldErrors.subject ? <p className="-mt-4 text-xs font-medium text-rose-600" role="alert">{fieldErrors.subject}</p> : null}

          <Input
            label="Topic or chapter (optional)"
            icon={FiEdit3}
            value={config.topic}
            onChange={(event) => update('topic')(event.target.value)}
            placeholder="e.g. Process Scheduling, Normalization, Binary Search"
            maxLength={MAX_TOPIC_LENGTH + 20}
            error={fieldErrors.topic}
            hint="Leave blank to cover the core concepts of the subject."
          />

          <SegmentedControl
            legend="Number of questions"
            options={COUNT_OPTIONS}
            value={config.numQuestions}
            onChange={update('numQuestions')}
            error={fieldErrors.numQuestions}
          />

          <SegmentedControl
            legend="Difficulty"
            options={DIFFICULTY_OPTIONS}
            value={config.difficulty}
            onChange={update('difficulty')}
            error={fieldErrors.difficulty}
          />

          <Button type="submit" size="lg" className="w-full">
            <FiZap aria-hidden="true" /> Generate Quiz
          </Button>
        </form>
      </Card>

      <Card className="h-fit bg-gradient-to-br from-blue-50 via-white to-violet-50">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white p-3 text-xl text-blue-600 shadow-card">
            <FiBookOpen aria-hidden="true" />
          </div>
          <h2 className="text-lg font-bold text-slate-950">How it works</h2>
        </div>
        <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
          {TIPS.map((tip) => (
            <li key={tip} className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
              {tip}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
