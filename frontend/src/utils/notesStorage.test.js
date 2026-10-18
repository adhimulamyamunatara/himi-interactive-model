import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMemoryStorage } from '../test-utils/memoryStorage.js';
import {
  MAX_SAVED_SUMMARIES,
  NOTES_BACKUP_KEY,
  NOTES_STORAGE_KEY,
  NOTES_STORAGE_VERSION,
  addSummaryRecord,
  canAddSummary,
  clearSavedSummaries,
  createSummaryRecord,
  loadSavedSummaries,
  parseSummaryRecord,
  removeSummaryRecord,
  saveSummaries
} from './notesStorage.js';

const notes = () => ({
  summary: 'A summary.',
  key_concepts: [{ term: 'T', explanation: 'E' }],
  definitions: [],
  takeaways: ['A'],
  revision_questions: ['Q?']
});
const NOW = new Date('2026-10-18T10:00:00.000Z');
const record = (id, extra = {}) => createSummaryRecord({ id, title: `Title ${id}`, fileName: `${id}.pdf`, pageCount: 3, notes: notes(), ...extra }, NOW);

describe('saved summaries', () => {
  it('stores only the summary and labels: never the PDF or the extracted text', () => {
    const created = createSummaryRecord(
      { id: 'a', title: 'T', fileName: 'a.pdf', pageCount: 1, notes: notes(), text: 'SECRET DOCUMENT TEXT', file: 'blob' },
      NOW
    );
    assert.deepEqual(Object.keys(created).sort(), ['createdAt', 'fileName', 'id', 'notes', 'pageCount', 'title']);
    const storage = createMemoryStorage();
    saveSummaries([created], storage);
    assert.doesNotMatch(storage.data.get(NOTES_STORAGE_KEY), /SECRET DOCUMENT TEXT|blob/);
  });

  it('round-trips records', () => {
    const storage = createMemoryStorage();
    const records = [record('a'), record('b')];
    assert.equal(saveSummaries(records, storage), true);
    assert.deepEqual(loadSavedSummaries(storage), { records, issue: null, skipped: 0 });
    assert.equal(JSON.parse(storage.data.get(NOTES_STORAGE_KEY)).version, NOTES_STORAGE_VERSION);
  });

  it('starts empty and without an issue when nothing is stored', () => {
    assert.deepEqual(loadSavedSummaries(createMemoryStorage()), { records: [], issue: null, skipped: 0 });
  });

  it('recovers from unparseable data with a backup and an issue flag', () => {
    const storage = createMemoryStorage({ [NOTES_STORAGE_KEY]: '{oops' });
    const result = loadSavedSummaries(storage);
    assert.equal(result.issue, 'unreadable');
    assert.deepEqual(result.records, []);
    assert.equal(storage.data.get(NOTES_BACKUP_KEY), '{oops');
  });

  it('treats a wrong version or shape as unreadable', () => {
    for (const value of [{ version: 2, summaries: [] }, { version: 1 }, [], 'x']) {
      const storage = createMemoryStorage({ [NOTES_STORAGE_KEY]: JSON.stringify(value) });
      assert.equal(loadSavedSummaries(storage).issue, 'unreadable');
    }
  });

  it('skips bad records, keeps good ones and backs up the original', () => {
    const good = record('good');
    const raw = JSON.stringify({
      version: 1,
      summaries: [good, { id: 'bad id!', notes: notes() }, { id: 'x', notes: { summary: '' } }, null, good]
    });
    const storage = createMemoryStorage({ [NOTES_STORAGE_KEY]: raw });
    const result = loadSavedSummaries(storage);
    assert.equal(result.issue, 'partial');
    assert.equal(result.skipped, 4);
    assert.deepEqual(result.records, [good]);
    assert.equal(storage.data.get(NOTES_BACKUP_KEY), raw);
  });

  it('caps the number of loaded records', () => {
    const many = Array.from({ length: MAX_SAVED_SUMMARIES + 5 }, (_, index) => record(`r${index}`));
    const storage = createMemoryStorage({ [NOTES_STORAGE_KEY]: JSON.stringify({ version: 1, summaries: many }) });
    assert.equal(loadSavedSummaries(storage).records.length, MAX_SAVED_SUMMARIES);
  });

  it('falls back to safe labels', () => {
    const parsed = parseSummaryRecord({ id: 'a', title: '   ', fileName: '', pageCount: -4, createdAt: 'nonsense', notes: notes() });
    assert.equal(parsed.title, 'Untitled notes');
    assert.equal(parsed.pageCount, 0);
    assert.equal(parsed.createdAt, new Date(0).toISOString());
  });

  it('reports blocked storage and write failures without throwing', () => {
    assert.equal(loadSavedSummaries(null).issue, 'unavailable');
    assert.equal(saveSummaries([], null), false);
    assert.equal(saveSummaries([], createMemoryStorage({}, { failWrites: true })), false);
    assert.equal(clearSavedSummaries(null), false);
  });

  it('adds newest first, replaces duplicates, removes by id and enforces the cap', () => {
    const list = addSummaryRecord(addSummaryRecord([], record('a')), record('b'));
    assert.deepEqual(list.map((item) => item.id), ['b', 'a']);
    assert.deepEqual(addSummaryRecord(list, record('a')).map((item) => item.id), ['a', 'b']);
    assert.deepEqual(removeSummaryRecord(list, 'b').map((item) => item.id), ['a']);
    assert.equal(removeSummaryRecord(list, 'zzz').length, 2);
    assert.equal(canAddSummary(Array.from({ length: MAX_SAVED_SUMMARIES }, (_, index) => record(`r${index}`))), false);
    assert.equal(canAddSummary(list), true);
  });

  it('clearing removes the data and the recovery copy', () => {
    const storage = createMemoryStorage({ [NOTES_STORAGE_KEY]: '[]', [NOTES_BACKUP_KEY]: 'old' });
    assert.equal(clearSavedSummaries(storage), true);
    assert.equal(storage.data.size, 0);
  });
});
