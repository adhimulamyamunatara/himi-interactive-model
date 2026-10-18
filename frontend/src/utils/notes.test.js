import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  InvalidNotesResponseError,
  MAX_PDF_BYTES,
  formatFileSize,
  hasPdfSignature,
  looksLikePdfContent,
  normalizeNotesSummary,
  parseExtractResponse,
  parseSummaryResponse,
  summaryToPlainText,
  validatePdfFile
} from './notes.js';

const pdf = (overrides = {}) => ({ name: 'notes.pdf', type: 'application/pdf', size: 1000, ...overrides });
const summary = (overrides = {}) => ({
  summary: 'Transactions are units of work.',
  key_concepts: [{ term: 'Transaction', explanation: 'A unit of work.' }],
  definitions: [{ term: 'Atomicity', definition: 'All or nothing.' }],
  takeaways: ['ACID matters.'],
  revision_questions: ['What is ACID?'],
  ...overrides
});

describe('validatePdfFile', () => {
  it('accepts a normal PDF', () => {
    assert.deepEqual(validatePdfFile(pdf()), { ok: true });
  });

  it('accepts a PDF whose browser type is blank when the name ends in .pdf', () => {
    assert.equal(validatePdfFile(pdf({ type: '', name: 'SCAN.PDF' })).ok, true);
  });

  it('rejects other types with a clear message', () => {
    for (const file of [pdf({ type: 'image/png', name: 'a.png' }), pdf({ type: 'text/plain' }), pdf({ type: '', name: 'a.txt' })]) {
      const result = validatePdfFile(file);
      assert.equal(result.ok, false);
      assert.match(result.error, /Only PDF files/);
    }
  });

  it('rejects empty and oversized files, naming the limit', () => {
    assert.match(validatePdfFile(pdf({ size: 0 })).error, /empty/);
    const big = validatePdfFile(pdf({ size: MAX_PDF_BYTES + 1 }));
    assert.equal(big.ok, false);
    assert.match(big.error, /limit is 5\.0 MB/);
    assert.equal(validatePdfFile(pdf({ size: MAX_PDF_BYTES })).ok, true);
  });

  it('rejects a missing file', () => {
    assert.equal(validatePdfFile(null).ok, false);
    assert.equal(validatePdfFile(undefined).ok, false);
  });

  it('formats sizes', () => {
    assert.equal(formatFileSize(512), '512 B');
    assert.equal(formatFileSize(2048), '2.0 KB');
    assert.equal(formatFileSize(3 * 1024 * 1024), '3.0 MB');
  });
});

describe('PDF signature', () => {
  const bytes = (text) => new TextEncoder().encode(text);

  it('recognises the header and ignores other content', () => {
    assert.equal(hasPdfSignature(bytes('%PDF-1.7\n...')), true);
    assert.equal(hasPdfSignature(bytes('hello world')), false);
    assert.equal(hasPdfSignature(bytes('PK\u0003\u0004')), false);
  });

  it('reads only the start of a file', async () => {
    let sliceArgs = null;
    const file = {
      slice: (...args) => {
        sliceArgs = args;
        return { arrayBuffer: async () => bytes('%PDF-1.4').buffer };
      }
    };
    assert.equal(await looksLikePdfContent(file), true);
    assert.deepEqual(sliceArgs, [0, 1024]);
  });

  it('treats unreadable files as not PDFs', async () => {
    const file = { slice: () => ({ arrayBuffer: async () => { throw new Error('denied'); } }) };
    assert.equal(await looksLikePdfContent(file), false);
  });
});

describe('response parsing', () => {
  const extract = { status: 'success', text: 'Some text', page_count: 2, word_count: 2, character_count: 9, truncated: false };

  it('maps the extraction response', () => {
    assert.deepEqual(parseExtractResponse(extract), {
      text: 'Some text',
      pageCount: 2,
      wordCount: 2,
      characterCount: 9,
      truncated: false
    });
  });

  it('rejects malformed extraction responses', () => {
    for (const bad of [null, {}, { ...extract, status: 'error' }, { ...extract, text: '  ' }, { ...extract, page_count: '2' }, []]) {
      assert.throws(() => parseExtractResponse(bad), InvalidNotesResponseError);
    }
  });

  it('accepts a valid summary and keeps the title', () => {
    const parsed = parseSummaryResponse({ status: 'success', title: ' DBMS ', notes: summary() });
    assert.equal(parsed.title, 'DBMS');
    assert.equal(parsed.notes.key_concepts[0].term, 'Transaction');
  });

  it('allows empty definitions but nothing else missing', () => {
    assert.deepEqual(normalizeNotesSummary(summary({ definitions: [] })).definitions, []);
    assert.deepEqual(normalizeNotesSummary({ ...summary(), definitions: undefined }).definitions, []);
  });

  it('rejects malformed summaries', () => {
    const bad = [
      summary({ summary: '' }),
      summary({ key_concepts: 'x' }),
      summary({ key_concepts: [{ term: 'T' }] }),
      summary({ takeaways: [1] }),
      summary({ revision_questions: null }),
      null,
      []
    ];
    for (const notes of bad) {
      assert.equal(normalizeNotesSummary(notes), null);
      assert.throws(() => parseSummaryResponse({ status: 'success', notes }), InvalidNotesResponseError);
    }
    assert.throws(() => parseSummaryResponse({ status: 'error', notes: summary() }), InvalidNotesResponseError);
  });

  it('builds a readable plain-text export', () => {
    const text = summaryToPlainText(summary(), 'DBMS notes');
    assert.match(text, /^DBMS notes/);
    assert.match(text, /KEY CONCEPTS\n- Transaction: A unit of work\./);
    assert.match(text, /DEFINITIONS\n- Atomicity/);
    assert.match(text, /1\. What is ACID\?/);
    assert.doesNotMatch(summaryToPlainText(summary({ definitions: [] })), /DEFINITIONS/);
  });
});
