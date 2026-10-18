import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSpeechInput, describeSpeechError, getSpeechInputSupport, readRecognitionEvent } from './speechInput.js';

/** Fake SpeechRecognition that records calls and lets tests fire browser events. */
function createFake() {
  const instances = [];

  class FakeRecognition {
    constructor() {
      this.started = false;
      this.stopCalls = 0;
      this.abortCalls = 0;
      instances.push(this);
    }

    start() {
      if (FakeRecognition.failStart) throw new Error('InvalidStateError');
      this.started = true;
    }

    stop() {
      this.stopCalls += 1;
    }

    abort() {
      this.abortCalls += 1;
    }
  }

  const speech = (...parts) => ({ resultIndex: 0, results: parts.map(([text, isFinal]) => Object.assign([{ transcript: text }], { isFinal })) });
  const controller = createSpeechInput({ getSupport: () => ({ supported: true, Recognition: FakeRecognition, reason: null }) });

  return { FakeRecognition, instances, controller, speech };
}

function recorder() {
  const log = [];
  return {
    log,
    options: {
      language: 'en-IN',
      onStart: () => log.push('start'),
      onInterim: (text) => log.push(`interim:${text}`),
      onFinal: (text) => log.push(`final:${text}`),
      onError: (code) => log.push(`error:${code}`),
      onEnd: (summary) => log.push(`end:${summary.heardSpeech}:${summary.errored}`)
    }
  };
}

describe('getSpeechInputSupport', () => {
  it('detects standard and webkit-prefixed implementations', () => {
    class R {}
    assert.equal(getSpeechInputSupport({ SpeechRecognition: R }).Recognition, R);
    assert.equal(getSpeechInputSupport({ webkitSpeechRecognition: R }).supported, true);
  });

  it('reports unsupported browsers and insecure pages with a reason', () => {
    assert.deepEqual(getSpeechInputSupport({}), { supported: false, Recognition: null, reason: 'unsupported' });
    assert.equal(getSpeechInputSupport({ webkitSpeechRecognition: class {}, isSecureContext: false }).reason, 'insecure');
    assert.equal(getSpeechInputSupport(undefined).supported, false);
  });
});

describe('describeSpeechError', () => {
  it('gives actionable messages and stays silent for our own aborts', () => {
    assert.equal(describeSpeechError('aborted'), null);
    assert.match(describeSpeechError('not-allowed').message, /blocked/);
    assert.equal(describeSpeechError('not-allowed').retryable, false);
    assert.match(describeSpeechError('audio-capture').message, /No microphone/);
    assert.match(describeSpeechError('no-speech').message, /did not hear/);
    assert.match(describeSpeechError('network').message, /online service/);
    assert.match(describeSpeechError('something-new').message, /stopped unexpectedly/);
  });
});

describe('readRecognitionEvent', () => {
  it('separates final and interim text and respects resultIndex', () => {
    const { speech } = createFake();
    const event = speech(['hello', true], ['wor', false]);
    assert.deepEqual(readRecognitionEvent(event), { finals: [{ index: 0, text: 'hello' }], interim: 'wor' });
    assert.deepEqual(readRecognitionEvent({ ...event, resultIndex: 1 }), { finals: [], interim: 'wor' });
    assert.deepEqual(readRecognitionEvent({}), { finals: [], interim: '' });
  });
});

