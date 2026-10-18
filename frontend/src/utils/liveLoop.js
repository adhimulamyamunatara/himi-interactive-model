/**
 * The turn-taking rules of HIMI's full-screen "live" conversation, as a pure state machine.
 *
 * What "live" means here, honestly: it is a continuous *conversation loop*, not streaming audio.
 *
 *     HIMI greets  ->  listens  ->  student finishes a sentence  ->  HIMI thinks  ->  HIMI speaks  ->  listens again ...
 *
 * It uses the browser's own speech recognition and speech synthesis plus the existing tutor, so the student
 * does not press anything between turns. It is never full-duplex: HIMI does not listen while it is speaking
 * (its own voice would be heard as the student's), so the student interrupts by tapping HIMI.
 *
 * Safety rules encoded here and covered by tests:
 *  - nothing starts until `start` (a button press); the microphone is only ever asked for inside that session;
 *  - listening never restarts forever: after a few silent turns HIMI pauses and waits for a tap;
 *  - a refused or missing microphone drops to text mode instead of retrying;
 *  - a reply that arrives after the student paused, interrupted or left is never spoken.
 *
 * The machine only decides; the hook that owns the browser APIs carries out the returned `actions`.
 */
import { toSpeakableText } from './speechText.js';

export const LIVE_MAX_EMPTY_LISTENS = 3;
/** HIMI reads at most this much of a long answer aloud; the whole answer stays on screen. */
export const LIVE_SPEAK_CHARS = 420;

/** @typedef {'off' | 'greeting' | 'listening' | 'thinking' | 'speaking' | 'paused' | 'text'} LivePhase */

export const INITIAL_LIVE = Object.freeze({ phase: 'off', empty: 0, canListen: false, canSpeak: false, reason: null });

const STOP_LISTEN = { type: 'stop-listen' };
const STOP_SPEAK = { type: 'stop-speak' };

/** Where the loop goes when HIMI has nothing left to say: back to listening, or to text mode if it cannot listen. */
function settle(state) {
  if (state.canListen) {
    return { state: { ...state, phase: 'listening', empty: 0, reason: null }, actions: [{ type: 'listen' }] };
  }

  return { state: { ...state, phase: 'text', empty: 0, reason: state.reason ?? 'unsupported' }, actions: [] };
}

const none = (state) => ({ state, actions: [] });

/**
 * @param {typeof INITIAL_LIVE} state
 * @param {{type: string, [key: string]: any}} event
 * @returns {{state: typeof INITIAL_LIVE, actions: Array<{type: string, [key: string]: any}>}}
 */
export function liveStep(state, event) {
  const { phase } = state;

  switch (event.type) {
    case 'start': {
      if (phase !== 'off') {
        return none(state);
      }

      const next = { ...INITIAL_LIVE, canListen: Boolean(event.canListen), canSpeak: Boolean(event.canSpeak), reason: event.canListen ? null : (event.reason ?? 'unsupported') };

      if (next.canSpeak) {
        return { state: { ...next, phase: 'greeting' }, actions: [{ type: 'speak-greeting' }] };
      }

      return settle(next);
    }

    case 'greeted':
    case 'speech-ended':
      return phase === 'greeting' || phase === 'speaking' ? settle(state) : none(state);

    case 'submit': {
      // Typed or finished-speaking text. Allowed whenever the loop is on and nothing else is being asked.
      const text = String(event.text ?? '').trim();

      if (!text || phase === 'off' || phase === 'thinking') {
        return none(state);
      }

      return { state: { ...state, phase: 'thinking', empty: 0, reason: null }, actions: [STOP_LISTEN, STOP_SPEAK, { type: 'send', text }] };
    }

    case 'listen-ended': {
      if (phase !== 'listening') {
        return none(state);
      }

      const text = String(event.text ?? '').trim();

      if (text) {
        return { state: { ...state, phase: 'thinking', empty: 0 }, actions: [{ type: 'send', text }] };
      }

      const empty = state.empty + 1;

      if (empty >= LIVE_MAX_EMPTY_LISTENS) {
        return { state: { ...state, phase: 'paused', empty, reason: 'silence' }, actions: [] };
      }

      return { state: { ...state, empty }, actions: [{ type: 'listen' }] };
    }

    case 'mic-lost': {
      // Refused, missing or unreachable microphone: stay in the conversation by text, and stop trying to listen.
      const next = { ...state, canListen: false, reason: 'mic' };

      if (phase === 'listening' || phase === 'paused') {
        return { state: { ...next, phase: 'text' }, actions: [STOP_LISTEN] };
      }

      return none(next);
    }

    case 'replied': {
      if (phase !== 'thinking') {
        return none(state);
      }

      const speak = typeof event.speak === 'string' ? event.speak.trim() : '';

      if (speak && state.canSpeak) {
        return { state: { ...state, phase: 'speaking' }, actions: [{ type: 'speak', text: speak }] };
      }

      return settle(state);
    }

    case 'reply-failed':
      return phase === 'thinking' ? settle(state) : none(state);

    case 'interrupt': {
      if (phase === 'speaking' || phase === 'greeting') {
        const next = settle(state);
        return { state: next.state, actions: [STOP_SPEAK, ...next.actions] };
      }

      if (phase === 'thinking') {
        const next = settle(state);
        return { state: next.state, actions: [{ type: 'cancel-request' }, ...next.actions] };
      }

      if (phase === 'paused') {
        return settle(state);
      }

      return none(state);
    }

    case 'pause': {
      if (phase === 'off' || phase === 'paused') {
        return none(state);
      }

      return { state: { ...state, phase: 'paused', reason: event.reason ?? 'muted' }, actions: [STOP_LISTEN, STOP_SPEAK] };
    }

    case 'resume':
      return phase === 'paused' || phase === 'text' ? settle({ ...state, reason: state.canListen ? null : state.reason }) : none(state);

    case 'set-can-speak': {
      const canSpeak = Boolean(event.value);
      return canSpeak === state.canSpeak ? none(state) : { state: { ...state, canSpeak }, actions: canSpeak ? [] : [STOP_SPEAK] };
    }

    case 'stop':
      return { state: { ...INITIAL_LIVE }, actions: [STOP_LISTEN, STOP_SPEAK] };

    default:
      return none(state);
  }
}

/**
 * The part of an answer HIMI reads aloud in a live conversation: the first sentences, up to `max` characters.
 * Code is skipped (as everywhere else); the full answer is always on screen.
 *
 * @returns {string}
 */
export function speakableReply(markdown, max = LIVE_SPEAK_CHARS) {
  const text = toSpeakableText(markdown);

  if (text.length <= max) {
    return text;
  }

  const sentences = text.split(/(?<=[.!?।])\s+/).filter(Boolean);
  let spoken = '';

  for (const sentence of sentences) {
    if (spoken && spoken.length + sentence.length + 1 > max) {
      break;
    }

    spoken = spoken ? `${spoken} ${sentence}` : sentence;

    if (spoken.length >= max) {
      break;
    }
  }

  if (spoken.length > max) {
    const cut = spoken.lastIndexOf(' ', max);
    spoken = spoken.slice(0, cut > max / 2 ? cut : max).trim();
  }

  return spoken;
}
