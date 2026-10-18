import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAX_DIFFICULT_TOPICS,
  MAX_GOAL_LENGTH,
  MAX_GOALS,
  MAX_INTERESTS,
  MAX_TOPIC_LENGTH,
  addDifficultTopic,
  addListItem,
  attachProfile,
  buildProfilePayload,
  cleanText,
  createDefaultProfile,
  hasProfileContent,
  normalizeProfile,
  profilesEqual,
  removeListItem
} from './learningProfile.js';

const goalRule = { maxItems: MAX_GOALS, maxLength: MAX_GOAL_LENGTH, noun: 'goal' };

describe('defaults and normalisation', () => {
  it('has sensible defaults and no personal content', () => {
    const profile = createDefaultProfile();
    assert.equal(profile.explanationLevel, 'intermediate');
    assert.equal(profile.language, 'english');
    assert.deepEqual(profile.goals, []);
    assert.equal(hasProfileContent(profile), false);
  });

  it('turns garbage into defaults without throwing', () => {
    for (const bad of [null, undefined, 'text', 42, [], { explanationLevel: 'expert', goals: 'nope', difficultTopics: 5 }]) {
      assert.deepEqual(normalizeProfile(bad), createDefaultProfile());
    }
  });

  it('keeps valid enumerated values and rejects unknown ones', () => {
    const profile = normalizeProfile({
      explanationLevel: 'beginner',
      explanationStyle: 'poetry',
      language: 'telugu_english',
      quizStyle: 'practical',
      revisionStyle: 'flashcards'
    });
    assert.equal(profile.explanationLevel, 'beginner');
    assert.equal(profile.explanationStyle, 'step_by_step');
    assert.equal(profile.language, 'telugu_english');
    assert.equal(profile.quizStyle, 'practical');
    assert.equal(profile.revisionStyle, 'flashcards');
  });

  it('cleans, de-duplicates and caps text lists', () => {
    const profile = normalizeProfile({
      goals: ['  Pass\n the   exam ', 'pass the exam', '', 42, 'x'.repeat(500)],
      interests: Array.from({ length: 30 }, (_, index) => `topic ${index}`)
    });
    assert.equal(profile.goals[0], 'Pass the exam');
    assert.equal(profile.goals.length, 2);
    assert.equal(profile.goals[1].length, MAX_GOAL_LENGTH);
    assert.equal(profile.interests.length, MAX_INTERESTS);
  });

  it('strips control characters', () => {
    assert.equal(cleanText('a\u0000b\u0007c\nd'), 'a b c d');
    assert.equal(cleanText(null), '');
  });

  it('validates difficult topics: subject must be supported, duplicates and blanks dropped', () => {
    const profile = normalizeProfile({
      difficultTopics: [
        { subject: 'AI', topic: 'Search' },
        { subject: 'AI', topic: 'search' },
        { subject: 'Astrology', topic: 'Stars' },
        { subject: 'DBMS', topic: '   ' },
        'string',
        null
      ]
    });
    assert.deepEqual(profile.difficultTopics, [
      { subject: 'AI', topic: 'Search' },
      { subject: null, topic: 'Stars' }
    ]);
  });

  it('caps difficult topics', () => {
    const topics = Array.from({ length: 40 }, (_, index) => ({ subject: null, topic: `t${index}` }));
    assert.equal(normalizeProfile({ difficultTopics: topics }).difficultTopics.length, MAX_DIFFICULT_TOPICS);
  });

  it('detects whether the student changed anything', () => {
    assert.equal(hasProfileContent({ ...createDefaultProfile(), goals: ['Pass'] }), true);
    assert.equal(hasProfileContent({ ...createDefaultProfile(), language: 'telugu_english' }), true);
    assert.equal(profilesEqual(createDefaultProfile(), { goals: [] }), true);
    assert.equal(profilesEqual(createDefaultProfile(), { goals: ['x'] }), false);
  });
});

describe('request payload', () => {
  it('uses exactly the snake_case fields the backend accepts', () => {
    const payload = buildProfilePayload({
      ...createDefaultProfile(),
      goals: ['Pass'],
      difficultTopics: [{ subject: 'DBMS', topic: 'Normalization', extra: 'ignored' }]
    });
    assert.deepEqual(Object.keys(payload).sort(), [
      'difficult_topics',
      'explanation_level',
      'explanation_style',
      'goals',
      'interests',
      'language',
      'quiz_style',
      'revision_style'
    ]);
    assert.deepEqual(payload.difficult_topics, [{ subject: 'DBMS', topic: 'Normalization' }]);
  });

  it('always sends a clean payload even from damaged input', () => {
    const payload = buildProfilePayload({ explanationLevel: 'x', goals: ['  a  ', 'A'] });
    assert.equal(payload.explanation_level, 'intermediate');
    assert.deepEqual(payload.goals, ['a']);
  });

  it('attaches the profile only when there is one, without mutating the request', () => {
    const request = { message: 'hi' };
    assert.equal(attachProfile(request, 'learningProfile', null), request);
    const result = attachProfile(request, 'learningProfile', { language: 'english' });
    assert.deepEqual(result, { message: 'hi', learningProfile: { language: 'english' } });
    assert.deepEqual(request, { message: 'hi' });
  });
});

describe('list editing', () => {
  it('adds a cleaned item', () => {
    assert.deepEqual(addListItem([], '  Learn   SQL ', goalRule), { list: ['Learn SQL'], error: null });
  });

  it('explains why an item was refused and leaves the list untouched', () => {
    const list = ['Learn SQL'];
    assert.match(addListItem(list, '   ', goalRule).error, /Type a goal/);
    assert.match(addListItem(list, 'x'.repeat(MAX_GOAL_LENGTH + 1), goalRule).error, /at most 120/);
    assert.match(addListItem(list, 'learn sql', goalRule).error, /already/);
    const full = Array.from({ length: MAX_GOALS }, (_, index) => `g${index}`);
    const result = addListItem(full, 'one more', goalRule);
    assert.match(result.error, /at most 5/);
    assert.equal(result.list, full);
  });

  it('removes by position', () => {
    assert.deepEqual(removeListItem(['a', 'b', 'c'], 1), ['a', 'c']);
  });

  it('adds difficult topics with the same rules', () => {
    const first = addDifficultTopic([], { subject: 'DBMS', topic: ' Normalization ' });
    assert.deepEqual(first.list, [{ subject: 'DBMS', topic: 'Normalization' }]);
    assert.match(addDifficultTopic(first.list, { subject: 'DBMS', topic: 'normalization' }).error, /already/);
    // same topic under another subject is allowed
    assert.equal(addDifficultTopic(first.list, { subject: 'AI', topic: 'Normalization' }).error, null);
    assert.match(addDifficultTopic([], { topic: '' }).error, /Type a topic/);
    assert.match(addDifficultTopic([], { topic: 'x'.repeat(MAX_TOPIC_LENGTH + 1) }).error, /at most/);
    assert.equal(addDifficultTopic([], { subject: 'Nope', topic: 'x' }).list[0].subject, null);
  });
});
