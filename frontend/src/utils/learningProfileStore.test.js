import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMemoryStorage } from '../test-utils/memoryStorage.js';
import { createDefaultProfile } from './learningProfile.js';
import {
  LEARNING_PROFILE_BACKUP_KEY,
  LEARNING_PROFILE_STORAGE_KEY,
  LEARNING_PROFILE_VERSION,
  clearLearningProfileStorage,
  loadLearningProfileState,
  saveLearningProfileState
} from './learningProfileStorage.js';
import { createLearningProfileStore } from './learningProfileStore.js';

const NOW = new Date('2026-10-18T10:00:00.000Z');
const makeStore = (storage = createMemoryStorage()) => createLearningProfileStore({ storage, now: () => NOW });
const stored = (storage) => JSON.parse(storage.data.get(LEARNING_PROFILE_STORAGE_KEY));

describe('storage', () => {
  it('starts from defaults when nothing is stored', () => {
    const { state, issue } = loadLearningProfileState(createMemoryStorage());
    assert.equal(issue, null);
    assert.equal(state.enabled, true);
    assert.equal(state.touched, false);
    assert.deepEqual(state.profile, createDefaultProfile());
  });

  it('round-trips a saved state', () => {
    const storage = createMemoryStorage();
    const state = {
      version: LEARNING_PROFILE_VERSION,
      enabled: false,
      touched: true,
      updatedAt: NOW.toISOString(),
      profile: { ...createDefaultProfile(), goals: ['Pass'] }
    };
    assert.equal(saveLearningProfileState(state, storage), true);
    assert.deepEqual(loadLearningProfileState(storage), { state, issue: null });
  });

  it('recovers from unparseable data and keeps a backup', () => {
    const storage = createMemoryStorage({ [LEARNING_PROFILE_STORAGE_KEY]: '{not json' });
    const { state, issue } = loadLearningProfileState(storage);
    assert.equal(issue, 'unreadable');
    assert.deepEqual(state.profile, createDefaultProfile());
    assert.equal(storage.data.get(LEARNING_PROFILE_BACKUP_KEY), '{not json');
  });

  it('treats an unknown version or shape as unreadable', () => {
    for (const value of [{ version: 99, profile: {} }, { version: 1 }, [], 'x', { version: 1, profile: [] }]) {
      const storage = createMemoryStorage({ [LEARNING_PROFILE_STORAGE_KEY]: JSON.stringify(value) });
      assert.equal(loadLearningProfileState(storage).issue, 'unreadable');
      assert.ok(storage.data.has(LEARNING_PROFILE_BACKUP_KEY));
    }
  });

  it('repairs invalid values, reports it and keeps the original', () => {
    const raw = JSON.stringify({
      version: 1,
      enabled: true,
      touched: true,
      profile: { ...createDefaultProfile(), explanationLevel: 'wizard', goals: ['ok'] }
    });
    const storage = createMemoryStorage({ [LEARNING_PROFILE_STORAGE_KEY]: raw });
    const { state, issue } = loadLearningProfileState(storage);
    assert.equal(issue, 'repaired');
    assert.equal(state.profile.explanationLevel, 'intermediate');
    assert.deepEqual(state.profile.goals, ['ok']);
    assert.equal(storage.data.get(LEARNING_PROFILE_BACKUP_KEY), raw);
  });

  it('reports blocked storage and write failures without throwing', () => {
    assert.equal(loadLearningProfileState(null).issue, 'unavailable');
    const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => {}, removeItem: () => {} };
    assert.equal(loadLearningProfileState(throwing).issue, 'unavailable');
    assert.equal(saveLearningProfileState({}, createMemoryStorage({}, { failWrites: true })), false);
    assert.equal(saveLearningProfileState({}, null), false);
    assert.equal(clearLearningProfileStorage(null), false);
  });
});

