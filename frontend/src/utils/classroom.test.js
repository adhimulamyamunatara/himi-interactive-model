import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addQuestion,
  appendToNotes,
  buildSummaryRequest,
  CLASSROOM_STORAGE_KEY,
  createRoom,
  hasSessionContent,
  InvalidSummaryError,
  loadRoom,
  MAX_AGENDA_ITEMS,
  MAX_NOTES,
  MAX_QUESTIONS,
  parseAgendaText,
  parseSummaryResponse,
  saveRoom,
  setNotes,
  setSummary,
  toggleAgenda
} from './classroom.js';

const memoryStorage = (initial = {}) => {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
    removeItem: (key) => {
      delete data[key];
    }
  };
};

const room = () => createRoom({ title: ' Deadlock  session ', subject: 'Operating Systems', agenda: ['Intro', '', 'Conditions'] }, { subjects: ['Operating Systems'], id: 'r1' }).room;

describe('createRoom', () => {
  it('cleans input and builds the agenda', () => {
    const result = room();
    assert.equal(result.title, 'Deadlock session');
    assert.deepEqual(result.agenda.map((item) => item.text), ['Intro', 'Conditions']);
    assert.ok(result.agenda.every((item) => item.done === false));
    assert.deepEqual(result.questions, []);
  });

  it('rejects a blank title and an unknown subject', () => {
    assert.equal(createRoom({ title: ' ', subject: 'Operating Systems' }, { subjects: ['Operating Systems'] }).error, 'title');
    assert.equal(createRoom({ title: 'T', subject: 'Astrology' }, { subjects: ['Operating Systems'] }).error, 'subject');
  });

  it('caps agenda items', () => {
    const many = Array.from({ length: 30 }, (_, index) => `Item ${index}`);
    assert.equal(createRoom({ title: 'T', subject: 'S', agenda: many }).room.agenda.length, MAX_AGENDA_ITEMS);
  });
});

describe('room edits', () => {
  it('parses agenda text, stripping bullets and numbers', () => {
    assert.deepEqual(parseAgendaText('- One\n2) Two\n\n* Three'), ['One', 'Two', 'Three']);
  });

  it('toggles an agenda item without touching others', () => {
    const next = toggleAgenda(room(), 'a1');
    assert.deepEqual(next.agenda.map((item) => item.done), [false, true]);
  });

  it('limits notes and appends without overwriting', () => {
    assert.equal(setNotes(room(), 'x'.repeat(MAX_NOTES + 50)).notes.length, MAX_NOTES);
    const first = appendToNotes(setNotes(room(), 'my note'), 'Diagram: Process states');
    assert.equal(first.room.notes, 'my note\nDiagram: Process states');
    assert.equal(appendToNotes(setNotes(room(), 'x'.repeat(MAX_NOTES)), 'more').added, false);
  });

  it('stores questions up to the limit', () => {
    let current = room();

    for (let index = 0; index < MAX_QUESTIONS + 2; index += 1) {
      current = addQuestion(current, { question: `Q${index}`, answer: 'A' }).room;
    }

    assert.equal(current.questions.length, MAX_QUESTIONS);
    assert.equal(addQuestion(current, { question: 'extra', answer: '' }).added, false);
    assert.equal(addQuestion(room(), { question: '  ', answer: 'A' }).added, false);
  });

  it('detects whether there is anything to summarise', () => {
    assert.equal(hasSessionContent(room()), false);
    assert.equal(hasSessionContent(setNotes(room(), 'notes')), true);
    assert.equal(hasSessionContent(toggleAgenda(room(), 'a0')), true);
  });
});

describe('summary', () => {
  it('builds a request from the room', () => {
    const request = buildSummaryRequest(addQuestion(setNotes(room(), 'n'), { question: 'Q', answer: 'A' }).room, 'te');
    assert.deepEqual(request.agenda, ['Intro', 'Conditions']);
    assert.deepEqual(request.questions, [{ question: 'Q', answer: 'A' }]);
    assert.equal(request.language, 'te');
  });

  it('validates the response', () => {
    const parsed = parseSummaryResponse({ summary: ' Covered it. ', keyPoints: ['a', 3, ''], revisionQuestions: [{ question: 'Q?', hint: 'h' }, { nope: 1 }] });
    assert.deepEqual(parsed, { summary: 'Covered it.', keyPoints: ['a'], revisionQuestions: [{ question: 'Q?', hint: 'h' }] });
    assert.throws(() => parseSummaryResponse({ summary: '' }), InvalidSummaryError);
    assert.throws(() => parseSummaryResponse(null), InvalidSummaryError);
  });
});

describe('storage', () => {
  it('round-trips a room with a summary', () => {
    const storage = memoryStorage();
    const withSummary = setSummary(room(), { summary: 'S', keyPoints: ['k'], revisionQuestions: [{ question: 'Q', hint: '' }] });
    assert.equal(saveRoom(withSummary, storage).ok, true);
    const loaded = loadRoom(storage);
    assert.equal(loaded.room.summary.summary, 'S');
    assert.equal(loaded.room.agenda.length, 2);
  });

  it('empty before first save; clearing removes the record', () => {
    const storage = memoryStorage();
    assert.deepEqual(loadRoom(storage), { room: null, issue: null });
    saveRoom(room(), storage);
    saveRoom(null, storage);
    assert.equal(CLASSROOM_STORAGE_KEY in storage.data, false);
  });

  it('treats corrupt data as unreadable instead of crashing', () => {
    assert.equal(loadRoom(memoryStorage({ [CLASSROOM_STORAGE_KEY]: '{bad' })).issue, 'unreadable');
    assert.equal(loadRoom(memoryStorage({ [CLASSROOM_STORAGE_KEY]: JSON.stringify({ version: 1, room: { id: 5 } }) })).issue, 'unreadable');
  });

  it('reports unavailable storage and quota failures', () => {
    assert.equal(loadRoom(null).issue, 'unavailable');
    assert.equal(saveRoom(room(), null).ok, false);
    assert.equal(saveRoom(room(), { setItem: () => { throw new Error('quota'); }, removeItem: () => {} }).ok, false);
  });

  it('sanitises stored fields', () => {
    const raw = JSON.stringify({
      version: 1,
      room: { id: 'r1', title: 'T', subject: 'S', agenda: [{ text: 'a', done: 'yes' }, { text: '' }], notes: 'n', questions: [{ question: '' }], summary: { summary: '' } }
    });
    const loaded = loadRoom(memoryStorage({ [CLASSROOM_STORAGE_KEY]: raw })).room;
    assert.deepEqual(loaded.agenda, [{ id: 'a0', text: 'a', done: false }]);
    assert.deepEqual(loaded.questions, []);
    assert.equal(loaded.summary, null);
  });
});
