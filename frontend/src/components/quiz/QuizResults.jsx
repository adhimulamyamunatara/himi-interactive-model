import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FiCheck, FiHome, FiMinus, FiRefreshCw, FiSliders, FiX } from 'react-icons/fi';
import { useCompanion } from '../../context/CompanionContext';
import { useT } from '../../i18n/I18nContext';
import { quizReviewPrompt } from '../../utils/companionPrompts';
import { getPerformance } from '../../utils/quiz';
import MarkdownMessage from '../chat/MarkdownMessage';
import Badge, { SubjectBadge } from '../common/Badge';
import Button from '../common/Button';
import AskHimiButton from '../companion/AskHimiButton';
import Card from '../common/Card';
import ProgressRing from '../common/ProgressRing';
import SegmentedControl from '../common/SegmentedControl';

const LETTERS = ['A', 'B', 'C', 'D'];

function StatTile({ label, value, tone }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700',
    rose: 'bg-rose-50 text-rose-700',
    slate: 'bg-slate-100 text-slate-700'
  };

  return (
    <div className={`rounded-2xl px-4 py-3 text-center ${tones[tone]}`}>
      <p className="text-2xl font-black">{value}</p>
      <p className="text-xs font-semibold">{label}</p>
    </div>
  );
}

function StatusBadge({ item }) {
  if (item.isCorrect) {
    return (
      <Badge tone="emerald">
        <FiCheck aria-hidden="true" /> Correct
      </Badge>
    );
  }

  if (item.selectedIndex === null) {
    return (
      <Badge tone="slate">
        <FiMinus aria-hidden="true" /> Not answered
      </Badge>
    );
  }

  return (
    <Badge tone="rose">
      <FiX aria-hidden="true" /> Incorrect
    </Badge>
  );
}

function optionStyle(item, index) {
  if (index === item.correctIndex) {
    return 'border-emerald-300 bg-emerald-50 text-emerald-900';
  }

  if (index === item.selectedIndex) {
    return 'border-rose-300 bg-rose-50 text-rose-900';
  }

  return 'border-slate-200 bg-white text-slate-600';
}

function optionHint(item, index) {
  if (index === item.correctIndex) {
    return item.selectedIndex === index ? 'Your answer · Correct answer' : 'Correct answer';
  }

  return index === item.selectedIndex ? 'Your answer' : null;
}

function ReviewItem({ item, number }) {
  const { question } = item;

  return (
    <Card className="p-6" id={`review-${question.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow">Question {number}</p>
        <StatusBadge item={item} />
      </div>
      <div className="mt-3 [&_.markdown-body]:text-base [&_.markdown-body]:font-medium [&_.markdown-body]:text-slate-950">
        <MarkdownMessage content={question.question} />
      </div>

      <ul className="mt-5 grid gap-2.5">
        {question.options.map((option, index) => {
          const hint = optionHint(item, index);

          return (
            <li key={`${question.id}-${option}`} className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm leading-6 ${optionStyle(item, index)}`}>
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/70 text-xs font-bold">
                {LETTERS[index]}
              </span>
              <span className="min-w-0 flex-1 break-words">
                {option}
                {hint ? <span className="mt-0.5 block text-xs font-semibold opacity-80">{hint}</span> : null}
              </span>
            </li>
          );
        })}
      </ul>

      <dl className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <dt className="text-xs font-semibold text-slate-500">Your answer</dt>
          <dd className="mt-1 font-medium text-slate-900">{item.selectedAnswer ?? 'Not answered'}</dd>
        </div>
        <div className="rounded-2xl bg-emerald-50 px-4 py-3">
          <dt className="text-xs font-semibold text-emerald-700">Correct answer</dt>
          <dd className="mt-1 font-medium text-emerald-900">{question.correct_answer}</dd>
        </div>
      </dl>

      <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Why</p>
        <div className="mt-1">
          <MarkdownMessage content={question.explanation} />
        </div>
      </div>
    </Card>
  );
}

