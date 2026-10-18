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

  /** Run one request. The question's user entry is added by the caller (or already exists, for a retry). */
  async function run(text, buildRequest, subject) {
    const mine = epoch;
    publish({ status: 'thinking', error: null, lastQuestion: { text, subject }, teaching: false });

    const outcome = await tutor.send(buildRequest, text);

    if (!outcome.started) {
      // The tutor refused to start (it believed another request was running); never stay "thinking" for nothing.
      if (mine === epoch) {
        publish({ status: 'idle' });
      }

      return outcome;
    }

    // The conversation was reset, or the request was stopped, while we waited: the answer is not wanted.
    if (mine !== epoch || outcome.reason === 'stale') {
      return { started: true, reason: 'stale' };
    }

    if (outcome.reason === 'error') {
      const error = tutor.getSnapshot().error ?? { kind: 'server', message: null };
      publish({
        status: 'error',
        error,
        entries: append({ kind: 'error', errorKind: error.kind, message: error.message })
      });
      return { started: true, reason: 'error' };
    }

    const result = tutor.getSnapshot().result;

    if (!result) {
      publish({ status: 'error', error: { kind: 'invalid', message: null }, entries: append({ kind: 'error', errorKind: 'invalid', message: null }) });
      return { started: true, reason: 'error' };
    }

    if (result.outcome === 'answer') {
      publish({ status: 'idle', entries: append({ kind: 'answer', text: result.answer, result, subject }) });
      startTeaching();
    } else if (result.outcome === 'handoff') {
      publish({ status: 'idle', entries: append({ kind: 'handoff', result, handoff: result.handoff, subject }) });
    } else {
      publish({ status: 'idle', entries: append({ kind: 'clarify', result, subject }) });
    }

    return { started: true };
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
    async send(text, buildRequest, { subject = '' } = {}) {
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
        return { started: true, reason: 'local', to: command.to };
      }

      publish({ entries: append({ kind: 'user', text: trimmed }) });
      return run(trimmed, buildRequest, subject);
    },

    /** Ask the last question again after a failure or a stop. The failed line is replaced, not duplicated. */
    async retry(buildRequest) {
      const last = snapshot.lastQuestion;
      const failed = [...snapshot.entries].reverse().find((entry) => entry.kind === 'error' || entry.kind === 'stopped');

      if (!last || !failed || snapshot.status === 'thinking') {
        return { started: false, reason: last ? 'busy' : 'nothing-to-retry' };
      }

      publish({ entries: snapshot.entries.filter((entry) => entry.id !== failed.id) });
      return run(last.text, buildRequest, last.subject);
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
      publish({ epoch, entries: [], status: 'idle', error: null, celebrating: false, teaching: false, lastQuestion: null });
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