describe('store', () => {
  it('does not personalise until the student saves a profile', () => {
    const store = makeStore();
    assert.equal(store.getPersonalizationPayload(), null);
    const request = { message: 'hi' };
    assert.equal(store.personalize(request, 'learningProfile'), request);
  });

  it('saves edits, persists them and builds the AI payload', () => {
    const storage = createMemoryStorage();
    const store = makeStore(storage);
    const result = store.saveProfile({ ...createDefaultProfile(), explanationLevel: 'beginner', goals: ['Pass DBMS'] });

    assert.equal(result.saved, true);
    assert.equal(stored(storage).touched, true);
    assert.equal(stored(storage).updatedAt, NOW.toISOString());
    assert.equal(store.getPersonalizationPayload().explanation_level, 'beginner');
    assert.deepEqual(store.personalize({ message: 'hi' }, 'learningProfile').learningProfile.goals, ['Pass DBMS']);
  });

  it('survives a reload', () => {
    const storage = createMemoryStorage();
    makeStore(storage).saveProfile({ ...createDefaultProfile(), goals: ['Pass'] });
    assert.deepEqual(makeStore(storage).getSnapshot().state.profile.goals, ['Pass']);
  });

  it('stops personalising when disabled and resumes when re-enabled, keeping the data', () => {
    const store = makeStore();
    store.saveProfile({ ...createDefaultProfile(), goals: ['Pass'] });
    store.setEnabled(false);
    assert.equal(store.getPersonalizationPayload(), null);
    assert.deepEqual(store.getSnapshot().state.profile.goals, ['Pass']);
    store.setEnabled(true);
    assert.notEqual(store.getPersonalizationPayload(), null);
  });

  it('sanitises whatever it is asked to save', () => {
    const store = makeStore();
    store.saveProfile({ explanationLevel: 'god', goals: ['  a  ', 'a'] });
    assert.equal(store.getSnapshot().state.profile.explanationLevel, 'intermediate');
    assert.deepEqual(store.getSnapshot().state.profile.goals, ['a']);
  });

  it('reset restores the defaults but keeps the on/off choice', () => {
    const store = makeStore();
    store.saveProfile({ ...createDefaultProfile(), goals: ['Pass'] });
    store.setEnabled(false);
    store.reset();
    const { state } = store.getSnapshot();
    assert.deepEqual(state.profile, createDefaultProfile());
    assert.equal(state.enabled, false);
    assert.equal(store.getPersonalizationPayload(), null);
  });

  it('delete removes everything stored, including the recovery copy', () => {
    const storage = createMemoryStorage({ [LEARNING_PROFILE_BACKUP_KEY]: 'old' });
    const store = makeStore(storage);
    store.saveProfile({ ...createDefaultProfile(), goals: ['Pass'] });
    store.deleteAll();
    assert.equal(storage.data.has(LEARNING_PROFILE_STORAGE_KEY), false);
    assert.equal(storage.data.has(LEARNING_PROFILE_BACKUP_KEY), false);
    assert.equal(store.getPersonalizationPayload(), null);
    assert.equal(store.getSnapshot().state.touched, false);
  });

  it('marks a topic difficult and refuses duplicates', () => {
    const store = makeStore();
    assert.equal(store.markTopicDifficult('DBMS', 'Normalization').added, true);
    const again = store.markTopicDifficult('DBMS', 'normalization');
    assert.equal(again.added, false);
    assert.match(again.error, /already/);
    assert.equal(store.getSnapshot().state.profile.difficultTopics.length, 1);
    assert.equal(store.getSnapshot().state.touched, true);
  });

  it('notifies subscribers and keeps the snapshot stable between changes', () => {
    const store = makeStore();
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls += 1;
    });
    const before = store.getSnapshot();
    assert.equal(store.getSnapshot(), before);
    store.setEnabled(false);
    assert.equal(calls, 1);
    assert.notEqual(store.getSnapshot(), before);
    unsubscribe();
    store.setEnabled(true);
    assert.equal(calls, 1);
  });

  it('reports a failed write instead of pretending it worked', () => {
    const store = makeStore(createMemoryStorage({}, { failWrites: true }));
    assert.equal(store.saveProfile(createDefaultProfile()).saved, false);
    assert.equal(store.getSnapshot().saveFailed, true);
  });

  it('shows a notice for malformed storage and can dismiss it', () => {
    const store = makeStore(createMemoryStorage({ [LEARNING_PROFILE_STORAGE_KEY]: 'garbage' }));
    assert.equal(store.getSnapshot().issue, 'unreadable');
    store.dismissIssue();
    assert.equal(store.getSnapshot().issue, null);
  });

  it('reload picks up changes made elsewhere', () => {
    const storage = createMemoryStorage();
    const store = makeStore(storage);
    makeStore(storage).saveProfile({ ...createDefaultProfile(), goals: ['From another tab'] });
    store.reload();
    assert.deepEqual(store.getSnapshot().state.profile.goals, ['From another tab']);
  });
});
