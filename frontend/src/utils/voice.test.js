import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canAutoRead, createAutoReadTracker, pickVoice, voiceAvailability, voiceInputLanguageFor, voicesForLanguage } from './voice.js';

const voices = [
  { name: 'Alex', lang: 'en-US' },
  { name: 'Rishi', lang: 'en-IN' },
  { name: 'Geeta', lang: 'te_IN' }
];

describe('voiceInputLanguageFor', () => {
  it('follows the explanation language', () => {
    assert.equal(voiceInputLanguageFor('te'), 'te-IN');
    assert.equal(voiceInputLanguageFor('en'), 'en-IN');
    assert.equal(voiceInputLanguageFor('fr'), 'en-IN');
    assert.equal(voiceInputLanguageFor(undefined), 'en-IN');
  });
});

describe('pickVoice', () => {
  it('prefers an exact region match when no voice is the device default', () => {
    assert.equal(pickVoice(voices, 'en-IN').name, 'Rishi');
  });

  it('prefers the device default voice for the language (a listed regional voice may be silent)', () => {
    const list = [{ name: 'Rishi', lang: 'en-IN' }, { name: 'Samantha', lang: 'en-US', default: true }];
    assert.equal(pickVoice(list, 'en-IN').name, 'Samantha');
  });

  it('a voice the student chose wins, but only for the same language', () => {
    const list = [{ name: 'Rishi', lang: 'en-IN' }, { name: 'Samantha', lang: 'en-US', default: true }, { name: 'Geeta', lang: 'te-IN' }];
    assert.equal(pickVoice(list, 'en-IN', 'Rishi').name, 'Rishi');
    assert.equal(pickVoice(list, 'en-IN', 'Geeta').name, 'Samantha');
    assert.equal(pickVoice(list, 'en-IN', 'Gone').name, 'Samantha');
  });

  it('falls back to the same language in another region', () => {
    assert.equal(pickVoice([{ name: 'Alex', lang: 'en-US' }], 'en-IN').name, 'Alex');
  });

  it('understands underscore separators and case', () => {
    assert.equal(pickVoice(voices, 'te-IN').name, 'Geeta');
    assert.equal(pickVoice(voices, 'TE_in').name, 'Geeta');
  });

  it('returns null when no voice speaks the language', () => {
    assert.equal(pickVoice([{ name: 'Alex', lang: 'en-US' }], 'te-IN'), null);
  });

  it('ignores junk entries and non-arrays', () => {
    assert.equal(pickVoice([null, {}, { lang: 5 }], 'en-IN'), null);
    assert.equal(pickVoice(undefined, 'en-IN'), null);
  });
});

describe('voiceAvailability', () => {
  it('claims nothing before the browser has listed voices', () => {
    assert.equal(voiceAvailability([], 'te-IN'), 'unknown');
    assert.equal(voiceAvailability(undefined, 'te-IN'), 'unknown');
  });

  it('reports available and missing', () => {
    assert.equal(voiceAvailability(voices, 'te-IN'), 'available');
    assert.equal(voiceAvailability([{ name: 'Alex', lang: 'en-US' }], 'te-IN'), 'missing');
  });
});

describe('createAutoReadTracker', () => {
  it('never reads what was already there when an owner is first seen', () => {
    const tracker = createAutoReadTracker();
    assert.equal(tracker.next('a', ['1', '2']), null);
    assert.equal(tracker.next('a', ['1', '2']), null);
  });

  it('returns a new reply exactly once', () => {
    const tracker = createAutoReadTracker();
    tracker.next('a', ['1']);
    assert.equal(tracker.next('a', ['1', '2']), '2');
    assert.equal(tracker.next('a', ['1', '2']), null);
  });

  it('returns only the newest when several arrive together', () => {
    const tracker = createAutoReadTracker();
    tracker.next('a', ['1']);
    assert.equal(tracker.next('a', ['1', '2', '3']), '3');
  });

  it('switching to another conversation reads nothing and re-baselines', () => {
    const tracker = createAutoReadTracker();
    tracker.next('a', ['1']);
    assert.equal(tracker.next('b', ['x', 'y']), null);
    assert.equal(tracker.next('b', ['x', 'y', 'z']), 'z');
    assert.equal(tracker.next('a', ['1', '2']), null);
  });

  it('an empty first view then a first reply is read', () => {
    const tracker = createAutoReadTracker();
    assert.equal(tracker.next('a', []), null);
    assert.equal(tracker.next('a', ['1']), '1');
  });

  it('keeps the baseline fresh even if the caller ignores the result (auto-read off)', () => {
    const tracker = createAutoReadTracker();
    tracker.next('a', ['1']);
    tracker.next('a', ['1', '2']); // arrived while auto-read was off
    assert.equal(tracker.next('a', ['1', '2']), null); // turning it on later does not read it
  });
});

describe('canAutoRead', () => {
  it('needs all three conditions', () => {
    assert.equal(canAutoRead({ voiceEnabled: true, autoReadReplies: true, supported: true }), true);
    assert.equal(canAutoRead({ voiceEnabled: false, autoReadReplies: true, supported: true }), false);
    assert.equal(canAutoRead({ voiceEnabled: true, autoReadReplies: false, supported: true }), false);
    assert.equal(canAutoRead({ voiceEnabled: true, autoReadReplies: true, supported: false }), false);
  });
});

describe('voicesForLanguage', () => {
  it('lists only voices of that language and ignores junk', () => {
    const list = [{ name: 'A', lang: 'en-US' }, { name: 'B', lang: 'te-IN' }, null, { lang: 'en-GB' }, { name: 'C', lang: 'en_GB' }];
    assert.deepEqual(voicesForLanguage(list, 'en').map((voice) => voice.name), ['A', 'C']);
    assert.deepEqual(voicesForLanguage(undefined, 'en'), []);
  });
});
