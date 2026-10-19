import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSpeechOutput, isSpeechOutputSupported } from './speechOutput.js';

/** Fake speechSynthesis that records utterances; tests decide when each one "finishes". */
function createFakeEngine() {
  const spoken = [];
  const synth = {
    cancelCalls: 0,
    speak: (utterance) => {
      if (synth.throwOnSpeak) throw new Error('boom');
      spoken.push(utterance);
    },
    cancel: () => {
      synth.cancelCalls += 1;
    }
  };
  class Utterance {
    constructor(text) {
      this.text = text;
    }
  }
  return { synth, Utterance, spoken, output: createSpeechOutput({ synth, Utterance, settleMs: 0, watchdogMs: 0 }) };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('real-browser quirks', () => {
  function engine(options) {
    const spoken = [];
    const synth = {
      cancelCalls: 0,
      resumeCalls: 0,
      speaking: false,
      speak: (utterance) => spoken.push(utterance),
      cancel: () => {
        synth.cancelCalls += 1;
      },
      resume: () => {
        synth.resumeCalls += 1;
      }
    };
    class Utterance {
      constructor(text) {
        this.text = text;
      }
    }
    return { synth, spoken, output: createSpeechOutput({ synth, Utterance, ...options }) };
  }

  it('does not cancel an idle engine, and resumes a paused one before speaking', () => {
    const { synth, spoken, output } = engine({ settleMs: 0, watchdogMs: 0 });
    output.speak('m1', 'Hello there.');
    assert.equal(synth.cancelCalls, 0);
    assert.equal(synth.resumeCalls, 1);
    assert.equal(spoken.length, 1);
  });

  it('starts a reply that follows a cancel only after a short settle delay (Chrome drops it otherwise)', async () => {
    const { spoken, output } = engine({ settleMs: 40, watchdogMs: 0 });
    output.stop();
    output.speak('m1', 'Hello there.');
    assert.equal(spoken.length, 0, 'not started in the same moment as the cancel');
    assert.equal(output.getSnapshot().speakingId, 'm1');
    await sleep(80);
    assert.equal(spoken.length, 1);
  });

  it('a stop() during the settle delay means the reply never plays', async () => {
    const { spoken, output } = engine({ settleMs: 40, watchdogMs: 0 });
    output.stop();
    output.speak('m1', 'Hello there.');
    output.stop();
    await sleep(100);
    assert.equal(spoken.length, 0);
    assert.equal(output.getSnapshot().speakingId, null);
  });

  it('turns a silent engine into an error instead of an endless speaking state', async () => {
    const { output } = engine({ settleMs: 0, watchdogMs: 30 });
    output.speak('m1', 'Hello there.');
    await sleep(80);
    assert.equal(output.getSnapshot().speakingId, null);
    assert.equal(output.getSnapshot().errorId, 'm1');
  });

  it('does not raise the error when the engine started', async () => {
    const { spoken, output } = engine({ settleMs: 0, watchdogMs: 30 });
    output.speak('m1', 'Hello there.');
    spoken[0].onstart();
    await sleep(80);
    assert.equal(output.getSnapshot().speakingId, 'm1');
    assert.equal(output.getSnapshot().error, '');
  });
});

describe('isSpeechOutputSupported', () => {
  it('needs both speechSynthesis and the utterance class', () => {
    assert.equal(isSpeechOutputSupported({ speechSynthesis: {}, SpeechSynthesisUtterance: class {} }), true);
    assert.equal(isSpeechOutputSupported({ speechSynthesis: {} }), false);
    assert.equal(isSpeechOutputSupported({}), false);
    assert.equal(isSpeechOutputSupported(undefined), false);
  });
});

describe('createSpeechOutput', () => {
  it('does nothing until speak() is called', () => {
    const { spoken, output } = createFakeEngine();
    assert.equal(spoken.length, 0);
    assert.equal(output.getSnapshot().speakingId, null);
  });

  it('reads a reply sentence by sentence and then goes idle, remembering what played', () => {
    const { spoken, output } = createFakeEngine();
    assert.equal(output.speak('m1', 'First sentence is here. ' + 'x'.repeat(190) + '. Third.'), true);
    assert.equal(output.getSnapshot().speakingId, 'm1');
    assert.equal(spoken.length, 1);
    spoken[0].onend();
    assert.equal(spoken.length, 2);
    spoken[1].onend();
    assert.equal(output.getSnapshot().speakingId, null);
    assert.equal(output.getSnapshot().lastId, 'm1');
  });

  it('strips markdown and picks the language voice', () => {
    const { spoken, output } = createFakeEngine();
    output.speak('m1', '**Hello** `world`');
    assert.equal(spoken[0].text, 'Hello world');
    assert.equal(spoken[0].lang, 'en-IN');
    output.speak('m2', 'నమస్కారం');
    assert.equal(spoken[1].lang, 'te-IN');
  });

  it('stop() cancels playback and late callbacks from the cancelled reply do nothing', () => {
    const { synth, spoken, output } = createFakeEngine();
    output.speak('m1', 'One. Two. ' + 'y'.repeat(210) + '.');
    const [first] = spoken;
    output.stop();
    assert.equal(synth.cancelCalls >= 1, true);
    assert.equal(output.getSnapshot().speakingId, null);
    first.onend();
    first.onerror({ error: 'synthesis-failed' });
    assert.equal(spoken.length, 1, 'no further chunk may start after Stop');
    assert.equal(output.getSnapshot().speakingId, null);
    assert.equal(output.getSnapshot().error, '');
  });

  it('starting another reply replaces the current one; the old one cannot re-mark itself', () => {
    const { spoken, output } = createFakeEngine();
    output.speak('m1', 'Alpha one. Beta two.');
    const stale = spoken[0];
    output.speak('m2', 'Gamma three.');
    assert.equal(output.getSnapshot().speakingId, 'm2');
    stale.onend();
    assert.equal(spoken.length, 2, 'old reply must not queue more audio');
    assert.equal(output.getSnapshot().speakingId, 'm2');
  });

  it('replay works after finishing or stopping', () => {
    const { spoken, output } = createFakeEngine();
    output.speak('m1', 'Short reply.');
    spoken[0].onend();
    assert.equal(output.getSnapshot().speakingId, null);
    output.speak('m1', 'Short reply.');
    assert.equal(output.getSnapshot().speakingId, 'm1');
    output.stop();
    output.speak('m1', 'Short reply.');
    assert.equal(spoken.length, 3);
    assert.equal(output.getSnapshot().speakingId, 'm1');
  });

  it('ignores the interrupted/canceled errors caused by our own cancel, but reports real failures', () => {
    const { spoken, output } = createFakeEngine();
    output.speak('m1', 'Hello there. Another sentence follows.');
    spoken[0].onerror({ error: 'interrupted' });
    assert.equal(output.getSnapshot().error, '');
    assert.equal(output.getSnapshot().speakingId, 'm1');
    spoken[0].onerror({ error: 'synthesis-failed' });
    assert.equal(output.getSnapshot().speakingId, null);
    assert.equal(output.getSnapshot().errorId, 'm1');
    assert.match(output.getSnapshot().error, /could not play/);
  });

  it('survives an engine that throws, and a reply with nothing to read', () => {
    const { synth, output } = createFakeEngine();
    synth.throwOnSpeak = true;
    assert.equal(output.speak('m1', 'Hello there.'), true);
    assert.equal(output.getSnapshot().speakingId, null);
    assert.equal(output.getSnapshot().errorId, 'm1');
    synth.throwOnSpeak = false;
    assert.equal(output.speak('m2', '```\ncode only\n```'), true, 'code blocks become a short spoken note');
    assert.equal(output.speak('m3', '   '), false);
    assert.match(output.getSnapshot().error, /nothing in this reply/);
  });

  it('is a safe no-op in browsers without speech synthesis', () => {
    const output = createSpeechOutput({ synth: null, Utterance: null });
    assert.equal(output.isSupported(), false);
    assert.equal(output.speak('m1', 'Hello'), false);
    output.stop();
  });

  it('notifies subscribers and supports unsubscribing', () => {
    const { output } = createFakeEngine();
    let calls = 0;
    const unsubscribe = output.subscribe(() => {
      calls += 1;
    });
    output.speak('m1', 'Hello there.');
    assert.ok(calls > 0);
    const seen = calls;
    unsubscribe();
    output.stop();
    assert.equal(calls, seen);
  });
});

describe('voice selection', () => {
  it('uses an installed Telugu voice for Telugu text and sets the language', () => {
    const { synth, spoken, output } = createFakeEngine();
    const telugu = { name: 'Geeta', lang: 'te-IN' };
    synth.getVoices = () => [{ name: 'Rishi', lang: 'en-IN' }, telugu];
    output.speak('m1', 'ఇది ఒక ప్రాసెస్.');
    assert.equal(spoken[0].lang, 'te-IN');
    assert.equal(spoken[0].voice, telugu);
  });

  it('leaves the device default in place when no matching voice is installed', () => {
    const { synth, spoken, output } = createFakeEngine();
    synth.getVoices = () => [{ name: 'Alex', lang: 'en-US' }];
    output.speak('m1', 'ఇది ఒక ప్రాసెస్.');
    assert.equal(spoken[0].lang, 'te-IN');
    assert.equal(spoken[0].voice, undefined);
  });

  it('still speaks when getVoices is missing or throws', () => {
    const missing = createFakeEngine();
    assert.equal(missing.output.speak('m1', 'Hello there.'), true);
    const throwing = createFakeEngine();
    throwing.synth.getVoices = () => {
      throw new Error('no voices');
    };
    assert.equal(throwing.output.speak('m1', 'Hello there.'), true);
    assert.equal(throwing.spoken.length, 1);
  });
});