/**
 * Score summary plus a question-by-question review with explanations.
 */
export default function QuizResults({ quiz, results, onRetry, onNewQuiz }) {
  const { t } = useT();
  const { celebrate } = useCompanion();
  const [filter, setFilter] = useState('all');
  const performance = getPerformance(results.percentage);

  // HIMI celebrates a good result (60% and up) for a few seconds. A weaker score is not cheered; it gets help instead.
  useEffect(() => {
    if (results.percentage >= 60) {
      celebrate();
    }
  }, [celebrate, results.percentage]);

  const missedQuestions = results.items.filter((item) => !item.isCorrect).map((item) => item.question.question);
  const needsReview = results.total - results.correct;

  const filterOptions = useMemo(
    () => [
      { value: 'all', label: `All (${results.total})` },
      { value: 'review', label: `Needs review (${needsReview})` }
    ],
    [needsReview, results.total]
  );

  const visibleItems = results.items
    .map((item, index) => ({ item, number: index + 1 }))
    .filter(({ item }) => filter === 'all' || !item.isCorrect);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card className="overflow-hidden p-6 sm:p-8">
          <div className="flex flex-col items-center gap-8 md:flex-row">
            <ProgressRing value={results.percentage} size={170} strokeWidth={14} label="Quiz score" caption="score" />
            <div className="w-full text-center md:text-left">
              <div className="flex flex-wrap justify-center gap-2 md:justify-start">
                <SubjectBadge subject={quiz.subject} />
                <Badge tone="slate">{quiz.difficulty}</Badge>
                {quiz.topic ? <Badge tone="purple">{quiz.topic}</Badge> : null}
              </div>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">{performance.label}</h2>
              <p className="mt-1 text-lg font-semibold text-slate-800">
                {results.correct} of {results.total} correct · {Math.round(results.percentage)}%
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{performance.message}</p>
              <div className="mt-5 grid grid-cols-3 gap-3">
                <StatTile label="Correct" value={results.correct} tone="emerald" />
                <StatTile label="Incorrect" value={results.incorrect} tone="rose" />
                <StatTile label="Not answered" value={results.unanswered} tone="slate" />
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:flex-wrap">
            <Button onClick={onRetry}>
              <FiRefreshCw aria-hidden="true" /> Retry with new questions
            </Button>
            <Button variant="secondary" onClick={onNewQuiz}>
              <FiSliders aria-hidden="true" /> Change quiz options
            </Button>
            <AskHimiButton
              label={missedQuestions.length > 0 ? t('companion.askQuizMistakes') : t('companion.askQuizNext')}
              prompt={quizReviewPrompt({ subject: quiz.subject, topic: quiz.topic, correct: results.correct, total: results.total, missedQuestions })}
            />
            <Button variant="ghost" to="/dashboard">
              <FiHome aria-hidden="true" /> Back to dashboard
            </Button>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            This is a practice score to help you learn. It is not an official academic grade, and AI-written questions
            can occasionally contain mistakes.
          </p>
        </Card>
      </motion.div>

      <section aria-labelledby="review-heading" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Review</p>
            <h2 id="review-heading" className="mt-1 text-2xl font-bold text-slate-950">
              Answers and explanations
            </h2>
          </div>
          <SegmentedControl
            legend="Show"
            options={filterOptions}
            value={filter}
            onChange={setFilter}
            className="w-full sm:w-80"
          />
        </div>

        {visibleItems.length === 0 ? (
          <Card className="text-center">
            <p className="text-lg font-bold text-slate-950">Perfect score, nothing to review!</p>
            <p className="mt-1 text-sm text-slate-600">Switch to &ldquo;All&rdquo; to read the explanations anyway.</p>
          </Card>
        ) : (
          visibleItems.map(({ item, number }) => <ReviewItem key={item.question.id} item={item} number={number} />)
        )}
      </section>
    </div>
  );
}
