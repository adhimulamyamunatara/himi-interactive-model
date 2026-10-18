import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildCodeRequest,
  codeLine,
  countLines,
  InvalidCodeResponseError,
  MAX_CODE_CHARS,
  MAX_CODE_LINES,
  parseCodeResponse,
  validateCodeInput
} from './codeAssist.js';

const payload = (overrides = {}) => ({
  requestId: 'c1',
  task: 'debug',
  codeLanguage: 'python',
  language: 'en',
  helpMode: 'guided',
  summary: 'Reading the code, the loop skips the last item.',
  findings: [{ severity: 'error', line: 3, title: 'Off by one', detail: 'The range stops early.' }],
  hints: ['Trace the loop with two items.'],
  complexity: null,
  testCases: [],
  improvedCode: null,
  followUps: ['What if the list is empty?'],
  executed: false,
  verified: false,
  review: { passed: true, issues: [] },
  modelCalls: 1,
  ...overrides
});

test('validateCodeInput accepts normal code and rejects empty, oversized and too many lines', () => {
  assert.equal(validateCodeInput('print(1)'), null);
  assert.equal(validateCodeInput('   \n  '), 'empty');
  assert.equal(validateCodeInput('x'.repeat(MAX_CODE_CHARS + 1)), 'too_long');
  assert.equal(validateCodeInput('x\n'.repeat(MAX_CODE_LINES + 1)), 'too_many_lines');
});

test('countLines counts lines and treats empty input as zero', () => {
  assert.equal(countLines(''), 0);
  assert.equal(countLines('a'), 1);
  assert.equal(countLines('a\nb\nc'), 3);
});

test('buildCodeRequest preserves indentation, normalises newlines and omits empty optionals', () => {
  const request = buildCodeRequest({ code: '  if x:\r\n\treturn 1\r\n\r\n', codeLanguage: 'python', task: 'explain', question: '  ', errorOutput: '', language: 'te', helpMode: 'hint' });
  assert.equal(request.code, '  if x:\n\treturn 1');
  assert.equal('question' in request, false);
  assert.equal('errorOutput' in request, false);
  assert.equal(request.language, 'te');
});

test('parseCodeResponse accepts a valid analysis', () => {
  const result = parseCodeResponse(payload());
  assert.equal(result.findings[0].line, 3);
  assert.equal(result.hints.length, 1);
});

test('parseCodeResponse refuses any response that says the code was executed or verified', () => {
  assert.throws(() => parseCodeResponse(payload({ executed: true })), InvalidCodeResponseError);
  assert.throws(() => parseCodeResponse(payload({ verified: true })), InvalidCodeResponseError);
  const missing = payload();
  delete missing.executed;
  assert.throws(() => parseCodeResponse(missing), InvalidCodeResponseError);
});

test('parseCodeResponse rejects malformed payloads', () => {
  for (const bad of [null, 'x', [], payload({ task: 'run' }), payload({ summary: '  ' })]) {
    assert.throws(() => parseCodeResponse(bad), InvalidCodeResponseError);
  }
});

test('parseCodeResponse drops malformed optional parts instead of failing', () => {
  const result = parseCodeResponse(
    payload({
      findings: [{ title: 't', detail: 'd', severity: 'weird', line: 'x' }, { title: '' }, null],
      testCases: [{ name: 'ok', input: '1', expectedOutput: '2' }, { name: 'bad' }],
      complexity: { time: 'O(n)' },
      hints: 'not a list'
    })
  );
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].severity, 'info');
  assert.equal(result.findings[0].line, null);
  assert.equal(result.testCases.length, 1);
  assert.equal(result.complexity, null);
  assert.deepEqual(result.hints, []);
});

test('markup in the analysis stays plain text', () => {
  const result = parseCodeResponse(payload({ summary: '<img src=x onerror=alert(1)>', improvedCode: '<script>alert(1)</script>' }));
  assert.equal(result.summary, '<img src=x onerror=alert(1)>');
  assert.equal(result.improvedCode, '<script>alert(1)</script>');
});

test('codeLine returns the referenced line and null when out of range', () => {
  const code = 'a = 1\n   b = 2\nc = 3';
  assert.equal(codeLine(code, 2), 'b = 2');
  assert.equal(codeLine(code, 99), null);
  assert.equal(codeLine(code, 0), null);
  assert.equal(codeLine(code, null), null);
});
