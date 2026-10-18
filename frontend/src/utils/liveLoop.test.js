import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { INITIAL_LIVE, LIVE_MAX_EMPTY_LISTENS, LIVE_SPEAK_CHARS, liveStep, speakableReply } from './liveLoop.js';

/** Run events through the machine, collecting every action in order. */
function run(events, from = INITIAL_LIVE) {
  let state = from;
  const actions = [];

  for (const event of events) {
    const step = liveStep(state, event);
    state = step.state;
    actions.push(...step.actions.map((action) => action.type));
  }

  return { state, actions };
}

const VOICE = { type: 'start', canListen: true, canSpeak: true };

describe('live loop: starting', () => {
  it('does nothing until it is started', () => {
    assert.equal(INITIAL_LIVE.phase, 'off');
    assert.deepEqual(liveStep(INITIAL_LIVE, { type: 'speech-ended' }).actions, []);
    assert.deepEqual(liveStep(INITIAL_LIVE, { type: 'listen-ended', text: 'hello' }).actions, []);
    assert.deepEqual(liveStep(INITIAL_LIVE, { type: 'submit', text: 'hello' }).actions, []);
  });

  it('greets first when it can speak, and only then listens', () => {
    const started = run([VOICE]);
    assert.equal(started.state.phase, 'greeting');
    assert.deepEqual(started.actions, ['speak-greeting']);

    const greeted = run([{ type: 'greeted' }], started.state);
    assert.equal(greeted.state.phase, 'listening');
    assert.deepEqual(greeted.actions, ['listen']);
  });

  it('listens straight away when it cannot speak', () => {
    const { state, actions } = run([{ type: 'start', canListen: true, canSpeak: false }]);
    assert.equal(state.phase, 'listening');
    assert.deepEqual(actions, ['listen']);
  });

  it('falls to text mode, never listening, when the browser cannot listen', () => {
    const { state, actions } = run([{ type: 'start', canListen: false, canSpeak: true, reason: 'unsupported' }, { type: 'greeted' }]);
    assert.equal(state.phase, 'text');
    assert.equal(state.reason, 'unsupported');
    assert.deepEqual(actions, ['speak-greeting']);
  });

  it('ignores a second start', () => {
    const started = run([VOICE]).state;
    assert.deepEqual(liveStep(started, VOICE).actions, []);
  });
});

describe('live loop: a full turn', () => {
  it('listen -> think -> speak -> listen again, with no button between turns', () => {
    const { state, actions } = run([
      VOICE,
      { type: 'greeted' },
      { type: 'listen-ended', text: 'explain deadlock' },
      { type: 'replied', speak: 'Deadlock is when processes wait on each other.' },
      { type: 'speech-ended' }
    ]);

    assert.deepEqual(actions, ['speak-greeting', 'listen', 'send', 'speak', 'listen']);
    assert.equal(state.phase, 'listening');
  });

  it('does not listen while HIMI is speaking (it would hear itself)', () => {
    const { state } = run([VOICE, { type: 'greeted' }, { type: 'listen-ended', text: 'hi' }, { type: 'replied', speak: 'Hello there.' }]);
    assert.equal(state.phase, 'speaking');
    assert.deepEqual(liveStep(state, { type: 'listen-ended', text: 'echo of HIMI' }).actions, []);
  });

  it('with voice replies off it shows the answer and goes straight back to listening', () => {
    const { actions } = run([{ type: 'start', canListen: true, canSpeak: false }, { type: 'listen-ended', text: 'hi' }, { type: 'replied', speak: 'Hello.' }]);
    assert.deepEqual(actions, ['listen', 'send', 'listen']);
  });

  it('sends one request per heard sentence and ignores a second while thinking', () => {
    const thinking = run([VOICE, { type: 'greeted' }, { type: 'listen-ended', text: 'one' }]).state;
    assert.equal(thinking.phase, 'thinking');
    assert.deepEqual(liveStep(thinking, { type: 'listen-ended', text: 'two' }).actions, []);
    assert.deepEqual(liveStep(thinking, { type: 'submit', text: 'two' }).actions, []);
  });

  it('typed text stops listening and speaking and is sent', () => {
    const listening = run([VOICE, { type: 'greeted' }]).state;
    const step = liveStep(listening, { type: 'submit', text: '  what is TCP?  ' });
    assert.deepEqual(step.actions.map((a) => a.type), ['stop-listen', 'stop-speak', 'send']);
    assert.equal(step.actions[2].text, 'what is TCP?');
    assert.equal(step.state.phase, 'thinking');
    assert.deepEqual(liveStep(listening, { type: 'submit', text: '   ' }).actions, []);
  });

  it('a failed reply returns to listening instead of hanging', () => {
    const { state, actions } = run([VOICE, { type: 'greeted' }, { type: 'listen-ended', text: 'hi' }, { type: 'reply-failed' }]);
    assert.equal(state.phase, 'listening');
    assert.equal(actions.at(-1), 'listen');
  });
});

