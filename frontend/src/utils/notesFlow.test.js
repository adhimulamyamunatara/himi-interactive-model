import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { initialNotesState, notesReducer } from './notesFlow.js';

const file = { name: 'notes.pdf', size: 2048 };
const extraction = { text: 'abc', pageCount: 1, wordCount: 1, characterCount: 3, truncated: false };
const result = { title: 'T', notes: { summary: 's' } };
const run = (actions, start = initialNotesState) => actions.reduce(notesReducer, start);

const extracted = () =>
  run([
    { type: 'extractStarted', requestId: 1, file },
    { type: 'extractSucceeded', requestId: 1, extraction }
  ]);

describe('notes flow', () => {
  it('walks through the happy path', () => {
    let state = notesReducer(initialNotesState, { type: 'extractStarted', requestId: 1, file });
    assert.equal(state.phase, 'extracting');
    assert.deepEqual(state.file, file);

    state = notesReducer(state, { type: 'extractSucceeded', requestId: 1, extraction });
    assert.equal(state.phase, 'extracted');
    assert.equal(state.extraction, extraction);

    state = notesReducer(state, { type: 'summarizeStarted', requestId: 2 });
    assert.equal(state.phase, 'summarizing');

    state = notesReducer(state, { type: 'summarizeSucceeded', requestId: 2, result });
    assert.equal(state.phase, 'done');
    assert.equal(state.result, result);
  });

  it('does not keep the PDF itself in state', () => {
    const state = notesReducer(initialNotesState, {
      type: 'extractStarted',
      requestId: 1,
      file: { name: 'a.pdf', size: 1, arrayBuffer: () => {}, secret: 'x' }
    });
    assert.deepEqual(Object.keys(state.file), ['name', 'size']);
  });

  it('never summarises before text has been extracted', () => {
    assert.equal(notesReducer(initialNotesState, { type: 'summarizeStarted', requestId: 1 }), initialNotesState);
    const extracting = notesReducer(initialNotesState, { type: 'extractStarted', requestId: 1, file });
    assert.equal(notesReducer(extracting, { type: 'summarizeStarted', requestId: 2 }), extracting);
  });

  it('records extraction failures and lets the student start again', () => {
    let state = run([
      { type: 'extractStarted', requestId: 1, file },
      { type: 'extractFailed', requestId: 1, message: 'Encrypted' }
    ]);
    assert.deepEqual(state.error, { stage: 'extract', message: 'Encrypted' });
    // an extraction error cannot be "retried" as a summary
    assert.equal(notesReducer(state, { type: 'summarizeStarted', requestId: 2 }), state);
    state = notesReducer(state, { type: 'extractStarted', requestId: 2, file });
    assert.equal(state.phase, 'extracting');
    assert.equal(state.error, null);
  });

  it('keeps the extracted text after a summary failure so retry needs no re-upload', () => {
    let state = run(
      [
        { type: 'summarizeStarted', requestId: 2 },
        { type: 'summarizeFailed', requestId: 2, message: 'Timed out' }
      ],
      extracted()
    );
    assert.deepEqual(state.error, { stage: 'summarize', message: 'Timed out' });
    assert.equal(state.extraction, extraction);
    state = notesReducer(state, { type: 'summarizeStarted', requestId: 3 });
    assert.equal(state.phase, 'summarizing');
    assert.equal(state.error, null);
  });

  it('ignores answers for requests that are no longer current', () => {
    const extracting = notesReducer(initialNotesState, { type: 'extractStarted', requestId: 2, file });
    assert.equal(notesReducer(extracting, { type: 'extractSucceeded', requestId: 1, extraction }), extracting);
    assert.equal(notesReducer(extracting, { type: 'extractFailed', requestId: 1, message: 'x' }), extracting);

    const summarizing = notesReducer(extracted(), { type: 'summarizeStarted', requestId: 3 });
    assert.equal(notesReducer(summarizing, { type: 'summarizeSucceeded', requestId: 2, result }), summarizing);
    assert.equal(notesReducer(summarizing, { type: 'summarizeFailed', requestId: 2, message: 'x' }), summarizing);
  });

  it('a late answer after cancel or reset changes nothing', () => {
    const extracting = notesReducer(initialNotesState, { type: 'extractStarted', requestId: 1, file });
    const cancelled = notesReducer(extracting, { type: 'cancel', requestId: 2 });
    assert.equal(cancelled.phase, 'idle');
    assert.equal(notesReducer(cancelled, { type: 'extractSucceeded', requestId: 1, extraction }), cancelled);

    const summarizing = notesReducer(extracted(), { type: 'summarizeStarted', requestId: 2 });
    const backToText = notesReducer(summarizing, { type: 'cancel', requestId: 3 });
    assert.equal(backToText.phase, 'extracted');
    assert.equal(backToText.extraction, extraction);
    assert.equal(notesReducer(backToText, { type: 'summarizeSucceeded', requestId: 2, result }), backToText);

    const reset = notesReducer(summarizing, { type: 'reset', requestId: 4 });
    assert.equal(reset.phase, 'idle');
    assert.equal(reset.extraction, null);
    assert.equal(notesReducer(reset, { type: 'summarizeSucceeded', requestId: 2, result }), reset);
  });

  it('uploading another file replaces everything from the previous one', () => {
    const done = run(
      [
        { type: 'summarizeStarted', requestId: 2 },
        { type: 'summarizeSucceeded', requestId: 2, result }
      ],
      extracted()
    );
    const next = notesReducer(done, { type: 'extractStarted', requestId: 3, file: { name: 'other.pdf', size: 5 } });
    assert.equal(next.result, null);
    assert.equal(next.extraction, null);
    assert.equal(next.file.name, 'other.pdf');
  });

  it('cancel does nothing when nothing is in flight', () => {
    assert.equal(notesReducer(extracted(), { type: 'cancel', requestId: 9 }).phase, 'extracted');
    assert.equal(notesReducer(initialNotesState, { type: 'cancel', requestId: 9 }), initialNotesState);
  });
});
