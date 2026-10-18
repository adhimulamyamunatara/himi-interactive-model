import { DEFAULT_SUBJECT, SUBJECTS } from './subjects.js';

export const QUESTION_COUNTS = [5, 10, 15];
export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
export const DEFAULT_QUESTION_COUNT = 5;
export const DEFAULT_DIFFICULTY = 'Medium';
export const MAX_TOPIC_LENGTH = 100;
export const OPTIONS_PER_QUESTION = 4;

// Mirrors the backend rule: letters, digits, spaces and common engineering punctuation.
const TOPIC_PATTERN = /^[\p{L}\p{N}_\s\-/&,.()+#:'’]+$/u;

/**
 * @typedef {object} QuizConfig
 * @property {string} subject
 * @property {string} topic
 * @property {number} numQuestions
 * @property {string} difficulty
 */

/**
 * @typedef {object} QuizQuestion
 * @property {string} id
 * @property {string} question
 * @property {string[]} options
 * @property {string} correct_answer
 * @property {string} explanation
 */

/** @returns {QuizConfig} */
export function createDefaultConfig(subject = DEFAULT_SUBJECT) {
  return {
    subject: SUBJECTS.includes(subject) ? subject : DEFAULT_SUBJECT,
    topic: '',
    numQuestions: DEFAULT_QUESTION_COUNT,
    difficulty: DEFAULT_DIFFICULTY
  };
}

/**
 * Validate a quiz configuration before it is sent to the backend.
 *
 * @param {QuizConfig} config
 * @returns {Record<string, string>} Field-level messages. Empty when the config is valid.
 */
export function validateQuizConfig(config) {
  const errors = {};

  if (!SUBJECTS.includes(config?.subject)) {
    errors.subject = 'Please choose one of the listed subjects.';
  }

  if (!QUESTION_COUNTS.includes(config?.numQuestions)) {
    errors.numQuestions = 'Choose 5, 10 or 15 questions.';
  }

  if (!DIFFICULTIES.includes(config?.difficulty)) {
    errors.difficulty = 'Choose Easy, Medium or Hard.';
  }

  const topic = (config?.topic ?? '').trim();

  if (topic.length > MAX_TOPIC_LENGTH) {
    errors.topic = `Keep the topic under ${MAX_TOPIC_LENGTH} characters.`;
  } else if (topic && !TOPIC_PATTERN.test(topic)) {
    errors.topic = 'Use letters, numbers and simple punctuation only.';
  }

  return errors;
}

/**
 * Build the request body for POST /api/quiz/generate. A blank topic is omitted.
 *
 * @param {QuizConfig} config
 */
export function buildQuizRequest(config) {
  const topic = config.topic.trim().replace(/\s+/g, ' ');

  return {
    subject: config.subject,
    ...(topic ? { topic } : {}),
    num_questions: config.numQuestions,
    difficulty: config.difficulty
  };
}

export class InvalidQuizResponseError extends Error {
  constructor(message = 'The quiz response was not in the expected format.') {
    super(message);
    this.name = 'InvalidQuizResponseError';
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertValidQuestion(question, seenIds) {
  if (!question || !isNonEmptyString(question.id) || seenIds.has(question.id)) {
    throw new InvalidQuizResponseError();
  }

  seenIds.add(question.id);

  const { options } = question;
  const validOptions =
    Array.isArray(options) &&
    options.length === OPTIONS_PER_QUESTION &&
    options.every(isNonEmptyString) &&
    new Set(options).size === OPTIONS_PER_QUESTION;

  if (
    !isNonEmptyString(question.question) ||
    !validOptions ||
    !options.includes(question.correct_answer) ||
    !isNonEmptyString(question.explanation)
  ) {
    throw new InvalidQuizResponseError();
  }
}

/**
 * Validate a successful /api/quiz/generate payload so the UI never renders a broken quiz.
 *
 * @param {unknown} data
 * @returns {{subject: string, topic: string | null, difficulty: string, questions: QuizQuestion[]}}
 * @throws {InvalidQuizResponseError}
 */
export function parseQuizResponse(data) {
  const quiz = data?.quiz;

  if (data?.status !== 'success' || !quiz || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    throw new InvalidQuizResponseError();
  }

  const seenIds = new Set();
  quiz.questions.forEach((question) => assertValidQuestion(question, seenIds));

  return {
    subject: quiz.subject,
    topic: quiz.topic ?? null,
    difficulty: quiz.difficulty,
    questions: quiz.questions
  };
}

function isAnswered(question, selectedIndex) {
  return Number.isInteger(selectedIndex) && selectedIndex >= 0 && selectedIndex < question.options.length;
}

/**
 * @param {QuizQuestion[]} questions
 * @param {Record<string, number>} answers Selected option index keyed by question id.
 */
export function countUnanswered(questions, answers) {
  return questions.filter((question) => !isAnswered(question, answers[question.id])).length;
}

/** Index of the first unanswered question, or -1 when everything is answered. */
export function findFirstUnanswered(questions, answers) {
  return questions.findIndex((question) => !isAnswered(question, answers[question.id]));
}

/**
 * Score a quiz. Percentage = correct / total x 100 (0 when there are no questions).
 *
 * @param {QuizQuestion[]} questions
 * @param {Record<string, number>} answers Selected option index keyed by question id.
 */
export function calculateQuizResults(questions, answers) {
  const total = questions.length;

  const items = questions.map((question) => {
    const rawIndex = answers[question.id];
    const answered = isAnswered(question, rawIndex);
    const selectedAnswer = answered ? question.options[rawIndex] : null;

    return {
      question,
      selectedIndex: answered ? rawIndex : null,
      selectedAnswer,
      correctIndex: question.options.indexOf(question.correct_answer),
      isCorrect: answered && selectedAnswer === question.correct_answer
    };
  });

  const correct = items.filter((item) => item.isCorrect).length;
  const answeredCount = items.filter((item) => item.selectedIndex !== null).length;

  return {
    total,
    correct,
    incorrect: answeredCount - correct,
    unanswered: total - answeredCount,
    percentage: total === 0 ? 0 : (correct / total) * 100,
    items
  };
}

/** Friendly feedback for a percentage score. */
export function getPerformance(percentage) {
  if (percentage >= 80) {
    return { label: 'Excellent work!', message: 'You clearly know this topic well. Try a harder level next.' };
  }

  if (percentage >= 60) {
    return { label: 'Good progress', message: 'You have a solid base. Review the misses below to lock it in.' };
  }

  if (percentage >= 40) {
    return { label: 'Getting there', message: 'A little more practice will help. Read the explanations carefully.' };
  }

  return { label: 'Keep practising', message: 'Every attempt teaches something. Review each explanation, then try again.' };
}
