/**
 * Campus Assistant, client side. Pure and framework-free.
 *
 * HIMI ships NO college data. The student (or their college) adds documents, they are stored only in this browser,
 * and a question is answered only from the most relevant passages of those documents. Citations coming back from
 * the server are re-checked here against the stored text before they are shown.
 */

export const CAMPUS_STORAGE_KEY = 'himi_campus_docs_v1';
export const CAMPUS_STORAGE_VERSION = 1;
export const MAX_DOCS = 12;
export const MAX_DOC_TITLE = 80;
export const MAX_DOC_TEXT = 20000;
export const MAX_QUESTION_CHARS = 400;
export const MAX_SEND_SOURCES = 8;
export const MAX_SEND_SOURCE_TEXT = 4000;
export const MAX_SEND_TOTAL = 20000;
const CHUNK_TARGET = 700;

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
// eslint-disable-next-line no-control-regex
const oneLine = (value) => String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
// Keep newlines and tabs so lists and tables in a document stay readable.
// eslint-disable-next-line no-control-regex
const multiline = (value) => String(value ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
export const normaliseText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

export const createDocId = () => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/* --------------------------------------------------------------- documents */

/** @returns {{ok: true, doc: object} | {ok: false, error: 'title' | 'text' | 'tooLong'}} */
export function validateDocument({ title, text }) {
  const cleanTitle = oneLine(title).slice(0, MAX_DOC_TITLE);
  const cleanText = multiline(text);

  if (!cleanTitle) {
    return { ok: false, error: 'title' };
  }

  if (!cleanText) {
    return { ok: false, error: 'text' };
  }

  if (cleanText.length > MAX_DOC_TEXT) {
    return { ok: false, error: 'tooLong' };
  }

  return { ok: true, doc: { title: cleanTitle, text: cleanText } };
}

function parseDoc(raw) {
  if (!isObject(raw) || typeof raw.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(raw.id)) {
    return null;
  }

  const checked = validateDocument({ title: raw.title, text: raw.text });
  return checked.ok ? { id: raw.id, ...checked.doc, updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null } : null;
}

export const getBrowserStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

/** Never throws. `issue` is 'unavailable' | 'unreadable' | 'repaired' | null. */
export function loadDocuments(storage = getBrowserStorage()) {
  if (!storage) {
    return { docs: [], issue: 'unavailable' };
  }

  let raw;

  try {
    raw = storage.getItem(CAMPUS_STORAGE_KEY);
  } catch {
    return { docs: [], issue: 'unavailable' };
  }

  if (raw === null) {
    return { docs: [], issue: null };
  }

  try {
    const parsed = JSON.parse(raw);

    if (!isObject(parsed) || parsed.version !== CAMPUS_STORAGE_VERSION || !Array.isArray(parsed.docs)) {
      return { docs: [], issue: 'unreadable' };
    }

    const seen = new Set();
    const docs = [];

    for (const item of parsed.docs) {
      const doc = parseDoc(item);

      if (doc && !seen.has(doc.id) && docs.length < MAX_DOCS) {
        seen.add(doc.id);
        docs.push(doc);
      }
    }

    return { docs, issue: docs.length === parsed.docs.length ? null : 'repaired' };
  } catch {
    return { docs: [], issue: 'unreadable' };
  }
}

/** @returns {{ok: boolean}} */
export function saveDocuments(docs, storage = getBrowserStorage()) {
  if (!storage) {
    return { ok: false };
  }

  try {
    if (docs.length === 0) {
      storage.removeItem(CAMPUS_STORAGE_KEY);
    } else {
      storage.setItem(CAMPUS_STORAGE_KEY, JSON.stringify({ version: CAMPUS_STORAGE_VERSION, docs }));
    }

    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/* --------------------------------------------------------------- retrieval */

const tokens = (value) => new Set((String(value).toLowerCase().match(/[\p{L}\p{M}\p{N}]{3,}/gu) ?? []).filter((word) => !STOP.has(word)));
const STOP = new Set(['the', 'and', 'for', 'are', 'what', 'when', 'where', 'who', 'how', 'does', 'was', 'with', 'this', 'that', 'from', 'have', 'can', 'will', 'you', 'your', 'our']);

/** Split a document into passages of roughly CHUNK_TARGET characters on paragraph and sentence boundaries. */
export function chunkDocument(text) {
  const pieces = text
    .split(/\n{2,}|(?<=[.!?])\s+/u)
    .map((piece) => piece.trim())
    .filter(Boolean);
  const chunks = [];
  let current = '';

  for (const piece of pieces) {
    if (current && current.length + piece.length + 1 > CHUNK_TARGET) {
      chunks.push(current);
      current = '';
    }

    current = current ? `${current} ${piece}` : piece;

    while (current.length > MAX_SEND_SOURCE_TEXT) {
      chunks.push(current.slice(0, MAX_SEND_SOURCE_TEXT));
      current = current.slice(MAX_SEND_SOURCE_TEXT);
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

/**
 * Choose the passages most likely to answer a question. Each document is sent at most once, with its chosen passages
 * in their original order. Falls back to the start of each document when no words overlap (for example a Telugu
 * question about an English document), so the model can still look.
 */
export function selectSources(question, docs) {
  const wanted = tokens(question);
  const scored = [];

  docs.forEach((doc, docIndex) => {
    chunkDocument(doc.text).forEach((chunk, chunkIndex) => {
      const words = tokens(chunk);
      let score = 0;

      wanted.forEach((word) => {
        if (words.has(word)) {
          score += 1;
        }
      });

      scored.push({ docIndex, chunkIndex, chunk, score });
    });
  });

  const anyMatch = scored.some((item) => item.score > 0);
  const ranked = [...scored].sort((a, b) => (anyMatch ? b.score - a.score : a.chunkIndex - b.chunkIndex) || a.docIndex - b.docIndex || a.chunkIndex - b.chunkIndex);
  const perDoc = new Map();
  let total = 0;

  for (const item of ranked) {
    if (anyMatch && item.score === 0) {
      break;
    }

    const entry = perDoc.get(item.docIndex) ?? { length: 0, items: [] };
    const cost = item.chunk.length + 1;

    if (entry.length + cost > MAX_SEND_SOURCE_TEXT || total + cost > MAX_SEND_TOTAL) {
      continue;
    }

    if (!perDoc.has(item.docIndex) && perDoc.size >= MAX_SEND_SOURCES) {
      continue;
    }

    entry.length += cost;
    entry.items.push(item);
    total += cost;
    perDoc.set(item.docIndex, entry);
  }

  return [...perDoc.entries()]
    .sort(([a], [b]) => a - b)
    .map(([docIndex, entry]) => ({
      id: docs[docIndex].id,
      title: docs[docIndex].title,
      text: entry.items
        .sort((a, b) => a.chunkIndex - b.chunkIndex)
        .map((item) => item.chunk)
        .join('\n')
    }));
}

/* ------------------------------------------------------------ request/response */

/** @returns {{ok: true, request: object, sources: object[]} | {ok: false, error: 'question' | 'noDocs'}} */
export function buildCampusRequest({ question, docs, language }) {
  const clean = oneLine(question).slice(0, MAX_QUESTION_CHARS);

  if (!clean) {
    return { ok: false, error: 'question' };
  }

  if (docs.length === 0) {
    return { ok: false, error: 'noDocs' };
  }

  const sources = selectSources(clean, docs);
  return { ok: true, request: { question: clean, sources, language }, sources };
}

export class InvalidCampusResponseError extends Error {
  constructor(message = 'The campus answer was not in the expected format.') {
    super(message);
    this.name = 'InvalidCampusResponseError';
  }
}

/**
 * Validate a `/api/campus/ask` payload. An "answered" response is only trusted if it has at least one citation whose
 * quote really occurs in the text that was sent. Otherwise it is rejected, never shown as an answer.
 */
export function parseCampusResponse(data, sentSources) {
  if (!isObject(data) || !['answered', 'not_found'].includes(data.status) || typeof data.answer !== 'string' || !data.answer.trim()) {
    throw new InvalidCampusResponseError();
  }

  const requestId = typeof data.requestId === 'string' ? data.requestId.slice(0, 40) : '';

  if (data.status === 'not_found') {
    return { requestId, status: 'not_found', answer: data.answer.trim().slice(0, 600), citations: [] };
  }

  const byId = new Map(sentSources.map((source) => [source.id, source]));
  const citations = [];

  for (const item of Array.isArray(data.citations) ? data.citations : []) {
    const source = isObject(item) ? byId.get(item.sourceId) : null;
    const quote = isObject(item) && typeof item.quote === 'string' ? item.quote.trim() : '';

    if (source && quote && normaliseText(source.text).includes(normaliseText(quote))) {
      citations.push({ sourceId: source.id, title: source.title, quote: quote.slice(0, 300) });
    }
  }

  if (citations.length === 0) {
    throw new InvalidCampusResponseError('Answer had no verifiable citation.');
  }

  return { requestId, status: 'answered', answer: data.answer.trim().slice(0, 1500), citations: citations.slice(0, 4) };
}
