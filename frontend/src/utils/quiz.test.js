// Run with: npm test  (uses Node's built-in test runner, so no extra dependency is needed)
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildQuizRequest,
  calculateQuizResults,
  countUnanswered,
  createDefaultConfig,
  findFirstUnanswered,
  getPerformance,
  InvalidQuizResponseError,
  parseQuizResponse,
  validateQuizConfig
} from './quiz.js';
import { SUBJECTS } from './subjects.js';

const makeQuestion = (n, overrides = {}) => ({
  id: `q${n}`,
  question: `Question ${n}?`,
  options: [`A${n}`, `B${n}`, `C${n}`, `D${n}`],
  correct_answer: `B${n}`,
  explanation: `Because B${n}.`,
  ...overrides
});

const makeQuestions = (count) => Array.from({ length: count }, (_, i) => makeQuestion(i + 1));

const makeResponse = (count = 5) => ({
  status: 'success',
  quiz: { subject: 'DBMS', topic: null, difficulty: 'Medium', questions: makeQuestions(count) }
});

describe('createDefaultConfig', () => {
  it('defaults to 5 questions and Medium difficulty with no topic', () => {
    const config = createDefaultConfig();
    assert.equal(config.numQuestions, 5);
    assert.equal(config.difficulty, 'Medium');
    assert.equal(config.topic, '');
    assert.ok(SUBJECTS.includes(config.subject));
  });

  it('falls back to the default subject when given an unknown one', () => {
    assert.ok(SUBJECTS.includes(createDefaultConfig('Astrology').subject));
    assert.equal(createDefaultConfig('DBMS').subject, 'DBMS');
  });
});

describe('validateQuizConfig', () => {
  it('accepts every supported subject, count and difficulty', () => {
    for (const subject of SUBJECTS) {
      for (const numQuestions of [5, 10, 15]) {
        for (const difficulty of ['Easy', 'Medium', 'Hard']) {
          assert.deepEqual(validateQuizConfig({ subject, topic: '', numQuestions, difficulty }), {});
        }
      }
    }
  });

  it('rejects invalid values', () => {
    const base = createDefaultConfig();
    assert.ok(validateQuizConfig({ ...base, subject: 'Nope' }).subject);
    assert.ok(validateQuizConfig({ ...base, numQuestions: 7 }).numQuestions);
    assert.ok(validateQuizConfig({ ...base, numQuestions: '5' }).numQuestions);
    assert.ok(validateQuizConfig({ ...base, difficulty: 'Brutal' }).difficulty);
    assert.ok(validateQuizConfig({ ...base, topic: 'x'.repeat(101) }).topic);
    assert.ok(validateQuizConfig({ ...base, topic: '<script>' }).topic);
  });

  it('allows engineering punctuation in topics', () => {
    for (const topic of ['C++ pointers', 'TCP/IP model', 'B+ Trees', 'OS: Process Scheduling']) {
      assert.deepEqual(validateQuizConfig({ ...createDefaultConfig(), topic }), {});
    }
  });
});

describe('buildQuizRequest', () => {
  it('uses snake_case keys and omits a blank topic', () => {
    assert.deepEqual(buildQuizRequest({ subject: 'DBMS', topic: '   ', numQuestions: 10, difficulty: 'Hard' }), {
      subject: 'DBMS',
      num_questions: 10,
      difficulty: 'Hard'
    });
  });

  it('trims and collapses whitespace in the topic', () => {
    const request = buildQuizRequest({ subject: 'DBMS', topic: '  Binary   Search ', numQuestions: 5, difficulty: 'Easy' });
    assert.equal(request.topic, 'Binary Search');
  });
});

