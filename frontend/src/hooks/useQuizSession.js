import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiErrorMessage, isRequestCancelled } from '../services/apiClient';
import { generateQuiz } from '../services/quizService';
import { createId } from '../utils/chatConversations';
import { calculateQuizResults, validateQuizConfig } from '../utils/quiz';

const GENERATION_ERROR = "HIMI couldn't generate a quiz right now. Please try again.";

/**
 * @typedef {'config' | 'generating' | 'quiz' | 'results' | 'error'} QuizPhase
 */

const INITIAL_SESSION = {
  phase: 'config',
  config: null,
  quiz: null,
  quizId: null, // identifies this one quiz, so a finished attempt is recorded at most once
  answers: {},
  currentIndex: 0,
  error: null,
  results: null
};

/**
 * Owns the whole life of one quiz attempt: configure -> generate -> answer -> results.
 * Everything lives in component state on purpose (quizzes are not persisted and never touch chat history).
 */
export function useQuizSession() {
  const [session, setSession] = useState(INITIAL_SESSION);
  const inFlightRef = useRef(false);
  const requestIdRef = useRef(0);
  const controllerRef = useRef(null);

  // Abort a pending request if the student leaves the page.
  useEffect(() => () => controllerRef.current?.abort(), []);

  /** Start generating a quiz. Ignored while another request is already running. */
  const generate = useCallback(async (config) => {
    if (inFlightRef.current || Object.keys(validateQuizConfig(config)).length > 0) {
      return false;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    inFlightRef.current = true;

    const controller = new AbortController();
    controllerRef.current = controller;
    setSession({ ...INITIAL_SESSION, phase: 'generating', config });

    try {
      const quiz = await generateQuiz(config, { signal: controller.signal });
      setSession({ ...INITIAL_SESSION, phase: 'quiz', config, quiz, quizId: createId() });
      return true;
    } catch (error) {
      if (!isRequestCancelled(error) && !controller.signal.aborted) {
        setSession({ ...INITIAL_SESSION, phase: 'error', config, error: getApiErrorMessage(error, GENERATION_ERROR) });
      }
      return false;
    } finally {
      // Only the latest request may release the lock (a cancelled request can finish late).
      if (requestIdRef.current === requestId) {
        inFlightRef.current = false;
        controllerRef.current = null;
      }
    }
  }, []);

  /** Abort generation and return to the configuration form with the options kept. */
  const cancelGeneration = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    inFlightRef.current = false;
    setSession((current) => ({ ...INITIAL_SESSION, config: current.config }));
  }, []);

  const selectAnswer = useCallback((questionId, optionIndex) => {
    setSession((current) =>
      current.phase === 'quiz' ? { ...current, answers: { ...current.answers, [questionId]: optionIndex } } : current
    );
  }, []);

  const goToQuestion = useCallback((index) => {
    setSession((current) => {
      if (current.phase !== 'quiz') {
        return current;
      }

      const lastIndex = current.quiz.questions.length - 1;
      return { ...current, currentIndex: Math.min(Math.max(index, 0), lastIndex) };
    });
  }, []);

  /** Score the quiz using the answer key that came from the backend. */
  const submit = useCallback(() => {
    setSession((current) =>
      current.phase === 'quiz'
        ? { ...current, phase: 'results', results: calculateQuizResults(current.quiz.questions, current.answers) }
        : current
    );
  }, []);

  /** Back to the configuration form, keeping the last options. */
  const reset = useCallback(() => {
    setSession((current) => ({ ...INITIAL_SESSION, config: current.config }));
  }, []);

  return { session, generate, cancelGeneration, selectAnswer, goToQuestion, submit, reset };
}
