/**
 * The conversation HIMI the companion has with one student, independent of any page.
 *
 * It does not invent an AI backend. Questions go through the existing multi-agent tutor
 * (`createTutorSession`, which owns the request, its cancellation and the context sent back to the model), and
 * this controller adds what a companion needs on top:
 *
 *  - a transcript that survives navigation (it lives above the router, in memory only),
 *  - an explicit "thinking" status that is only true while a request is really in flight,
 *  - one request at a time: a double click, a repeated speech event or Enter held down cannot send twice,
 *  - stale-response protection: after `reset()` (sign out, new student, "start over") or `cancel()`, a late
 *    answer is discarded and can never appear in a conversation it does not belong to,
 *  - explicit "open the whiteboard" commands answered locally without a model call,
 *  - short visual states (celebrating, teaching) that end by themselves.
 *
 * Framework-free so every rule is unit tested. Nothing here touches the network or the browser.
 */
import { routeCommand } from './companionIntents.js';
import { CELEBRATE_MS, TEACHING_MS } from './companionState.js';
import { MAX_MESSAGE_CHARS } from './tutor.js';
import { createTutorSession } from './tutorSession.js';

/** A conversation can grow without bound otherwise; the oldest entries drop off (the model only sees 6 turns anyway). */
export const MAX_ENTRIES = 80;

/**
 * Entry kinds:
 *   user       { text }
 *   answer     { text, result, subject }       a real tutor answer
 *   clarify    { result }                      the tutor needs more detail
 *   handoff    { result, handoff, subject }    the tutor chose a tool (quiz, planner, code, diagram)
 *   open       { target, to }                  an explicit "open X" command, handled locally
 *   error      { errorKind, message }          the request failed; retry is available
 *   stopped    {}                              the student stopped the request; retry is available
 *   notice     { code }                        a short system line
 *
 * An answer entry carries `basic: true` when it came from the local basic mode (`fallback`) instead of the AI.
 */

