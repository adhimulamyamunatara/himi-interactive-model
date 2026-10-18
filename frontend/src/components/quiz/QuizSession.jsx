import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiArrowRight, FiCheckCircle } from 'react-icons/fi';
import { countUnanswered, findFirstUnanswered } from '../../utils/quiz';
import Badge, { SubjectBadge } from '../common/Badge';
import Button from '../common/Button';
import Card from '../common/Card';
import ConfirmDialog from '../common/ConfirmDialog';
import QuizNavigator from './QuizNavigator';
import QuizQuestionCard from './QuizQuestionCard';

/**
 * The quiz-taking screen: one question at a time, free navigation, and a guarded submit.
 */
export default function QuizSession({ quiz, answers, currentIndex, onSelectAnswer, onGoTo, onSubmit }) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { questions } = quiz;
  const total = questions.length;
  const question = questions[currentIndex];
  const unanswered = countUnanswered(questions, answers);
  const answered = total - unanswered;
  const isLast = currentIndex === total - 1;

  const requestSubmit = () => {
    if (unanswered > 0) {
      setConfirmOpen(true);
      return;
    }

    onSubmit();
  };

  const reviewUnanswered = () => {
    setConfirmOpen(false);
    const first = findFirstUnanswered(questions, answers);

    if (first !== -1) {
      onGoTo(first);
    }
  };

  const confirmSubmit = () => {
    setConfirmOpen(false);
    onSubmit();
  };

  const unansweredNumbers = questions
    .map((item, index) => (Number.isInteger(answers[item.id]) ? null : index + 1))
    .filter(Boolean);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Card className="p-6 sm:p-8">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <SubjectBadge subject={quiz.subject} />
          <Badge tone="slate">{quiz.difficulty}</Badge>
          {quiz.topic ? <Badge tone="purple">{quiz.topic}</Badge> : null}
        </div>

        <div
          className="mb-8 h-2 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-label="Questions answered"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={answered}
          aria-valuetext={`${answered} of ${total} questions answered`}
        >
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400"
            initial={false}
            animate={{ width: `${(answered / total) * 100}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>

        <motion.div
          key={question.id}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <QuizQuestionCard
            question={question}
            number={currentIndex + 1}
            total={total}
            selectedIndex={answers[question.id]}
            onSelect={onSelectAnswer}
          />
        </motion.div>

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-slate-100 pt-6">
          <Button variant="secondary" onClick={() => onGoTo(currentIndex - 1)} disabled={currentIndex === 0}>
            <FiArrowLeft aria-hidden="true" /> Previous
          </Button>
          {isLast ? (
            <Button onClick={requestSubmit}>
              {unanswered > 0 ? 'Review & Submit' : 'Submit Quiz'} <FiCheckCircle aria-hidden="true" />
            </Button>
          ) : (
            <Button onClick={() => onGoTo(currentIndex + 1)}>
              Next <FiArrowRight aria-hidden="true" />
            </Button>
          )}
        </div>
      </Card>

      <Card className="h-fit lg:sticky lg:top-24">
        <p className="eyebrow">Your progress</p>
        <p className="mt-2 text-2xl font-black text-slate-950" aria-live="polite">
          {answered}/{total} <span className="text-sm font-medium text-slate-500">answered</span>
        </p>
        <div className="mt-5">
          <QuizNavigator questions={questions} answers={answers} currentIndex={currentIndex} onSelect={onGoTo} />
        </div>
        <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-blue-600" aria-hidden="true" /> Answered
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border border-dashed border-slate-400" aria-hidden="true" /> Unanswered
          </span>
        </p>
        {unanswered > 0 ? (
          <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
            {unanswered} unanswered: {unansweredNumbers.join(', ')}
          </p>
        ) : (
          <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-800">
            All questions answered. You can submit now.
          </p>
        )}
        <Button variant="secondary" className="mt-5 w-full" onClick={requestSubmit}>
          <FiCheckCircle aria-hidden="true" /> Submit Quiz
        </Button>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        tone="warning"
        title="Submit with unanswered questions?"
        description={`You have ${unanswered} unanswered question${unanswered === 1 ? '' : 's'} (${unansweredNumbers.join(', ')}). Unanswered questions score zero.`}
        confirmLabel="Submit anyway"
        cancelLabel="Review unanswered"
        onConfirm={confirmSubmit}
        onCancel={reviewUnanswered}
      />
    </div>
  );
}
