import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { clip, codePrompt, diagramPrompt, notesPrompt, planPrompt, quizReviewPrompt } from './companionPrompts.js';
import { MAX_MESSAGE_CHARS } from './tutor.js';

describe('clip', () => {
  test('leaves short text alone and collapses whitespace', () => {
    assert.equal(clip('  a   b\n c ', 20), 'a b c');
  });

  test('cuts long text on a word boundary and marks the cut', () => {
    const result = clip('alpha beta gamma delta epsilon', 18);

    assert.ok(result.endsWith('…'));
    assert.ok(result.length <= 18);
    assert.equal(result, 'alpha beta gamma…');
  });

  test('copes with nothing', () => {
    assert.equal(clip(undefined, 10), '');
    assert.equal(clip(null, 10), '');
  });
});

describe('quizReviewPrompt', () => {
  test('uses the real score, subject, topic and the questions that were missed', () => {
    const text = quizReviewPrompt({ subject: 'Operating Systems', topic: 'Deadlock', correct: 6, total: 10, missedQuestions: ['What is a safe state?', 'Name the four Coffman conditions.'] });

    assert.match(text, /Operating Systems \(Deadlock\) quiz/);
    assert.match(text, /6 of 10/);
    assert.match(text, /1\) "What is a safe state\?"/);
    assert.match(text, /2\) "Name the four Coffman conditions\."/);
  });

  test('asks for the next step instead when nothing was missed', () => {
    const text = quizReviewPrompt({ subject: 'DBMS', correct: 5, total: 5, missedQuestions: [] });

    assert.doesNotMatch(text, /got these wrong/);
    assert.match(text, /5 of 5/);
    assert.match(text, /practise next/);
  });

  test('mentions at most three missed questions and clips very long ones', () => {
    const text = quizReviewPrompt({ subject: 'AI', correct: 0, total: 6, missedQuestions: ['q1', 'q2', 'q3', 'q4', 'x'.repeat(500)] });

    assert.match(text, /3\) "q3"/);
    assert.doesNotMatch(text, /4\)/);
    assert.ok(text.length <= MAX_MESSAGE_CHARS);
  });
});

describe('the other starters', () => {
  test('planPrompt states the real figures and handles an unknown or past exam date', () => {
    assert.match(planPrompt({ subjects: ['DBMS', 'Java'], daysLeft: 9, remainingTasks: 14, totalTasks: 20 }), /DBMS, Java\. I have 9 days until the exam\. 14 of my 20 tasks/);
    assert.match(planPrompt({ subjects: ['Java'], daysLeft: 1, remainingTasks: 1, totalTasks: 2 }), /1 day until/);
    assert.doesNotMatch(planPrompt({ subjects: ['Java'], daysLeft: -3, remainingTasks: 1, totalTasks: 2 }), /until the exam/);
    assert.doesNotMatch(planPrompt({ subjects: [], daysLeft: null, remainingTasks: 0, totalTasks: 0 }), /until the exam/);
  });

  test('notesPrompt includes the title and summary but never grows past the limit', () => {
    const text = notesPrompt({ title: 'Unit 3', summary: 'word '.repeat(2000) });

    assert.match(text, /on "Unit 3"/);
    assert.ok(text.length <= MAX_MESSAGE_CHARS);
    assert.match(notesPrompt({ summary: 'Short.' }), /^Here is the summary of my notes: Short\./);
  });

  test('codePrompt carries the language, summary and the first findings only', () => {
    const text = codePrompt({
      codeLanguage: 'Python',
      summary: 'The loop never ends.',
      findings: [
        { title: 'Off by one', detail: 'range stops early' },
        { title: 'No base case' },
        { title: 'Third' },
        { title: 'Fourth' }
      ]
    });

    assert.match(text, /\(Python\)/);
    assert.match(text, /The loop never ends\./);
    assert.match(text, /Off by one: range stops early/);
    assert.match(text, /No base case/);
    assert.match(text, /Third/);
    assert.doesNotMatch(text, /Fourth/);
    assert.match(text, /hint instead of the full solution/);
  });

  test('diagramPrompt names the diagram and uses its explanation when there is one', () => {
    assert.match(diagramPrompt({ title: 'TCP handshake', explanation: 'Three steps.' }), /"TCP handshake"\. Three steps\./);
    assert.equal(diagramPrompt({ title: 'Tree' }), 'Please explain this diagram in simple words: "Tree".');
  });

  test('every starter stays within what the tutor accepts', () => {
    const huge = 'x'.repeat(10000);
    const all = [
      quizReviewPrompt({ subject: huge, topic: huge, correct: 1, total: 2, missedQuestions: [huge, huge, huge] }),
      planPrompt({ subjects: [huge, huge], daysLeft: 3, remainingTasks: 1, totalTasks: 2 }),
      notesPrompt({ title: huge, summary: huge }),
      codePrompt({ codeLanguage: huge, summary: huge, findings: [{ title: huge, detail: huge }] }),
      diagramPrompt({ title: huge, explanation: huge })
    ];

    for (const text of all) {
      assert.ok(text.length <= MAX_MESSAGE_CHARS, `${text.length}`);
    }
  });
});
