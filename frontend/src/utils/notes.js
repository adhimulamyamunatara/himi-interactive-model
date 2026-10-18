/**
 * PDF notes: client-side checks, response parsing and plain-text export.
 * Limits mirror the backend (the backend is the real gatekeeper; these checks only give early, friendly feedback).
 */

export const MAX_PDF_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_PAGES = 60;
export const MAX_NOTES_CHARS = 60_000;

export class InvalidNotesResponseError extends Error {
  constructor(message = 'The server sent an unexpected response.') {
    super(message);
    this.name = 'InvalidNotesResponseError';
  }
}

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;

export function formatFileSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Quick check of the chosen file's name, declared type and size.
 *
 * @param {{name: string, type: string, size: number} | null | undefined} file
 * @returns {{ok: true} | {ok: false, error: string}}
 */
export function validatePdfFile(file) {
  if (!file) {
    return { ok: false, error: 'Choose a PDF file first.' };
  }

  const name = typeof file.name === 'string' ? file.name.toLowerCase() : '';
  const looksLikePdf = file.type === 'application/pdf' || (file.type === '' && name.endsWith('.pdf'));

  if (!looksLikePdf) {
    return { ok: false, error: 'Only PDF files are supported. Choose a file ending in .pdf.' };
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, error: 'This file is empty.' };
  }

  if (file.size > MAX_PDF_BYTES) {
    return {
      ok: false,
      error: `This file is ${formatFileSize(file.size)}. The limit is ${formatFileSize(MAX_PDF_BYTES)}.`
    };
  }

  return { ok: true };
}

/** Real PDFs contain "%PDF-" near the start, whatever the file is called. */
export function hasPdfSignature(bytes) {
  const head = String.fromCharCode(...Array.from(bytes.slice(0, 1024)));
  return head.includes('%PDF-');
}

/** Read the start of a File and check it really looks like a PDF. Never reads the whole file. */
export async function looksLikePdfContent(file) {
  try {
    const buffer = await file.slice(0, 1024).arrayBuffer();
    return hasPdfSignature(new Uint8Array(buffer));
  } catch {
    return false;
  }
}

export function parseExtractResponse(data) {
  if (
    !isObject(data) ||
    data.status !== 'success' ||
    !isText(data.text) ||
    !Number.isInteger(data.page_count) ||
    !Number.isInteger(data.word_count) ||
    !Number.isInteger(data.character_count)
  ) {
    throw new InvalidNotesResponseError();
  }

  return {
    text: data.text,
    pageCount: data.page_count,
    wordCount: data.word_count,
    characterCount: data.character_count,
    truncated: data.truncated === true
  };
}

function pairList(raw, first, second) {
  if (!Array.isArray(raw)) {
    return null;
  }

  const items = [];

  for (const item of raw) {
    if (!isObject(item) || !isText(item[first]) || !isText(item[second])) {
      return null;
    }

    items.push({ [first]: item[first].trim(), [second]: item[second].trim() });
  }

  return items;
}

function stringList(raw) {
  return Array.isArray(raw) && raw.every(isText) ? raw.map((item) => item.trim()) : null;
}

/** Validate the summary object itself (used for API responses and for data read back from storage). */
export function normalizeNotesSummary(raw) {
  if (!isObject(raw) || !isText(raw.summary)) {
    return null;
  }

  const keyConcepts = pairList(raw.key_concepts, 'term', 'explanation');
  const definitions = pairList(raw.definitions ?? [], 'term', 'definition');
  const takeaways = stringList(raw.takeaways);
  const revisionQuestions = stringList(raw.revision_questions);

  if (!keyConcepts || !definitions || !takeaways || !revisionQuestions) {
    return null;
  }

  return {
    summary: raw.summary.trim(),
    key_concepts: keyConcepts,
    definitions,
    takeaways,
    revision_questions: revisionQuestions
  };
}

export function parseSummaryResponse(data) {
  if (!isObject(data) || data.status !== 'success') {
    throw new InvalidNotesResponseError();
  }

  const notes = normalizeNotesSummary(data.notes);

  if (!notes) {
    throw new InvalidNotesResponseError();
  }

  return { title: isText(data.title) ? data.title.trim() : null, notes };
}

/** A readable plain-text version of a summary (for copying). */
export function summaryToPlainText(notes, title) {
  const lines = [];

  if (title) {
    lines.push(title, '');
  }

  lines.push('SUMMARY', notes.summary, '', 'KEY CONCEPTS');
  notes.key_concepts.forEach((item) => lines.push(`- ${item.term}: ${item.explanation}`));

  if (notes.definitions.length > 0) {
    lines.push('', 'DEFINITIONS');
    notes.definitions.forEach((item) => lines.push(`- ${item.term}: ${item.definition}`));
  }

  lines.push('', 'KEY TAKEAWAYS');
  notes.takeaways.forEach((item) => lines.push(`- ${item}`));
  lines.push('', 'REVISION QUESTIONS');
  notes.revision_questions.forEach((item, index) => lines.push(`${index + 1}. ${item}`));

  return lines.join('\n');
}