export function createCompanionSession({
  ask,
  describeError,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id)
}) {
  const tutor = createTutorSession({ ask, describeError });
  const listeners = new Set();
  let counter = 0;
  let epoch = 0;
  let snapshot = {
    epoch,
    entries: [],
    status: 'idle',
    error: null,
    celebrating: false,
    teaching: false,
    basic: false,
    lastQuestion: null
  };
  let celebrateTimer = null;
  let teachingTimer = null;

  const publish = (next) => {
    snapshot = { ...snapshot, ...next };
    listeners.forEach((listener) => listener());
  };

  const nextId = () => `c${epoch}-${++counter}`;
  const trim = (entries) => (entries.length > MAX_ENTRIES ? entries.slice(-MAX_ENTRIES) : entries);
  const append = (entry) => trim([...snapshot.entries, { id: nextId(), ...entry }]);

  const clearTimers = () => {
    clearTimer(celebrateTimer);
    clearTimer(teachingTimer);
    celebrateTimer = null;
    teachingTimer = null;
  };

  const startTeaching = () => {
    clearTimer(teachingTimer);
    publish({ teaching: true });
    const mine = epoch;
    teachingTimer = setTimer(() => {
      if (mine === epoch) {
        publish({ teaching: false });
      }
    }, TEACHING_MS);
  };

  /**
   * Run one request. The question's user entry is added by the caller (or already exists, for a retry).
   *
   * `fallback(text, errorKind)` (live conversations only) may turn a failure into a basic-mode reply `{text, language}`
   * so the conversation does not stop when the AI cannot answer. `timeoutMs` abandons a request that takes too
   * long and treats it as a failure (kind 'timeout').
   */
  async function run(text, buildRequest, subject, { fallback = null, timeoutMs = 0 } = {}) {
    const mine = epoch;
    publish({ status: 'thinking', error: null, lastQuestion: { text, subject }, teaching: false });

    let timedOut = false;
    const timer = timeoutMs > 0
      ? setTimer(() => {
          timedOut = true;
          tutor.cancel();
        }, timeoutMs)
      : null;

    const outcome = await tutor.send(buildRequest, text);
    clearTimer(timer);

    if (!outcome.started) {
      // The tutor refused to start (it believed another request was running); never stay "thinking" for nothing.
      if (mine === epoch) {
        publish({ status: 'idle' });
      }

      return outcome;
    }

    // The conversation was reset, or the request was stopped, while we waited: the answer is not wanted.
    if (mine !== epoch || (outcome.reason === 'stale' && !timedOut)) {
      return { started: true, reason: 'stale' };
    }

    if (outcome.reason === 'error' || timedOut || !tutor.getSnapshot().result) {
      const failed = timedOut
        ? { kind: 'timeout', message: 'HIMI took too long to answer. Please try again.' }
        : outcome.reason === 'error'
          ? tutor.getSnapshot().error ?? { kind: 'server', message: null }
          : { kind: 'invalid', message: null };

      return fail(failed, text, subject, fallback);
    }

    const result = tutor.getSnapshot().result;

    if (result.outcome === 'answer') {
      const entries = append({ kind: 'answer', text: result.answer, result, subject });
      publish({ status: 'idle', basic: false, entries });
      startTeaching();
      return { started: true, entry: entries[entries.length - 1] };
    }

    const kind = result.outcome === 'handoff' ? 'handoff' : 'clarify';
    const entries = append(kind === 'handoff' ? { kind, result, handoff: result.handoff, subject } : { kind, result, subject });
    publish({ status: 'idle', basic: false, entries });
    return { started: true, entry: entries[entries.length - 1] };
  }

  /** The request failed: a basic-mode reply if the caller allows one, otherwise a retryable error line. */
  function fail(error, text, subject, fallback) {
    const basic = typeof fallback === 'function' ? fallback(text, error.kind) : null;

    if (basic?.text) {
      const language = basic.language === 'te' ? 'te' : 'en';
      const result = { outcome: 'answer', answer: basic.text, language, plan: null, clarifyingQuestion: null, followUps: [], suggestedActions: [], basic: true };
      const entries = append({ kind: 'answer', text: basic.text, result, subject, basic: true });
      publish({ status: 'idle', error: null, basic: true, entries });
      startTeaching();
      return { started: true, entry: entries[entries.length - 1], reason: 'basic' };
    }

    const entries = append({ kind: 'error', errorKind: error.kind, message: error.message });
    publish({ status: 'error', error, entries });
    return { started: true, reason: 'error', entry: entries[entries.length - 1] };
  }

  return {
    getSnapshot: () => snapshot,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /**
     * Send what the student said or typed.
     * @param {string} text
     * @param {(history: Array<{role: string, content: string}>) => object} buildRequest builds the tutor request from the context so far
     * @param {{subject?: string}} [options] the subject the question was asked under (kept with the answer)
     * @returns {Promise<{started: boolean, reason?: string, to?: string}>}
     */
    async send(text, buildRequest, { subject = '', fallback = null, timeoutMs = 0 } = {}) {
      const trimmed = typeof text === 'string' ? text.trim() : '';

      if (!trimmed) {
        return { started: false, reason: 'empty' };
      }

      if (trimmed.length > MAX_MESSAGE_CHARS) {
        return { started: false, reason: 'too-long' };
      }

      // Checked and set synchronously, before any await, so two rapid calls can never both pass.
      if (snapshot.status === 'thinking') {
        return { started: false, reason: 'busy' };
      }

      const command = routeCommand(trimmed);

      if (command) {
        const user = { id: nextId(), kind: 'user', text: trimmed };
        const open = { id: nextId(), kind: 'open', target: command.target, to: command.to };
        publish({ entries: trim([...snapshot.entries, user, open]), error: null });
        return { started: true, reason: 'local', to: command.to, entry: open };
      }

      publish({ entries: append({ kind: 'user', text: trimmed }) });
      return run(trimmed, buildRequest, subject, { fallback, timeoutMs });
    },

    /** Ask the last question again after a failure or a stop. The failed line is replaced, not duplicated. */
    async retry(buildRequest, { fallback = null, timeoutMs = 0 } = {}) {
      const last = snapshot.lastQuestion;
      const failed = [...snapshot.entries].reverse().find((entry) => entry.kind === 'error' || entry.kind === 'stopped');

      if (!last || !failed || snapshot.status === 'thinking') {
        return { started: false, reason: last ? 'busy' : 'nothing-to-retry' };
      }

      publish({ entries: snapshot.entries.filter((entry) => entry.id !== failed.id) });
      return run(last.text, buildRequest, last.subject, { fallback, timeoutMs });
    },

    /** Stop the running request. Its answer, if it still arrives, is discarded. */
    cancel() {
      if (snapshot.status !== 'thinking') {
        return false;
      }

      tutor.cancel();
      publish({ status: 'idle', error: null, entries: append({ kind: 'stopped' }) });
      return true;
    },

    /** A short success animation (finished quiz, completed task). Ends by itself. */
    celebrate(ms = CELEBRATE_MS) {
      clearTimer(celebrateTimer);
      publish({ celebrating: true });
      const mine = epoch;
      celebrateTimer = setTimer(() => {
        if (mine === epoch) {
          publish({ celebrating: false });
        }
      }, ms);
    },

    /** Start over: forget the transcript and the context, and drop anything still in flight. */
    reset() {
      epoch += 1;
      counter = 0;
      clearTimers();
      tutor.reset();
      publish({ epoch, entries: [], status: 'idle', error: null, celebrating: false, teaching: false, basic: false, lastQuestion: null });
    },

    /**
     * Called when the provider unmounts. Reversible on purpose: React StrictMode runs this cleanup and then
     * mounts the same instance again, so it must not destroy the transcript.
     */
    dispose() {
      tutor.dispose();
      clearTimers();

      if (snapshot.status === 'thinking') {
        publish({ status: 'idle', celebrating: false, teaching: false });
      } else if (snapshot.celebrating || snapshot.teaching) {
        publish({ celebrating: false, teaching: false });
      }
    }
  };
}
