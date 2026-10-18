/**
 * Pure helpers for the Code Assistant. The assistant ANALYSES code: nothing here, or anywhere in HIMI, runs it.
 */

export const CODE_LANGUAGES = [
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'c', label: 'C' },
  { value: 'javascript', label: 'JavaScript' }
];
export const CODE_TASKS = ['explain', 'debug', 'hints', 'complexity', 'tests'];

export const MAX_CODE_CHARS = 8000;
export const MAX_CODE_LINES = 300;
export const MAX_QUESTION_CHARS = 500;
export const MAX_ERROR_CHARS = 1500;

const SEVERITIES = ['info', 'warning', 'error'];

export class InvalidCodeResponseError extends Error {
  constructor(message = 'The code analysis was not in the expected format.') {
    super(message);
    this.name = 'InvalidCodeResponseError';
  }
}

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const line = (value, max) => (typeof value === 'string' && value.replace(/\s+/g, ' ').trim() ? value.replace(/\s+/g, ' ').trim().slice(0, max) : null);
const strings = (raw, max, limit) => (Array.isArray(raw) ? raw : []).flatMap((item) => (line(item, max) ? [line(item, max)] : [])).slice(0, limit);

export const countLines = (code) => (code.length === 0 ? 0 : code.split('\n').length);

/** @returns {null | 'empty' | 'too_long' | 'too_many_lines'} */
export function validateCodeInput(code) {
  if (code.trim().length === 0) {
    return 'empty';
  }

  if (code.length > MAX_CODE_CHARS) {
    return 'too_long';
  }

  return countLines(code) > MAX_CODE_LINES ? 'too_many_lines' : null;
}

export function buildCodeRequest({ code, codeLanguage, task, question, errorOutput, language, helpMode }) {
  const request = { code: code.replace(/\r\n?/g, '\n').replace(/\s+$/, ''), codeLanguage, task, language, helpMode };
  const cleanQuestion = (question ?? '').trim().slice(0, MAX_QUESTION_CHARS);
  const cleanError = (errorOutput ?? '').trim().slice(0, MAX_ERROR_CHARS);

  if (cleanQuestion) {
    request.question = cleanQuestion;
  }

  if (cleanError) {
    request.errorOutput = cleanError;
  }

  return request;
}

/**
 * Validate a `/api/code/assist` payload. A response that claims the code was executed or verified is rejected
 * outright, so the UI can never present analysis as the result of running anything.
 */
export function parseCodeResponse(data) {
  if (!isObject(data) || !CODE_TASKS.includes(data.task) || data.executed !== false || data.verified !== false) {
    throw new InvalidCodeResponseError();
  }

  const summary = typeof data.summary === 'string' ? data.summary.trim().slice(0, 1200) : '';

  if (!summary) {
    throw new InvalidCodeResponseError('Missing summary.');
  }

  const findings = (Array.isArray(data.findings) ? data.findings : []).flatMap((raw) => {
    const title = isObject(raw) ? line(raw.title, 120) : null;
    const detail = isObject(raw) ? line(raw.detail, 600) : null;

    return title && detail
      ? [{ severity: SEVERITIES.includes(raw.severity) ? raw.severity : 'info', line: Number.isInteger(raw.line) && raw.line >= 1 ? raw.line : null, title, detail }]
      : [];
  }).slice(0, 8);

  const complexity =
    isObject(data.complexity) && line(data.complexity.time, 80) && line(data.complexity.space, 80) && line(data.complexity.explanation, 700)
      ? { time: line(data.complexity.time, 80), space: line(data.complexity.space, 80), explanation: line(data.complexity.explanation, 700) }
      : null;

  const testCases = (Array.isArray(data.testCases) ? data.testCases : []).flatMap((raw) => {
    const name = isObject(raw) ? line(raw.name, 100) : null;

    return name && typeof raw.input === 'string' && typeof raw.expectedOutput === 'string'
      ? [{ name, input: raw.input.slice(0, 300), expectedOutput: raw.expectedOutput.slice(0, 300), why: line(raw.why, 300) ?? '' }]
      : [];
  }).slice(0, 6);

  return {
    requestId: line(data.requestId, 40) ?? '',
    task: data.task,
    codeLanguage: line(data.codeLanguage, 20) ?? '',
    language: data.language === 'te' ? 'te' : 'en',
    summary,
    findings,
    hints: strings(data.hints, 300, 5),
    complexity,
    testCases,
    improvedCode: typeof data.improvedCode === 'string' && data.improvedCode.trim() ? data.improvedCode.slice(0, MAX_CODE_CHARS) : null,
    followUps: strings(data.followUps, 160, 3),
    review: isObject(data.review) ? { passed: data.review.passed === true, issues: strings(data.review.issues, 300, 6) } : null,
    modelCalls: Number.isFinite(data.modelCalls) ? Math.max(0, Math.round(data.modelCalls)) : 0
  };
}

/** The text of one (1-based) line of the submitted code, trimmed for display. */
export function codeLine(code, number) {
  if (!Number.isInteger(number) || number < 1) {
    return null;
  }

  const text = code.split('\n')[number - 1];
  return text === undefined ? null : text.trim().slice(0, 160);
}