describe('createSpeechInput', () => {
  it('starts only when asked, configures language and delivers interim then final text', () => {
    const { controller, instances, speech } = createFake();
    assert.equal(instances.length, 0, 'creating the controller must not touch the microphone');
    const { log, options } = recorder();
    assert.deepEqual(controller.start({ ...options, language: 'te-IN' }), { ok: true });
    const [recognition] = instances;
    assert.equal(recognition.started, true);
    assert.equal(recognition.lang, 'te-IN');
    assert.equal(recognition.continuous, false);
    recognition.onstart();
    recognition.onresult(speech(['what is', false]));
    recognition.onresult(speech(['what is a join', true]));
    recognition.onend();
    assert.deepEqual(log, ['start', 'interim:what is', 'final:what is a join', 'interim:', 'end:true:false']);
    assert.equal(controller.isActive(), false);
  });

  it('falls back to the default language for unknown codes', () => {
    const { controller, instances } = createFake();
    controller.start({ ...recorder().options, language: 'xx-YY' });
    assert.equal(instances[0].lang, 'en-IN');
  });

  it('refuses a second start while a session is active (no duplicate sessions)', () => {
    const { controller, instances } = createFake();
    assert.equal(controller.start(recorder().options).ok, true);
    assert.deepEqual(controller.start(recorder().options), { ok: false, reason: 'busy' });
    assert.equal(instances.length, 1);
  });

  it('delivers each final result once even if the browser repeats the event', () => {
    const { controller, instances, speech } = createFake();
    const { log, options } = recorder();
    controller.start(options);
    instances[0].onresult(speech(['same', true]));
    instances[0].onresult(speech(['same', true]));
    assert.equal(log.filter((entry) => entry.startsWith('final:')).length, 1);
  });

  it('abort() silences the old session: late results, errors and end events are dropped', () => {
    const { controller, instances, speech } = createFake();
    const { log, options } = recorder();
    controller.start(options);
    const [old] = instances;
    controller.abort();
    assert.equal(old.abortCalls, 1);
    assert.equal(controller.isActive(), false);
    // The browser can still fire events for the aborted session. They must go nowhere.
    old.onresult?.(speech(['stale words', true]));
    old.onerror?.({ error: 'aborted' });
    old.onend?.();
    assert.deepEqual(log, []);
  });

  it('a stale session cannot affect a newer one', () => {
    const { controller, instances, speech } = createFake();
    const first = recorder();
    const second = recorder();
    controller.start(first.options);
    const [old] = instances;
    const staleResult = old.onresult;
    controller.abort();
    controller.start(second.options);
    staleResult(speech(['from the old chat', true]));
    old.onend?.();
    assert.deepEqual(first.log, []);
    assert.deepEqual(second.log, []);
    assert.equal(controller.isActive(), true);
    instances[1].onresult(speech(['from the new chat', true]));
    assert.deepEqual(second.log, ['final:from the new chat', 'interim:']);
  });

  it('reports errors then an end that knows about the error', () => {
    const { controller, instances } = createFake();
    const { log, options } = recorder();
    controller.start(options);
    instances[0].onerror({ error: 'not-allowed' });
    instances[0].onend();
    assert.deepEqual(log, ['error:not-allowed', 'end:false:true']);
  });

  it('an utterance with no recognised text ends without speech (empty transcript)', () => {
    const { controller, instances } = createFake();
    const { log, options } = recorder();
    controller.start(options);
    instances[0].onend();
    assert.deepEqual(log, ['end:false:false']);
  });

  it('blank final results are not delivered', () => {
    const { controller, instances, speech } = createFake();
    const { log, options } = recorder();
    controller.start(options);
    instances[0].onresult(speech(['   ', true]));
    instances[0].onend();
    assert.deepEqual(log.filter((entry) => entry.startsWith('final:')), []);
    assert.equal(log.at(-1), 'end:false:false');
  });

  it('stop() asks the browser to finish, and the final result still arrives', () => {
    const { controller, instances, speech } = createFake();
    const { log, options } = recorder();
    controller.start(options);
    controller.stop();
    assert.equal(instances[0].stopCalls, 1);
    instances[0].onresult(speech(['last words', true]));
    instances[0].onend();
    assert.ok(log.includes('final:last words'));
  });

  it('reports unsupported, insecure and failing browsers without throwing', () => {
    const unsupported = createSpeechInput({ getSupport: () => ({ supported: false, Recognition: null, reason: 'unsupported' }) });
    assert.deepEqual(unsupported.start(recorder().options), { ok: false, reason: 'unsupported' });
    const insecure = createSpeechInput({ getSupport: () => ({ supported: false, Recognition: null, reason: 'insecure' }) });
    assert.deepEqual(insecure.start(recorder().options), { ok: false, reason: 'insecure' });

    const { controller, FakeRecognition } = createFake();
    FakeRecognition.failStart = true;
    assert.deepEqual(controller.start(recorder().options), { ok: false, reason: 'failed' });
    assert.equal(controller.isActive(), false);
    FakeRecognition.failStart = false;
    assert.equal(controller.start(recorder().options).ok, true, 'a failed start does not block the next one');
  });

  it('stop/abort with nothing active are safe', () => {
    const { controller } = createFake();
    controller.stop();
    controller.abort();
    assert.equal(controller.isActive(), false);
  });
});