describe('live loop: silence', () => {
  it('re-listens after a quiet turn, then pauses instead of listening forever', () => {
    let state = run([VOICE, { type: 'greeted' }]).state;

    for (let i = 1; i < LIVE_MAX_EMPTY_LISTENS; i += 1) {
      const step = liveStep(state, { type: 'listen-ended', text: '' });
      assert.deepEqual(step.actions, [{ type: 'listen' }]);
      state = step.state;
    }

    const last = liveStep(state, { type: 'listen-ended', text: '   ' });
    assert.equal(last.state.phase, 'paused');
    assert.equal(last.state.reason, 'silence');
    assert.deepEqual(last.actions, []);
  });

  it('a heard sentence resets the silence count', () => {
    let state = run([VOICE, { type: 'greeted' }, { type: 'listen-ended', text: '' }, { type: 'listen-ended', text: '' }]).state;
    assert.equal(state.empty, 2);
    state = run([{ type: 'listen-ended', text: 'hi' }, { type: 'replied', speak: '' }], state).state;
    assert.equal(state.empty, 0);
    assert.equal(state.phase, 'listening');
  });

  it('a tap on a paused HIMI starts listening again', () => {
    const paused = run([VOICE, { type: 'greeted' }, { type: 'pause', reason: 'muted' }]).state;
    const step = liveStep(paused, { type: 'interrupt' });
    assert.equal(step.state.phase, 'listening');
    assert.deepEqual(step.actions, [{ type: 'listen' }]);
  });
});

describe('live loop: interrupt, pause, errors, stop', () => {
  it('interrupting speech stops it and listens', () => {
    const speaking = run([VOICE, { type: 'greeted' }, { type: 'listen-ended', text: 'hi' }, { type: 'replied', speak: 'Long reply.' }]).state;
    const step = liveStep(speaking, { type: 'interrupt' });
    assert.deepEqual(step.actions.map((a) => a.type), ['stop-speak', 'listen']);
    assert.equal(step.state.phase, 'listening');
    // the engine's "ended" event for the cancelled reply must not start a second listen
    assert.deepEqual(liveStep(step.state, { type: 'speech-ended' }).actions, []);
  });

  it('interrupting while thinking cancels the request and a late reply is not spoken', () => {
    const thinking = run([VOICE, { type: 'greeted' }, { type: 'listen-ended', text: 'hi' }]).state;
    const step = liveStep(thinking, { type: 'interrupt' });
    assert.deepEqual(step.actions.map((a) => a.type), ['cancel-request', 'listen']);
    assert.deepEqual(liveStep(step.state, { type: 'replied', speak: 'late answer' }).actions, []);
  });

  it('pausing stops the microphone and speech, and a reply that lands while paused stays silent', () => {
    const thinking = run([VOICE, { type: 'greeted' }, { type: 'listen-ended', text: 'hi' }]).state;
    const paused = liveStep(thinking, { type: 'pause', reason: 'hidden' });
    assert.deepEqual(paused.actions.map((a) => a.type), ['stop-listen', 'stop-speak']);
    assert.equal(paused.state.reason, 'hidden');
    assert.deepEqual(liveStep(paused.state, { type: 'replied', speak: 'hello' }).actions, []);
    assert.equal(liveStep(paused.state, { type: 'resume' }).state.phase, 'listening');
  });

  it('a refused microphone drops to text mode and never listens again', () => {
    const listening = run([VOICE, { type: 'greeted' }]).state;
    const lost = liveStep(listening, { type: 'mic-lost' });
    assert.equal(lost.state.phase, 'text');
    assert.equal(lost.state.reason, 'mic');
    assert.deepEqual(lost.actions, [{ type: 'stop-listen' }]);

    const turn = run([{ type: 'submit', text: 'hi' }, { type: 'replied', speak: 'Hello.' }, { type: 'speech-ended' }], lost.state);
    assert.equal(turn.state.phase, 'text');
    assert.ok(!turn.actions.includes('listen'));
  });

  it('turning voice replies off stops speech mid-sentence', () => {
    const speaking = run([VOICE, { type: 'greeted' }, { type: 'listen-ended', text: 'hi' }, { type: 'replied', speak: 'Reply.' }]).state;
    const step = liveStep(speaking, { type: 'set-can-speak', value: false });
    assert.deepEqual(step.actions, [{ type: 'stop-speak' }]);
    assert.equal(step.state.canSpeak, false);
  });

  it('stop resets everything and silences both channels', () => {
    const step = liveStep(run([VOICE, { type: 'greeted' }]).state, { type: 'stop' });
    assert.equal(step.state.phase, 'off');
    assert.deepEqual(step.actions.map((a) => a.type), ['stop-listen', 'stop-speak']);
    assert.deepEqual(liveStep(step.state, { type: 'listen-ended', text: 'late' }).actions, []);
  });
});

describe('speakableReply', () => {
  it('returns a short reply whole, without markdown', () => {
    assert.equal(speakableReply('**Deadlock** means `processes` wait forever.'), 'Deadlock means processes wait forever.');
  });

  it('reads only the first sentences of a long reply', () => {
    const long = Array.from({ length: 30 }, (_, i) => `This is sentence number ${i + 1} about operating systems.`).join(' ');
    const spoken = speakableReply(long);
    assert.ok(spoken.length <= LIVE_SPEAK_CHARS);
    assert.ok(spoken.startsWith('This is sentence number 1'));
    assert.ok(spoken.endsWith('.'));
  });

  it('cuts one enormous sentence at a word boundary', () => {
    const spoken = speakableReply(`${'word '.repeat(300)}end.`);
    assert.ok(spoken.length <= LIVE_SPEAK_CHARS);
    assert.ok(!spoken.endsWith(' '));
  });

  it('skips code and copes with empty input', () => {
    assert.match(speakableReply('Try this:\n```js\nconsole.log(1)\n```'), /Code example skipped/);
    assert.equal(speakableReply(''), '');
    assert.equal(speakableReply(null), '');
  });
});
