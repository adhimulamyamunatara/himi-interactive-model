import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCampusRequest,
  CAMPUS_STORAGE_KEY,
  chunkDocument,
  InvalidCampusResponseError,
  loadDocuments,
  MAX_DOC_TEXT,
  MAX_DOCS,
  MAX_SEND_SOURCE_TEXT,
  MAX_SEND_TOTAL,
  parseCampusResponse,
  saveDocuments,
  selectSources,
  validateDocument
} from './campus.js';

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

const LIBRARY = 'The central library is open from 8:30 AM to 6:00 PM on weekdays. Late return fine is Rs. 2 per day.';
const docs = [
  { id: 'lib', title: 'Library rules', text: LIBRARY },
  { id: 'hos', title: 'Hostel rules', text: 'Hostel gate closes at 9:30 PM. Contact the warden for late passes.' }
];

describe('validateDocument', () => {
  it('cleans a title and keeps newlines in the text', () => {
    const result = validateDocument({ title: '  Fee\nnotice ', text: 'Line one\nLine two  ' });
    assert.equal(result.ok, true);
    assert.equal(result.doc.title, 'Fee notice');
    assert.equal(result.doc.text, 'Line one\nLine two');
  });

  it('rejects blank title, blank text and oversized text', () => {
    assert.equal(validateDocument({ title: ' ', text: 'x' }).error, 'title');
    assert.equal(validateDocument({ title: 'T', text: '  ' }).error, 'text');
    assert.equal(validateDocument({ title: 'T', text: 'x'.repeat(MAX_DOC_TEXT + 1) }).error, 'tooLong');
  });
});

describe('document storage', () => {
  it('round-trips documents', () => {
    const storage = memoryStorage();
    assert.equal(saveDocuments(docs, storage).ok, true);
    assert.deepEqual(loadDocuments(storage).docs.map((doc) => doc.id), ['lib', 'hos']);
  });

  it('is empty (not an error) before anything is saved', () => {
    assert.deepEqual(loadDocuments(memoryStorage()), { docs: [], issue: null });
  });

  it('saving nothing removes the record', () => {
    const storage = memoryStorage();
    saveDocuments(docs, storage);
    saveDocuments([], storage);
    assert.equal(CAMPUS_STORAGE_KEY in storage.data, false);
  });

  it('survives corrupt data', () => {
    assert.equal(loadDocuments(memoryStorage({ [CAMPUS_STORAGE_KEY]: '{oops' })).issue, 'unreadable');
    assert.equal(loadDocuments(memoryStorage({ [CAMPUS_STORAGE_KEY]: JSON.stringify({ version: 9, docs: [] }) })).issue, 'unreadable');
  });

  it('drops invalid, duplicate and excess documents and reports it', () => {
    const many = Array.from({ length: MAX_DOCS + 3 }, (_, index) => ({ id: `d${index}`, title: 'T', text: 'x' }));
    const raw = JSON.stringify({ version: 1, docs: [{ id: 'bad id!', title: 'T', text: 'x' }, { id: 'a', title: '', text: 'x' }, ...many, many[0]] });
    const result = loadDocuments(memoryStorage({ [CAMPUS_STORAGE_KEY]: raw }));
    assert.equal(result.docs.length, MAX_DOCS);
    assert.equal(result.issue, 'repaired');
  });

  it('reports unavailable storage and failed writes without throwing', () => {
    assert.equal(loadDocuments(null).issue, 'unavailable');
    assert.equal(saveDocuments(docs, null).ok, false);
    const full = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {} };
    assert.equal(saveDocuments(docs, full).ok, false);
  });
});

describe('retrieval', () => {
  it('chunks long text on sentence boundaries', () => {
    const text = Array.from({ length: 40 }, (_, index) => `Sentence number ${index} says something useful.`).join(' ');
    const chunks = chunkDocument(text);
    assert.ok(chunks.length > 1);
    assert.ok(chunks.every((chunk) => chunk.length <= 800));
    assert.equal(chunks.join(' '), text);
  });

  it('prefers the document that shares words with the question', () => {
    const sources = selectSources('When does the library open?', docs);
    assert.deepEqual(sources.map((source) => source.id), ['lib']);
  });

  it('falls back to the start of each document when no words overlap', () => {
    const sources = selectSources('తెలుగు ప్రశ్న', docs);
    assert.deepEqual(sources.map((source) => source.id), ['lib', 'hos']);
  });

  it('respects the per-document and total limits', () => {
    const big = Array.from({ length: 12 }, (_, index) => ({
      id: `b${index}`,
      title: `Doc ${index}`,
      text: Array.from({ length: 200 }, (_, line) => `Fee rule ${line} covers the fee amount.`).join(' ')
    }));
    const sources = selectSources('fee amount', big);
    assert.ok(sources.length <= 8);
    assert.ok(sources.every((source) => source.text.length <= MAX_SEND_SOURCE_TEXT));
    assert.ok(sources.reduce((sum, source) => sum + source.text.length, 0) <= MAX_SEND_TOTAL);
  });
});

describe('buildCampusRequest', () => {
  it('needs a question and at least one document', () => {
    assert.equal(buildCampusRequest({ question: '  ', docs, language: 'en' }).error, 'question');
    assert.equal(buildCampusRequest({ question: 'hi', docs: [], language: 'en' }).error, 'noDocs');
  });

  it('builds a request with selected sources only', () => {
    const built = buildCampusRequest({ question: 'library hours', docs, language: 'te' });
    assert.equal(built.ok, true);
    assert.equal(built.request.language, 'te');
    assert.deepEqual(Object.keys(built.request.sources[0]).sort(), ['id', 'text', 'title']);
  });
});

describe('parseCampusResponse', () => {
  const sent = [{ id: 'lib', title: 'Library rules', text: LIBRARY }];
  const answered = (overrides = {}) => ({
    requestId: 'r1',
    status: 'answered',
    answer: 'Open 8:30 AM to 6:00 PM.',
    citations: [{ sourceId: 'lib', title: 'whatever', quote: 'open from 8:30 am to 6:00 pm' }],
    ...overrides
  });

  it('accepts a verifiable citation and uses the stored title', () => {
    const result = parseCampusResponse(answered(), sent);
    assert.equal(result.status, 'answered');
    assert.equal(result.citations[0].title, 'Library rules');
  });

  it('rejects an answer whose quote is not in the sent text', () => {
    assert.throws(() => parseCampusResponse(answered({ citations: [{ sourceId: 'lib', quote: 'open on Sundays' }] }), sent), InvalidCampusResponseError);
  });

  it('rejects an answer without citations or with an unknown source', () => {
    assert.throws(() => parseCampusResponse(answered({ citations: [] }), sent), InvalidCampusResponseError);
    assert.throws(() => parseCampusResponse(answered({ citations: [{ sourceId: 'x', quote: 'open from' }] }), sent), InvalidCampusResponseError);
  });

  it('passes not_found through with no citations', () => {
    const result = parseCampusResponse({ status: 'not_found', answer: 'Not in your documents.', citations: [{ sourceId: 'lib', quote: 'x' }] }, sent);
    assert.deepEqual(result.citations, []);
  });

  it('rejects malformed payloads', () => {
    for (const bad of [null, [], { status: 'maybe', answer: 'x' }, { status: 'answered', answer: '' }]) {
      assert.throws(() => parseCampusResponse(bad, sent), InvalidCampusResponseError);
    }
  });
});
