import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { basicReply, liveLine } from './basicHimi.js';

const intent = (message, options) => basicReply(message, options).intent;

describe('basic mode replies', () => {
  it('recognises everyday phrases', () => {
    assert.equal(intent('Hi!'), 'hello');
    assert.equal(intent('hello himi'), 'hello');
    assert.equal(intent('thank you so much'), 'thanks');
    assert.equal(intent("Okay, bye!"), 'bye');
    assert.equal(intent('How are you?'), 'how');
    assert.equal(intent("what's your name"), 'who');
    assert.equal(intent('what can you do'), 'can');
    assert.equal(intent('help'), 'can');
    assert.equal(intent("I'm tired"), 'stuck');
    assert.equal(intent('give me a study tip'), 'tip');
  });

  it('greets by first name and falls back to a friendly word', () => {
    assert.match(basicReply('hi', { name: 'Bhargav Kumar' }).text, /Hi Bhargav!/);
    assert.match(basicReply('hi').text, /Hi friend!/);
  });

  it('never explains subject questions: it says it is in basic mode instead of guessing', () => {
    for (const question of ['what is a deadlock', 'help me understand binary search', 'explain TCP three way handshake', 'thanks, now explain normalization']) {
      const reply = basicReply(question);
      assert.equal(reply.intent, 'unknown', question);
      assert.match(reply.text, /basic mode/i);
      assert.match(reply.text, /won't guess/);
    }
  });

  it('offers things that still work without the AI', () => {
    assert.match(basicReply('what is a deadlock').text, /open the quiz/);
  });

  it('does not pretend to have feelings or to read the student\'s mood', () => {
    assert.match(basicReply('how are you').text, /don't have feelings/);
    assert.match(basicReply('I am stressed').text, /not able to tell how you feel/);
  });

  it('answers in Telugu when asked to, or when the student wrote Telugu', () => {
    const byPreference = basicReply('hi', { language: 'te', name: 'Ravi' });
    assert.equal(byPreference.language, 'te');
    assert.match(byPreference.text, /హాయ్ Ravi/);

    const byScript = basicReply('నువ్వు ఏం చేయగలవు', { language: 'en' });
    assert.equal(byScript.language, 'te');
    assert.match(byScript.text, /basic|బేసిక్/i);
  });

  it('understands romanised Telugu phrases', () => {
    assert.equal(intent('ela unnav'), 'how');
    assert.equal(intent('namaskaram'), 'hello');
    assert.equal(intent('dhanyavadalu'), 'thanks');
  });

  it('picks a study tip from the list and survives odd input', () => {
    assert.equal(basicReply('study tips', { random: () => 0 }).text.startsWith('Try the 25-5'), true);
    assert.equal(basicReply('study tips', { random: () => 0.999 }).text.startsWith('Start with'), true);
    assert.equal(basicReply('').intent, 'unknown');
    assert.equal(basicReply(null).intent, 'unknown');
    assert.equal(basicReply(undefined, { language: 'te' }).language, 'te');
  });
});

describe('live lines', () => {
  it('greets by first name in the chosen language', () => {
    assert.match(liveLine('greeting', 'en', { name: 'Bhargav Kumar' }), /^Hi Bhargav!/);
    assert.match(liveLine('greeting', 'te', { name: 'Ravi' }), /హాయ్ Ravi!/);
    assert.match(liveLine('greeting', 'en'), /^Hi friend!/);
  });

  it('has a spoken line for every handoff the tutor can make, and tells the student to tap (it never jumps pages)', () => {
    for (const kind of ['quiz', 'planner', 'code', 'diagram']) {
      for (const language of ['en', 'te']) {
        assert.ok(liveLine(`handoff.${kind}`, language).length > 10, `${kind}/${language}`);
      }
    }

    assert.match(liveLine('handoff.quiz', 'en'), /Tap the button/);
  });

  it('falls back to the error line for an unknown key', () => {
    assert.equal(liveLine('nope', 'en'), liveLine('error', 'en'));
  });
});
