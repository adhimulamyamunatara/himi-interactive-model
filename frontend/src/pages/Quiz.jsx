import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import QuizConfigForm from '../components/quiz/QuizConfigForm';
import QuizGenerating from '../components/quiz/QuizGenerating';
import QuizResults from '../components/quiz/QuizResults';
import QuizSession from '../components/quiz/QuizSession';
import { useChat } from '../context/ChatContext';
import { useQuizSession } from '../hooks/useQuizSession';

const PHASE_COPY = {
  config: { eyebrow: 'Quiz generator', title: 'Test what you know', subtitle: 'Generate a practice quiz for any subject in seconds.' },
  error: { eyebrow: 'Quiz generator', title: 'Test what you know', subtitle: 'Generate a practice quiz for any subject in seconds.' },
  generating: { eyebrow: 'Quiz generator', title: 'Getting your quiz ready', subtitle: 'Hang tight while HIMI writes your questions.' },
  quiz: { eyebrow: 'Quiz in progress', title: 'Answer each question', subtitle: 'Take your time. You can go back and change answers before submitting.' },
  results: { eyebrow: 'Quiz results', title: 'Here is how you did', subtitle: 'Review each answer and read why it is right.' }
};

export default function Quiz() {
  const { selectedSubject } = useChat();
  const { session, generate, cancelGeneration, selectAnswer, goToQuestion, submit, reset } = useQuizSession();
  const { phase, config, quiz, answers, currentIndex, results, error } = session;

  const headingRef = useRef(null);
  const isFirstRender = useRef(true);

  // Move focus to the page heading when the phase changes so keyboard and screen-reader users know something happened.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [phase]);

  const copy = PHASE_COPY[phase];

  return (
    <motion.section
      className="section-shell py-10 lg:py-14"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-8">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-2 text-3xl font-black tracking-tight text-slate-950 outline-none sm:text-4xl"
        >
          {copy.title}
        </h1>
        <p className="mt-2 text-sm text-slate-600">{copy.subtitle}</p>
      </div>

      {phase === 'config' || phase === 'error' ? (
        <QuizConfigForm
          key={phase}
          initialConfig={config}
          defaultSubject={selectedSubject}
          error={phase === 'error' ? error : null}
          onGenerate={generate}
          onRetry={phase === 'error' ? () => generate(config) : undefined}
        />
      ) : null}

      {phase === 'generating' ? <QuizGenerating config={config} onCancel={cancelGeneration} /> : null}

      {phase === 'quiz' ? (
        <QuizSession
          quiz={quiz}
          answers={answers}
          currentIndex={currentIndex}
          onSelectAnswer={selectAnswer}
          onGoTo={goToQuestion}
          onSubmit={submit}
        />
      ) : null}

      {phase === 'results' ? (
        <QuizResults quiz={quiz} results={results} onRetry={() => generate(config)} onNewQuiz={reset} />
      ) : null}
    </motion.section>
  );
}
