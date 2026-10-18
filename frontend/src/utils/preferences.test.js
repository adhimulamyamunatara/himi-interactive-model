import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyPreferenceChange,
  DEFAULT_PREFERENCES,
  loadPreferences,
  normalizePreferences,
  PREFERENCES_BACKUP_KEY,
  PREFERENCES_STORAGE_KEY,
  PREFERENCES_VERSION,
  savePreferences
} from './preferences.js';
import { createPreferencesStore } from './preferencesStore.js';

const memoryStorage = (initial = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => void data.set(key, String(value)),
    removeItem: (key) => void data.delete(key),
    data
  };
};

test('defaults keep voice opt-in: nothing is auto-read', () => {
  assert.equal(DEFAULT_PREFERENCES.autoReadReplies, false);
  assert.equal(DEFAULT_PREFERENCES.uiLanguage, 'en');
  assert.equal(DEFAULT_PREFERENCES.explanationLanguage, 'en');
});

test('normalizePreferences replaces invalid values and ignores unknown fields', () => {
  const result = normalizePreferences({ uiLanguage: 'zz', explanationLanguage: 'te', helpMode: 'cheat', voiceEnabled: 'yes', extra: 1 });
  assert.deepEqual(result, { ...DEFAULT_PREFERENCES, explanationLanguage: 'te' });
});

test('normalizePreferences copes with non-objects', () => {
  for (const value of [null, undefined, 'x', 4, [], true]) {
    assert.deepEqual(normalizePreferences(value), { ...DEFAULT_PREFERENCES });
  }
});

test('UI language and explanation language are independent', () => {
  const next = applyPreferenceChange(DEFAULT_PREFERENCES, { explanationLanguage: 'te' });
  assert.equal(next.uiLanguage, 'en');
  assert.equal(next.explanationLanguage, 'te');
});

test('applyPreferenceChange ignores invalid values', () => {
  assert.equal(applyPreferenceChange(DEFAULT_PREFERENCES, { uiLanguage: 'klingon' }).uiLanguage, 'en');
});

test('save then load round-trips', () => {
  const storage = memoryStorage();
  assert.equal(savePreferences({ ...DEFAULT_PREFERENCES, uiLanguage: 'te', helpMode: 'hint' }, storage), true);
  const { preferences, issue } = loadPreferences(storage);
  assert.equal(issue, null);
  assert.equal(preferences.uiLanguage, 'te');
  assert.equal(preferences.helpMode, 'hint');
});

test('a missing record loads defaults without an issue', () => {
  assert.deepEqual(loadPreferences(memoryStorage()), { preferences: { ...DEFAULT_PREFERENCES }, issue: null });
});

test('corrupt storage loads defaults, flags it, and keeps a backup of the bad value', () => {
  const storage = memoryStorage({ [PREFERENCES_STORAGE_KEY]: '{not json' });
  const { preferences, issue } = loadPreferences(storage);
  assert.equal(issue, 'unreadable');
  assert.deepEqual(preferences, { ...DEFAULT_PREFERENCES });
  assert.equal(storage.data.get(PREFERENCES_BACKUP_KEY), '{not json');
});

test('an unknown version is treated as unreadable, not trusted', () => {
  const storage = memoryStorage({ [PREFERENCES_STORAGE_KEY]: JSON.stringify({ version: PREFERENCES_VERSION + 1, preferences: { uiLanguage: 'te' } }) });
  assert.equal(loadPreferences(storage).issue, 'unreadable');
});

test('unavailable storage never throws', () => {
  const broken = {
    getItem() {
      throw new Error('denied');
    },
    setItem() {
      throw new Error('quota');
    }
  };
  assert.equal(loadPreferences(broken).issue, 'unavailable');
  assert.equal(loadPreferences(null).issue, 'unavailable');
  assert.equal(savePreferences(DEFAULT_PREFERENCES, broken), false);
  assert.equal(savePreferences(DEFAULT_PREFERENCES, null), false);
});

test('the store notifies subscribers, persists and reports a failed save', () => {
  const storage = memoryStorage();
  const store = createPreferencesStore({ storage });
  let calls = 0;
  const unsubscribe = store.subscribe(() => (calls += 1));

  assert.equal(store.update({ uiLanguage: 'te' }), true);
  assert.equal(store.getSnapshot().preferences.uiLanguage, 'te');
  assert.equal(JSON.parse(storage.data.get(PREFERENCES_STORAGE_KEY)).preferences.uiLanguage, 'te');
  assert.equal(calls, 1);

  unsubscribe();
  store.update({ helpMode: 'full' });
  assert.equal(calls, 1);

  const failing = createPreferencesStore({ storage: { getItem: () => null, setItem: () => { throw new Error('quota'); } } });
  assert.equal(failing.update({ uiLanguage: 'te' }), false);
  assert.equal(failing.getSnapshot().saveFailed, true);
  assert.equal(failing.getSnapshot().preferences.uiLanguage, 'te', 'the change still applies for this session');
});

test('reload picks up a change written by another tab', () => {
  const storage = memoryStorage();
  const store = createPreferencesStore({ storage });
  savePreferences({ ...DEFAULT_PREFERENCES, uiLanguage: 'te' }, storage);
  store.reload();
  assert.equal(store.getSnapshot().preferences.uiLanguage, 'te');
});

test('camera access defaults to allowed, only ever starts from a button, and old saved preferences still load', () => {
  assert.equal(DEFAULT_PREFERENCES.cameraEnabled, true);
  assert.equal(normalizePreferences({ uiLanguage: 'te' }).cameraEnabled, true);
  assert.equal(normalizePreferences({ cameraEnabled: false }).cameraEnabled, false);
  assert.equal(normalizePreferences({ cameraEnabled: 'no' }).cameraEnabled, true);
});

test('theme defaults to following the device, accepts light/dark, and old saved preferences still load', () => {
  assert.equal(DEFAULT_PREFERENCES.theme, 'system');
  assert.equal(normalizePreferences({ uiLanguage: 'te' }).theme, 'system');
  assert.equal(normalizePreferences({ theme: 'dark' }).theme, 'dark');
  assert.equal(normalizePreferences({ theme: 'light' }).theme, 'light');
  assert.equal(normalizePreferences({ theme: 'neon' }).theme, 'system');
  assert.equal(normalizePreferences({ theme: 1 }).theme, 'system');
});

test('the theme choice is saved and reloaded', () => {
  const storage = memoryStorage();
  const store = createPreferencesStore({ storage });
  store.update({ theme: 'dark' });
  assert.equal(JSON.parse(storage.data.get(PREFERENCES_STORAGE_KEY)).preferences.theme, 'dark');
  assert.equal(loadPreferences(storage).preferences.theme, 'dark');
});
