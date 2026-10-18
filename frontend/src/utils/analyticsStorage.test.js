import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMemoryStorage } from '../test-utils/memoryStorage.js';
import {
  ATTEMPTS_BACKUP_KEY,
  ATTEMPTS_STORAGE_KEY,
  ATTEMPTS_STORAGE_VERSION,
  MAX_STORED_ATTEMPTS,
  clearQuizAttempts,
  loadQuizAttempts,
  parseAttempt,
  recordQuizAttempt
} from './analyticsStorage.js';

const attempt = (id, extra = {}) => ({
  id,
  submittedAt: '2026-10-18T10:00:00.000Z',
  subject: 'DBMS',
  topic: 'Normalization',
  difficulty: 'Medium',
  total: 5,
  correct: 4,
  unanswered: 0,
  ...extra
});

describe('parseAttempt', () => {
  it('accepts a valid attempt and recomputes the percentage itself', () => {
    const parsed = parseAttempt({ ...attempt('a'), percentage: 999 });
    assert.equal(parsed.percentage, 80);
    assert.equal(parsed.topic, 'Normalization');
  });

  it('turns a blank topic into null and cleans whitespace', () => {
    assert.equal(parseAttempt(attempt('a', { topic: '   ' })).topic, null);
    assert.equal(parseAttempt(attempt('a', { topic: null })).topic, null);
    assert.equal(parseAttempt(attempt('a', { topic: ' B   tree ' })).topic, 'B tree');
  });

  it('rejects every kind of invalid attempt', () => {
    const bad = [
      null,
      'x',
      attempt('bad id!'),
      attempt('a', { submittedAt: 'yesterday' }),
      attempt('a', { subject: 'Astrology' }),
      attempt('a', { difficulty: 'Impossible' }),
      attempt('a', { total: 0 }),
      attempt('a', { total: 101 }),
      attempt('a', { correct: 6 }),
      attempt('a', { correct: -1 }),
      attempt('a', { correct: 3, unanswered: 3 }),
      attempt('a', { total: '5' })
    ];
    for (const item of bad) {
      assert.equal(parseAttempt(item), null, JSON.stringify(item));
    }
  });
});

describe('recording', () => {
  it('records once and ignores the same quiz recorded again (no double counting)', () => {
    const storage = createMemoryStorage();
    assert.deepEqual(recordQuizAttempt(attempt('quiz-1'), storage), { recorded: true, reason: null });
    assert.deepEqual(recordQuizAttempt(attempt('quiz-1', { correct: 0 }), storage), { recorded: false, reason: 'duplicate' });
    const { attempts } = loadQuizAttempts(storage);
    assert.equal(attempts.length, 1);
    assert.equal(attempts[0].correct, 4); // the first record is untouched
  });

  it('keeps different quizzes separate, even with identical scores', () => {
    const storage = createMemoryStorage();
    recordQuizAttempt(attempt('quiz-1'), storage);
    recordQuizAttempt(attempt('quiz-2'), storage);
    assert.equal(loadQuizAttempts(storage).attempts.length, 2);
  });

  it('refuses invalid attempts and reports storage problems', () => {
    const storage = createMemoryStorage();
    assert.deepEqual(recordQuizAttempt(attempt('a', { total: 0 }), storage), { recorded: false, reason: 'invalid' });
    assert.equal(storage.data.size, 0);
    assert.equal(recordQuizAttempt(attempt('a'), null).reason, 'storage');
    assert.equal(recordQuizAttempt(attempt('a'), createMemoryStorage({}, { failWrites: true })).reason, 'storage');
  });

  it('stores only scores and labels, never questions or answers', () => {
    const storage = createMemoryStorage();
    recordQuizAttempt({ ...attempt('a'), questions: [{ question: 'SECRET QUESTION' }], answers: { q1: 2 } }, storage);
    assert.doesNotMatch(storage.data.get(ATTEMPTS_STORAGE_KEY), /SECRET QUESTION|answers/);
  });

  it('drops the oldest attempts beyond the cap', () => {
    const many = Array.from({ length: MAX_STORED_ATTEMPTS }, (_, index) => attempt(`q${index}`));
    const storage = createMemoryStorage({
      [ATTEMPTS_STORAGE_KEY]: JSON.stringify({ version: ATTEMPTS_STORAGE_VERSION, attempts: many })
    });
    recordQuizAttempt(attempt('newest'), storage);
    const { attempts } = loadQuizAttempts(storage);
    assert.equal(attempts.length, MAX_STORED_ATTEMPTS);
    assert.equal(attempts.at(-1).id, 'newest');
    assert.equal(attempts[0].id, 'q1');
  });
});

describe('loading', () => {
  it('is empty without an issue when nothing is stored (legacy users)', () => {
    assert.deepEqual(loadQuizAttempts(createMemoryStorage()), { attempts: [], issue: null, skipped: 0 });
  });

  it('recovers from corrupt JSON with a backup', () => {
    const storage = createMemoryStorage({ [ATTEMPTS_STORAGE_KEY]: '{{{' });
    assert.equal(loadQuizAttempts(storage).issue, 'unreadable');
    assert.equal(storage.data.get(ATTEMPTS_BACKUP_KEY), '{{{');
  });

  it('treats a wrong version or shape as unreadable', () => {
    for (const value of [{ version: 7, attempts: [] }, { version: 1 }, [], 5]) {
      const storage = createMemoryStorage({ [ATTEMPTS_STORAGE_KEY]: JSON.stringify(value) });
      assert.equal(loadQuizAttempts(storage).issue, 'unreadable');
    }
  });

  it('skips invalid and duplicated records and says so', () => {
    const raw = JSON.stringify({
      version: 1,
      attempts: [attempt('a'), attempt('a', { correct: 0 }), attempt('b', { subject: 'Nope' }), null, attempt('c')]
    });
    const storage = createMemoryStorage({ [ATTEMPTS_STORAGE_KEY]: raw });
    const result = loadQuizAttempts(storage);
    assert.deepEqual(result.attempts.map((item) => item.id), ['a', 'c']);
    assert.equal(result.issue, 'partial');
    assert.equal(result.skipped, 3);
    assert.equal(storage.data.get(ATTEMPTS_BACKUP_KEY), raw);
  });

  it('reports blocked storage without throwing', () => {
    assert.equal(loadQuizAttempts(null).issue, 'unavailable');
    const throwing = { getItem: () => { throw new Error('blocked'); } };
    assert.equal(loadQuizAttempts(throwing).issue, 'unavailable');
  });
});

describe('clearing', () => {
  it('removes the history and the recovery copy, and only those', () => {
    const storage = createMemoryStorage({
      [ATTEMPTS_STORAGE_KEY]: '{}',
      [ATTEMPTS_BACKUP_KEY]: 'x',
      himi_study_plans_v1: 'plans stay',
      'himi.user': 'user stays'
    });
    assert.equal(clearQuizAttempts(storage), true);
    assert.deepEqual([...storage.data.keys()].sort(), ['himi.user', 'himi_study_plans_v1']);
    assert.equal(clearQuizAttempts(null), false);
  });
});