describe('parseQuizResponse', () => {
  it('returns the quiz for a valid success payload', () => {
    const quiz = parseQuizResponse(makeResponse(5));
    assert.equal(quiz.questions.length, 5);
    assert.equal(quiz.subject, 'DBMS');
  });

  it('rejects malformed payloads', () => {
    const cases = {
      'not an object': null,
      'error status': { status: 'error', quiz: makeResponse().quiz },
      'missing quiz': { status: 'success' },
      'no questions': { status: 'success', quiz: { questions: [] } },
      'answer not in options': { status: 'success', quiz: { questions: [makeQuestion(1, { correct_answer: 'Z' })] } },
      'three options': { status: 'success', quiz: { questions: [makeQuestion(1, { options: ['a', 'b', 'c'], correct_answer: 'a' })] } },
      'duplicate options': { status: 'success', quiz: { questions: [makeQuestion(1, { options: ['a', 'a', 'c', 'd'], correct_answer: 'a' })] } },
      'duplicate ids': { status: 'success', quiz: { questions: [makeQuestion(1), makeQuestion(2, { id: 'q1' })] } },
      'missing explanation': { status: 'success', quiz: { questions: [makeQuestion(1, { explanation: '' })] } }
    };

    for (const [name, payload] of Object.entries(cases)) {
      assert.throws(() => parseQuizResponse(payload), InvalidQuizResponseError, name);
    }
  });
});

describe('answer tracking', () => {
  const questions = makeQuestions(5);

  it('counts unanswered questions and finds the first one', () => {
    assert.equal(countUnanswered(questions, {}), 5);
    assert.equal(findFirstUnanswered(questions, {}), 0);

    const answers = { q1: 0, q2: 1, q4: 3 };
    assert.equal(countUnanswered(questions, answers), 2);
    assert.equal(findFirstUnanswered(questions, answers), 2);
    assert.equal(findFirstUnanswered(questions, { q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 }), -1);
  });

  it('treats index 0 as answered and ignores invalid indices', () => {
    assert.equal(countUnanswered(questions, { q1: 0 }), 4);
    assert.equal(countUnanswered(questions, { q1: 9, q2: -1, q3: 'B', q4: null }), 5);
  });
});

describe('calculateQuizResults', () => {
  const questions = makeQuestions(5);

  it('scores correct, incorrect and unanswered questions', () => {
    // correct answer is index 1 (B) for every question
    const results = calculateQuizResults(questions, { q1: 1, q2: 1, q3: 0, q4: 3 });
    assert.equal(results.total, 5);
    assert.equal(results.correct, 2);
    assert.equal(results.incorrect, 2);
    assert.equal(results.unanswered, 1);
    assert.equal(results.percentage, 40);
  });

  it('exposes the selected and correct answers for review', () => {
    const { items } = calculateQuizResults(questions, { q1: 0, q2: 1 });
    assert.equal(items[0].selectedAnswer, 'A1');
    assert.equal(items[0].isCorrect, false);
    assert.equal(items[0].correctIndex, 1);
    assert.equal(items[1].isCorrect, true);
    assert.equal(items[2].selectedAnswer, null);
    assert.equal(items[2].selectedIndex, null);
    assert.equal(items[2].isCorrect, false);
  });

  it('computes percentage = correct / total x 100', () => {
    assert.equal(calculateQuizResults(questions, { q1: 1, q2: 1, q3: 1, q4: 1, q5: 1 }).percentage, 100);
    assert.equal(calculateQuizResults(questions, {}).percentage, 0);
    assert.ok(Math.abs(calculateQuizResults(makeQuestions(3), { q1: 1 }).percentage - 33.3333) < 0.001);
    assert.equal(calculateQuizResults(makeQuestions(15), Object.fromEntries(makeQuestions(15).slice(0, 9).map((q) => [q.id, 1]))).percentage, 60);
  });

  it('never divides by zero for an empty quiz', () => {
    const results = calculateQuizResults([], {});
    assert.equal(results.total, 0);
    assert.equal(results.percentage, 0);
    assert.equal(Number.isNaN(results.percentage), false);
  });

  it('scores by option text so shuffled options stay correct', () => {
    const shuffled = makeQuestion(1, { options: ['D1', 'B1', 'A1', 'C1'] });
    assert.equal(calculateQuizResults([shuffled], { q1: 1 }).correct, 1);
    assert.equal(calculateQuizResults([shuffled], { q1: 0 }).correct, 0);
  });
});

describe('getPerformance', () => {
  it('returns a label for every score band', () => {
    for (const percentage of [0, 39, 40, 59, 60, 79, 80, 100]) {
      const { label, message } = getPerformance(percentage);
      assert.ok(label && message);
    }
  });
});
