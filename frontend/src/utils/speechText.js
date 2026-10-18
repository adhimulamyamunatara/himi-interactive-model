/**
 * Text helpers for voice features. Pure, so they can be tested without a browser.
 */

export const MAX_SPEECH_CHARS = 6000;
export const SPEECH_CHUNK_LENGTH = 200;

/**
 * Add a dictated phrase to the message being written. Spacing is tidied and the result never exceeds `maxLength`.
 *
 * @returns {{ value: string, truncated: boolean }}
 */
export function appendTranscript(draft, transcript, maxLength) {
  const spoken = String(transcript ?? '').replace(/\s+/g, ' ').trim();

  if (!spoken) {
    return { value: draft, truncated: false };
  }

  const base = String(draft ?? '');
  const separator = base.length === 0 || /\s$/.test(base) ? '' : ' ';
  const combined = `${base}${separator}${spoken}`;

  if (combined.length <= maxLength) {
    return { value: combined, truncated: false };
  }

  return { value: combined.slice(0, maxLength), truncated: true };
}

/**
 * Turn a Markdown chat reply into plain text that sounds natural when read aloud.
 * Code is skipped rather than spelled out; links keep their label; formatting characters are dropped.
 */
export function toSpeakableText(markdown) {
  const text = String(markdown ?? '')
    .replace(/```[\s\S]*?(```|$)/g, ' Code example skipped. ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/^\s*\|?[-:| ]{3,}\|?\s*$/gm, ' ')
    .replace(/\|/g, ', ')
    .replace(/(\*\*|__|\*|_|~~)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return text.slice(0, MAX_SPEECH_CHARS);
}

/**
 * Split text into short pieces. Browsers can cut off one long utterance, so replies are spoken piece by piece,
 * breaking at sentence ends where possible.
 */
export function chunkForSpeech(text, maxLength = SPEECH_CHUNK_LENGTH) {
  const sentences = String(text ?? '')
    .split(/(?<=[.!?।])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const chunks = [];
  let current = '';

  const pushLong = (sentence) => {
    let rest = sentence;

    while (rest.length > maxLength) {
      let cut = rest.lastIndexOf(' ', maxLength);

      if (cut < maxLength / 2) {
        cut = maxLength;
      }

      chunks.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }

    return rest;
  };

  for (const sentence of sentences) {
    if (current && current.length + 1 + sentence.length > maxLength) {
      chunks.push(current);
      current = '';
    }

    if (sentence.length > maxLength) {
      current = pushLong(sentence);
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.filter(Boolean);
}

/** Telugu script gets a Telugu voice; everything else uses English (India). */
export function detectSpeechLang(text) {
  return /[\u0C00-\u0C7F]/.test(String(text ?? '')) ? 'te-IN' : 'en-IN';
}
