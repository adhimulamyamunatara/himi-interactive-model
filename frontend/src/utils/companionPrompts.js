/**
 * Starter messages the tool pages hand to HIMI ("Ask HIMI about this"). Each one is built from what is really
 * on the page (the real score, the real summary, the real findings) and is only ever put in the message box:
 * the student reads it, edits it if they like, and presses Send. Nothing is sent on their behalf.
 *
 * Pure and framework-free, so it is unit tested.
 */
import { MAX_MESSAGE_CHARS } from './tutor.js';

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

/** Shorten to `max` characters on a word boundary where possible, marking the cut. */
export function clip(value, max) {
  const text = clean(value);

  if (text.length <= max) {
    return text;
  }

  const cut = text.slice(0, Math.max(0, max - 1));
  const space = cut.lastIndexOf(' ');

  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Final safety net: no starter can exceed what the tutor accepts. */
const fit = (text) => clip(text, MAX_MESSAGE_CHARS);

/**
 * @param {{subject: string, topic?: string, correct: number, total: number, missedQuestions?: string[]}} input
 */
export function quizReviewPrompt({ subject, topic, correct, total, missedQuestions = [] }) {
  const about = topic ? `${clean(subject)} (${clean(topic)})` : clean(subject);
  const missed = missedQuestions.map(clean).filter(Boolean).slice(0, 3);
  const opening = `I just finished a ${about} quiz and got ${correct} of ${total} right.`;

  if (missed.length === 0) {
    return fit(`${opening} Please suggest what I should practise next to go deeper.`);
  }

  const list = missed.map((question, index) => `${index + 1}) "${clip(question, 160)}"`).join(' ');

  return fit(`${opening} I got these wrong: ${list} Please explain what I should understand about them, step by step, and suggest what to practise next.`);
}

/**
 * @param {{subjects: string[], daysLeft: number | null, remainingTasks: number, totalTasks: number}} input
 */
export function planPrompt({ subjects, daysLeft, remainingTasks, totalTasks }) {
  const list = subjects.map(clean).filter(Boolean).join(', ') || 'my subjects';
  const time = Number.isFinite(daysLeft) && daysLeft >= 0 ? ` I have ${daysLeft} day${daysLeft === 1 ? '' : 's'} until the exam.` : '';

  return fit(
    `Help me follow my study plan for ${list}.${time} ${remainingTasks} of my ${totalTasks} tasks are still to do. Where should I focus first, and how can I study it effectively?`
  );
}

/** @param {{title?: string, summary: string}} input */
export function notesPrompt({ title, summary }) {
  const name = clean(title) ? ` on "${clip(title, 80)}"` : '';

  return fit(`Here is the summary of my notes${name}: ${clip(summary, 1200)} Please ask me three short revision questions about it, and wait for my answers.`);
}

/**
 * @param {{codeLanguage?: string, summary: string, findings?: Array<{title: string, detail?: string}>}} input
 */
export function codePrompt({ codeLanguage, summary, findings = [] }) {
  const language = clean(codeLanguage) ? ` (${clean(codeLanguage)})` : '';
  const points = findings
    .slice(0, 3)
    .map((finding) => `- ${clip(finding.title, 100)}${finding.detail ? `: ${clip(finding.detail, 200)}` : ''}`)
    .join(' ');

  return fit(
    `Please explain this review of my code${language} in simple words, and give me a hint instead of the full solution. Summary: ${clip(summary, 600)}${points ? ` Findings: ${points}` : ''}`
  );
}

/** @param {{title: string, explanation?: string}} input */
export function diagramPrompt({ title, explanation }) {
  return fit(`Please explain this diagram in simple words: "${clip(title, 120)}".${explanation ? ` ${clip(explanation, 800)}` : ''}`);
}
