import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMemoryStorage } from '../test-utils/memoryStorage.js';
import { WHITEBOARD_BACKUP_KEY, WHITEBOARD_STORAGE_KEY, clearStoredWhiteboard, loadWhiteboard, saveWhiteboard } from './whiteboardStorage.js';

const shape = (id) => ({ id, type: 'rect', color: '#2563eb', size: 3, x1: 10, y1: 10, x2: 100, y2: 80 });

describe('whiteboard storage', () => {
  it('starts empty with no issue when nothing was saved', () => {
    assert.deepEqual(loadWhiteboard(createMemoryStorage()), { shapes: [], issue: null, skipped: 0 });
  });

  it('round-trips shapes through a versioned record', () => {
    const storage = createMemoryStorage();
    assert.deepEqual(saveWhiteboard([shape('a'), shape('b')], storage), { ok: true });
    assert.equal(JSON.parse(storage.getItem(WHITEBOARD_STORAGE_KEY)).version, 1);
    const loaded = loadWhiteboard(storage);
    assert.deepEqual(loaded.shapes.map((s) => s.id), ['a', 'b']);
    assert.equal(loaded.issue, null);
  });

  it('saving an empty board removes the record', () => {
    const storage = createMemoryStorage();
    saveWhiteboard([shape('a')], storage);
    saveWhiteboard([], storage);
    assert.equal(storage.getItem(WHITEBOARD_STORAGE_KEY), null);
  });

  it('backs up unreadable data and starts clean instead of crashing', () => {
    for (const raw of ['{not json', JSON.stringify({ version: 99, shapes: [] }), JSON.stringify({ version: 1 }), JSON.stringify([1, 2])]) {
      const storage = createMemoryStorage({ [WHITEBOARD_STORAGE_KEY]: raw });
      const loaded = loadWhiteboard(storage);
      assert.equal(loaded.issue, 'unreadable');
      assert.deepEqual(loaded.shapes, []);
      assert.equal(storage.getItem(WHITEBOARD_BACKUP_KEY), raw);
    }
  });

  it('keeps valid shapes from a partly damaged record and reports it', () => {
    const raw = JSON.stringify({ version: 1, shapes: [shape('a'), { id: 'bad', type: 'stroke', color: 'red' }, shape('b')] });
    const storage = createMemoryStorage({ [WHITEBOARD_STORAGE_KEY]: raw });
    const loaded = loadWhiteboard(storage);
    assert.deepEqual(loaded.shapes.map((s) => s.id), ['a', 'b']);
    assert.equal(loaded.issue, 'partial');
    assert.equal(loaded.skipped, 1);
    assert.equal(storage.getItem(WHITEBOARD_BACKUP_KEY), raw);
  });

  it('reports a full or unavailable storage without throwing', () => {
    assert.deepEqual(saveWhiteboard([shape('a')], createMemoryStorage({}, { failWrites: true })), { ok: false, reason: 'full' });
    assert.deepEqual(saveWhiteboard([shape('a')], null), { ok: false, reason: 'unavailable' });
    assert.equal(loadWhiteboard(null).issue, 'unavailable');
    const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => {}, removeItem: () => {} };
    assert.equal(loadWhiteboard(throwing).issue, 'unavailable');
  });

  it('clear removes the record', () => {
    const storage = createMemoryStorage();
    saveWhiteboard([shape('a')], storage);
    clearStoredWhiteboard(storage);
    assert.equal(storage.getItem(WHITEBOARD_STORAGE_KEY), null);
  });
});
