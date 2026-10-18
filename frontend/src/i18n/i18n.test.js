import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DICTIONARIES, t } from './index.js';
import { interpolate, missingKeys, translate } from './translate.js';
import en from './en.js';
import te from './te.js';
import { LANGUAGES } from '../utils/preferences.js';
import { MEMBER_PAGES, PUBLIC_PAGES } from '../utils/navigation.js';

test('translate returns the text in the chosen language', () => {
  assert.equal(translate({ en: { a: 'Hello' }, te: { a: 'నమస్తే' } }, 'te', 'a'), 'నమస్తే');
});

test('a key missing in the chosen language falls back to English', () => {
  assert.equal(translate({ en: { a: 'Hello' }, te: {} }, 'te', 'a'), 'Hello');
});

test('a key missing everywhere returns the key and never throws', () => {
  assert.equal(translate({ en: {}, te: {} }, 'te', 'nope.key'), 'nope.key');
  assert.equal(translate({ en: {} }, 'xx', 'nope.key'), 'nope.key');
});

test('an unsupported language falls back to English', () => {
  assert.equal(translate({ en: { a: 'Hello' } }, 'fr', 'a'), 'Hello');
});

test('interpolate fills placeholders and leaves unknown ones visible', () => {
  assert.equal(interpolate('Hi {name}, {count} left', { name: 'Asha', count: 0 }), 'Hi Asha, 0 left');
  assert.equal(interpolate('Hi {name}', {}), 'Hi {name}');
  assert.equal(interpolate('Hi {name}', { name: null }), 'Hi {name}');
  assert.equal(interpolate('Plain', undefined), 'Plain');
});

test('interpolate does not execute or evaluate parameter values', () => {
  assert.equal(interpolate('Topic: {topic}', { topic: '${process.exit()} {name}' }), 'Topic: ${process.exit()} {name}');
});

test('every supported language has a dictionary', () => {
  for (const language of LANGUAGES) {
    assert.ok(DICTIONARIES[language.code], `missing dictionary for ${language.code}`);
  }
});

test('the Telugu dictionary has every English key (no silent gaps)', () => {
  assert.deepEqual(missingKeys(en, te), []);
});

test('the Telugu dictionary has no keys that English lacks', () => {
  assert.deepEqual(missingKeys(te, en), []);
});

test('placeholders match between English and Telugu', () => {
  const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

  for (const key of Object.keys(en)) {
    assert.deepEqual(placeholders(te[key]), placeholders(en[key]), `placeholders differ for ${key}`);
  }
});

test('Telugu entries contain Telugu script (they are real translations, not copies)', () => {
  const untranslated = Object.keys(en).filter((key) => te[key] === en[key] && /[A-Za-z]{4,}/.test(en[key]) && !/^(nav\.(chat|quiz|home)|language\.label)$/.test(key));
  assert.ok(untranslated.length <= 3, `too many untranslated Telugu strings: ${untranslated.join(', ')}`);
});

test('every navigation entry has a translation key present in both languages', () => {
  for (const page of [...MEMBER_PAGES, ...PUBLIC_PAGES]) {
    for (const key of [page.labelKey, page.footerKey].filter(Boolean)) {
      assert.equal(typeof en[key], 'string', `en missing ${key}`);
      assert.equal(typeof te[key], 'string', `te missing ${key}`);
    }
  }
});

test('t() looks up through the shared dictionaries', () => {
  assert.equal(t('en', 'nav.dashboard'), 'Dashboard');
  assert.notEqual(t('te', 'nav.dashboard'), 'nav.dashboard');
  assert.equal(t('te', 'not.a.key'), 'not.a.key');
});
