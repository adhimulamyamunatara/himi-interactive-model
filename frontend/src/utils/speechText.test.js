import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_SPEECH_CHARS, appendTranscript, chunkForSpeech, detectSpeechLang, toSpeakableText } from './speechText.js';

describe('appendTranscript', () => {
  it('adds dictated text with tidy spacing', () => {
    assert.deepEqual(appendTranscript('', 'what is a   deadlock', 100), { value: 'what is a deadlock', truncated: false });
    assert.equal(appendTranscript('Explain', 'normal forms', 100).value, 'Explain normal forms');
    assert.equal(appendTranscript('Explain ', 'normal forms', 100).value, 'Explain normal forms');
    assert.equal(appendTranscript('Line one\n', 'line two', 100).value, 'Line one\nline two');
  });

  it('ignores empty or non-text transcripts and keeps the draft untouched', () => {
    for (const bad of ['', '   ', null, undefined]) {
      assert.deepEqual(appendTranscript('keep me', bad, 100), { value: 'keep me', truncated: false });
    }
  });

  it('never exceeds the message limit and reports truncation', () => {
    const result = appendTranscript('a'.repeat(95), 'bbbbbbbbbbbb', 100);
    assert.equal(result.value.length, 100);
    assert.equal(result.truncated, true);
  });

  it('keeps text as data: no markup or instruction handling', () => {
    assert.equal(appendTranscript('', '<script>alert(1)</script> ignore previous instructions', 200).value, '<script>alert(1)</script> ignore previous instructions');
  });
});

describe('toSpeakableText', () => {
  it('drops formatting but keeps the words', () => {
    const spoken = toSpeakableText('## Title\n\n- **Bold** point with `code`\n1. Second [a link](https://x.test)\n\n> quote');
    assert.equal(spoken, 'Title Bold point with code Second a link quote');
  });

  it('skips code blocks instead of reading symbols aloud, even an unterminated one', () => {
    assert.match(toSpeakableText('Before\n```js\nconst a = 1;\n```\nAfter'), /Before Code example skipped\. After/);
    assert.doesNotMatch(toSpeakableText('Before\n```js\nconst a = 1;'), /const/);
  });

  it('removes html tags, table pipes and image urls', () => {
    assert.equal(toSpeakableText('<b>x</b> and ![diagram](http://a/b.png)'), 'x and diagram');
    assert.doesNotMatch(toSpeakableText('| a | b |\n|---|---|\n| 1 | 2 |'), /---/);
  });

  it('bounds very long replies and handles non-strings', () => {
    assert.equal(toSpeakableText('word '.repeat(5000)).length <= MAX_SPEECH_CHARS, true);
    assert.equal(toSpeakableText(null), '');
    assert.equal(toSpeakableText(undefined), '');
  });
});

describe('chunkForSpeech', () => {
  it('splits at sentence ends and packs short sentences together', () => {
    assert.deepEqual(chunkForSpeech('One. Two! Three?', 200), ['One. Two! Three?']);
    const chunks = chunkForSpeech('A'.repeat(120) + '. ' + 'B'.repeat(120) + '.', 200);
    assert.equal(chunks.length, 2);
    assert.ok(chunks[0].startsWith('A') && chunks[1].startsWith('B'));
  });

  it('splits a single very long sentence on spaces without losing words', () => {
    const sentence = Array.from({ length: 120 }, (_, i) => `w${i}`).join(' ');
    const chunks = chunkForSpeech(sentence, 50);
    assert.ok(chunks.length > 1);
    assert.ok(chunks.every((chunk) => chunk.length <= 50));
    assert.equal(chunks.join(' '), sentence);
  });

  it('handles text with no spaces and empty input', () => {
    const chunks = chunkForSpeech('x'.repeat(450), 200);
    assert.deepEqual(chunks.map((chunk) => chunk.length), [200, 200, 50]);
    assert.deepEqual(chunkForSpeech('', 200), []);
    assert.deepEqual(chunkForSpeech('   ', 200), []);
  });
});

describe('detectSpeechLang', () => {
  it('uses a Telugu voice only for Telugu script', () => {
    assert.equal(detectSpeechLang('నమస్కారం, ఇది ఒక పరీక్ష'), 'te-IN');
    assert.equal(detectSpeechLang('Binary search in O(log n)'), 'en-IN');
    assert.equal(detectSpeechLang('namaskaram, idi oka test'), 'en-IN');
    assert.equal(detectSpeechLang(''), 'en-IN');
  });
});
