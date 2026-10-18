import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createInitialState, createConversationWithMessage, findConversation } from './chatConversations.js';
import {
  CHAT_BACKUP_KEY,
  CHAT_STORAGE_KEY,
  LEGACY_CHAT_STORAGE_KEY,
  clearChatStorage,
  loadChatState,
  migrateLegacyValue,
  parseMessages,
  saveChatState
} from './chatStorage.js';

const NOW = '2026-10-18T12:00:00.000Z';

function createStorage(initial = {}, { failWrites = false, failReads = false, failKeyRemoval = null } = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem(key) {
      if (failReads) throw new Error('storage disabled');
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      if (failWrites) throw new Error('quota exceeded');
      data.set(key, String(value));
    },
    removeItem(key) {
      if (failKeyRemoval === key) throw new Error('cannot remove');
      data.delete(key);
    }
  };
}

const legacyMessage = (role, content, minute, extra = {}) => ({
  id: `${role}-${minute}`,
  role,
  content,
  timestamp: `2026-10-17T09:${String(minute).padStart(2, '0')}:00.000Z`,
  subject: 'DBMS',
  ...extra
});

const legacyValue = (messages = [], selectedSubject = 'DBMS') => JSON.stringify({ selectedSubject, messages });

const OTHER_KEYS = {
  'himi.user': '{"name":"Asha"}',
  himi_study_plans_v1: '{"version":1,"plans":[]}',
  'himi.quiz.last': '{"score":3}'
};

describe('loading with nothing stored', () => {
  it('returns an empty draft state without issues', () => {
    const result = loadChatState(createStorage(), NOW);
    assert.deepEqual(result.state.conversations, []);
    assert.equal(result.state.activeConversationId, null);
    assert.equal(result.issue, null);
    assert.equal(result.migrated, false);
  });

  it('reports unavailable storage and never throws', () => {
    assert.equal(loadChatState(createStorage({}, { failReads: true }), NOW).issue.type, 'unavailable');
    assert.equal(loadChatState(null, NOW).issue.type, 'unavailable');
  });
});

describe('saving and restoring', () => {
  const build = () => {
    let state = createInitialState('Python');
    state = createConversationWithMessage(state, {
      id: 'a',
      subject: 'DBMS',
      message: { id: 'm1', role: 'user', content: 'Explain ACID', timestamp: '2026-10-18T10:00:00.000Z', subject: 'DBMS' },
      now: '2026-10-18T10:00:00.000Z'
    });
    return state;
  };

  it('round-trips conversations, messages, subject and the active id', () => {
    const storage = createStorage();
    const state = build();
    assert.equal(saveChatState(state, storage), true);

    const restored = loadChatState(storage, NOW).state;
    assert.equal(restored.activeConversationId, 'a');
    assert.equal(restored.draftSubject, 'Python');
    assert.deepEqual(restored.conversations, state.conversations);
  });

  it('preserves manual titles and error flags', () => {
    const storage = createStorage();
    const state = build();
    state.conversations[0] = {
      ...state.conversations[0],
      title: 'Exam prep',
      titleSource: 'manual',
      messages: [...state.conversations[0].messages, { id: 'm2', role: 'assistant', content: 'oops', timestamp: NOW, subject: 'DBMS', error: true }]
    };
    saveChatState(state, storage);
    const restored = findConversation(loadChatState(storage, NOW).state, 'a');
    assert.equal(restored.title, 'Exam prep');
    assert.equal(restored.titleSource, 'manual');
    assert.equal(restored.messages[1].error, true);
  });

  it('removes the key for an empty default state', () => {
    const storage = createStorage({ [CHAT_STORAGE_KEY]: '{}' });
    assert.equal(saveChatState(createInitialState(), storage), true);
    assert.equal(storage.data.has(CHAT_STORAGE_KEY), false);
  });

  it('stores only versioned chat data (no credentials or other keys)', () => {
    const storage = createStorage(OTHER_KEYS);
    saveChatState(build(), storage);
    const stored = JSON.parse(storage.data.get(CHAT_STORAGE_KEY));
    assert.equal(stored.version, 1);
    assert.deepEqual(Object.keys(stored).sort(), ['activeConversationId', 'conversations', 'draftSubject', 'version']);
    for (const [key, value] of Object.entries(OTHER_KEYS)) assert.equal(storage.data.get(key), value);
  });

  it('reports a failed write instead of throwing', () => {
    assert.equal(saveChatState(build(), createStorage({}, { failWrites: true })), false);
  });
});

describe('migration from the legacy single-conversation format', () => {
  const messages = [
    legacyMessage('user', 'Explain DBMS normalization', 1),
    legacyMessage('assistant', 'Normalization is...', 2),
    legacyMessage('user', 'What is a primary key?', 3, { subject: 'DBMS' }),
    legacyMessage('assistant', "I couldn't process that request.", 4, { error: true })
  ];

  it('turns legacy history into one conversation without losing any message', () => {
    const storage = createStorage({ [LEGACY_CHAT_STORAGE_KEY]: legacyValue(messages), ...OTHER_KEYS });
    const result = loadChatState(storage, NOW);

    assert.equal(result.migrated, true);
    assert.equal(result.issue, null);
    assert.equal(result.state.conversations.length, 1);
    const [conversation] = result.state.conversations;
    assert.equal(result.state.activeConversationId, conversation.id);
    assert.equal(conversation.title, 'DBMS normalization');
    assert.equal(conversation.titleSource, 'auto');
    assert.equal(conversation.subject, 'DBMS');
    assert.deepEqual(conversation.messages, messages);
    assert.equal(conversation.createdAt, messages[0].timestamp);
    assert.equal(conversation.updatedAt, messages[3].timestamp);
  });

  it('writes the new format, verifies it, and only then removes the legacy key', () => {
    const storage = createStorage({ [LEGACY_CHAT_STORAGE_KEY]: legacyValue(messages) });
    loadChatState(storage, NOW);
    assert.equal(storage.data.has(LEGACY_CHAT_STORAGE_KEY), false);
    const stored = JSON.parse(storage.data.get(CHAT_STORAGE_KEY));
    assert.equal(stored.version, 1);
    assert.equal(stored.migratedFromLegacy, true);
    assert.equal(stored.conversations[0].messages.length, 4);
  });

  it('keeps the legacy key when the new data cannot be written', () => {
    const storage = createStorage({ [LEGACY_CHAT_STORAGE_KEY]: legacyValue(messages) }, { failWrites: true });
    const result = loadChatState(storage, NOW);
    assert.equal(storage.data.has(LEGACY_CHAT_STORAGE_KEY), true, 'legacy data is still there');
    assert.equal(result.state.conversations[0].messages.length, 4, 'history is still shown from memory');
  });

  it('is idempotent: repeated loads never duplicate conversations', () => {
    const storage = createStorage({ [LEGACY_CHAT_STORAGE_KEY]: legacyValue(messages) });
    const first = loadChatState(storage, NOW).state;
    const second = loadChatState(storage, NOW).state;
    const third = loadChatState(storage, NOW).state;
    assert.equal(second.conversations.length, 1);
    assert.equal(third.conversations.length, 1);
    assert.deepEqual(second.conversations, first.conversations);
    assert.equal(loadChatState(storage, NOW).migrated, false);
  });

  it('does not migrate twice if removing the legacy key was interrupted, and finishes the cleanup', () => {
    const storage = createStorage({ [LEGACY_CHAT_STORAGE_KEY]: legacyValue(messages) }, { failKeyRemoval: LEGACY_CHAT_STORAGE_KEY });
    const first = loadChatState(storage, NOW);
    assert.equal(storage.data.has(LEGACY_CHAT_STORAGE_KEY), true, 'removal failed');

    storage.removeItem = (key) => storage.data.delete(key); // the browser recovers
    const second = loadChatState(storage, NOW);
    assert.equal(second.state.conversations.length, 1, 'no duplicate conversation');
    assert.equal(second.state.conversations[0].id, first.state.conversations[0].id);
    assert.equal(storage.data.has(LEGACY_CHAT_STORAGE_KEY), false, 'cleanup finished');
  });

  it('never overwrites existing new-format data with old legacy data', () => {
    const storage = createStorage();
    let state = createInitialState();
    state = createConversationWithMessage(state, {
      id: 'new',
      subject: 'Java',
      message: { id: 'x', role: 'user', content: 'Newer chat', timestamp: NOW, subject: 'Java' },
      now: NOW
    });
    saveChatState(state, storage);
    storage.data.set(LEGACY_CHAT_STORAGE_KEY, legacyValue(messages));

    const result = loadChatState(storage, NOW);
    assert.equal(result.state.conversations.length, 1);
    assert.equal(result.state.conversations[0].id, 'new');
    assert.equal(storage.data.has(LEGACY_CHAT_STORAGE_KEY), true, 'untouched');
  });

  it('keeps valid messages and drops damaged ones, reporting a partial migration', () => {
    const damaged = [
      messages[0],
      null,
      'text',
      { id: 'bad-role', role: 'system', content: 'x' },
      { id: 'no-content', role: 'user' },
      messages[1]
    ];
    const result = loadChatState(createStorage({ [LEGACY_CHAT_STORAGE_KEY]: legacyValue(damaged) }), NOW);
    assert.equal(result.state.conversations[0].messages.length, 2);
    assert.deepEqual(result.issue, { type: 'legacy-partial', dropped: 4 });
  });

  it('keeps valid timestamps and repairs invalid ones, subjects and ids', () => {
    const odd = [
      { id: 'a', role: 'user', content: 'First', timestamp: 'garbage', subject: 'Nope' },
      { role: 'assistant', content: 'Second', timestamp: '2026-10-17T09:30:00.000Z', subject: 'AI' },
      { id: 'a', role: 'user', content: 'Duplicate id', timestamp: '2026-10-17T09:31:00.000Z' }
    ];
    const { state } = migrateLegacyValue({ selectedSubject: 'Java', messages: odd }, NOW);
    const result = state.conversations[0].messages;
    assert.equal(result[0].timestamp, NOW);
    assert.equal(result[0].subject, 'Java');
    assert.equal(result[1].timestamp, '2026-10-17T09:30:00.000Z');
    assert.equal(result[1].subject, 'AI');
    assert.equal(new Set(result.map((message) => message.id)).size, 3, 'ids are unique');
    assert.ok(result.every((message) => typeof message.id === 'string' && message.id));
  });

  it('migrates an assistant-only history with a safe title', () => {
    const { state } = migrateLegacyValue({ selectedSubject: 'DBMS', messages: [legacyMessage('assistant', 'Hello', 1)] }, NOW);
    assert.equal(state.conversations[0].title, 'New chat');
  });

  it('carries over only the subject for an empty legacy value, then removes it', () => {
    const storage = createStorage({ [LEGACY_CHAT_STORAGE_KEY]: legacyValue([], 'Java') });
    const result = loadChatState(storage, NOW);
    assert.equal(result.state.conversations.length, 0);
    assert.equal(result.state.draftSubject, 'Java');
    assert.equal(storage.data.has(LEGACY_CHAT_STORAGE_KEY), false);
    assert.equal(loadChatState(storage, NOW).state.draftSubject, 'Java');
  });

  it('leaves an unreadable legacy value untouched and warns', () => {
    for (const raw of ['{not json', 'null', '123', '"text"', '[]']) {
      const storage = createStorage({ [LEGACY_CHAT_STORAGE_KEY]: raw });
      const result = loadChatState(storage, NOW);
      assert.equal(result.issue.type, 'legacy-unreadable', raw);
      assert.equal(result.state.conversations.length, 0);
      assert.equal(storage.data.get(LEGACY_CHAT_STORAGE_KEY), raw, 'the only copy is preserved');
      assert.equal(storage.data.has(CHAT_STORAGE_KEY), false);
    }
  });

  it('treats a legacy value without a messages array as empty', () => {
    const storage = createStorage({ [LEGACY_CHAT_STORAGE_KEY]: JSON.stringify({ selectedSubject: 'Python' }) });
    const result = loadChatState(storage, NOW);
    assert.equal(result.state.conversations.length, 0);
    assert.equal(result.state.draftSubject, 'Python');
    assert.equal(result.issue, null);
  });

  it('never touches user, quiz or study-planner keys', () => {
    const storage = createStorage({ [LEGACY_CHAT_STORAGE_KEY]: legacyValue(messages), ...OTHER_KEYS });
    loadChatState(storage, NOW);
    for (const [key, value] of Object.entries(OTHER_KEYS)) assert.equal(storage.data.get(key), value, key);
  });
});

describe('malformed or unsupported new-format data', () => {
  it('backs up unreadable JSON and starts fresh', () => {
    const storage = createStorage({ [CHAT_STORAGE_KEY]: '{broken' });
    const result = loadChatState(storage, NOW);
    assert.equal(result.issue.type, 'unreadable');
    assert.equal(result.state.conversations.length, 0);
    assert.equal(storage.data.get(CHAT_BACKUP_KEY), '{broken');
  });

  it('backs up structurally invalid data', () => {
    for (const raw of ['null', '[]', '{"version":1}', '{"version":1,"conversations":"x"}', '42']) {
      const storage = createStorage({ [CHAT_STORAGE_KEY]: raw });
      assert.equal(loadChatState(storage, NOW).issue.type, 'unreadable', raw);
      assert.equal(storage.data.get(CHAT_BACKUP_KEY), raw);
    }
  });

  it('does not use legacy data when the new key exists but is unreadable', () => {
    const storage = createStorage({ [CHAT_STORAGE_KEY]: '{broken', [LEGACY_CHAT_STORAGE_KEY]: legacyValue([legacyMessage('user', 'Old', 1)]) });
    const result = loadChatState(storage, NOW);
    assert.equal(result.state.conversations.length, 0);
    assert.equal(storage.data.has(LEGACY_CHAT_STORAGE_KEY), true);
  });

  it('rejects unsupported versions without interpreting them', () => {
    for (const version of [2, 0, '1', null, undefined]) {
      const raw = JSON.stringify({ version, conversations: [{ id: 'x', messages: [] }] });
      const storage = createStorage({ [CHAT_STORAGE_KEY]: raw });
      const result = loadChatState(storage, NOW);
      assert.equal(result.issue.type, 'unsupported', String(version));
      assert.equal(result.state.conversations.length, 0);
      assert.equal(storage.data.get(CHAT_BACKUP_KEY), raw);
    }
  });

  it('skips damaged conversations and messages but restores the rest', () => {
    const raw = JSON.stringify({
      version: 1,
      activeConversationId: 'good',
      draftSubject: 'Nonsense',
      conversations: [
        null,
        'x',
        { id: 'good', title: 'Fine', subject: 'DBMS', createdAt: NOW, updatedAt: NOW, messages: [{ id: 'm', role: 'user', content: 'hi', timestamp: NOW, subject: 'DBMS' }, { role: 'bad' }] },
        { id: 'empty', subject: 'Nonsense' }
      ]
    });
    const result = loadChatState(createStorage({ [CHAT_STORAGE_KEY]: raw }), NOW);
    assert.equal(result.state.conversations.length, 2);
    assert.equal(findConversation(result.state, 'good').messages.length, 1);
    assert.equal(findConversation(result.state, 'empty').subject, 'Operating Systems');
    assert.equal(findConversation(result.state, 'empty').title, 'New chat');
    assert.equal(result.state.draftSubject, 'Operating Systems');
    assert.deepEqual(result.issue, { type: 'partial', dropped: 3 });
  });

  it('repairs duplicate conversation ids and duplicate message ids', () => {
    const message = (content) => ({ id: 'same', role: 'user', content, timestamp: NOW, subject: 'DBMS' });
    const raw = JSON.stringify({
      version: 1,
      activeConversationId: 'dup',
      conversations: [
        { id: 'dup', title: 'First', subject: 'DBMS', createdAt: NOW, updatedAt: NOW, messages: [message('a'), message('b')] },
        { id: 'dup', title: 'Second', subject: 'DBMS', createdAt: NOW, updatedAt: NOW, messages: [message('c')] }
      ]
    });
    const { state } = loadChatState(createStorage({ [CHAT_STORAGE_KEY]: raw }), NOW);
    assert.equal(state.conversations.length, 2, 'no conversation lost');
    assert.equal(new Set(state.conversations.map((c) => c.id)).size, 2);
    assert.equal(state.activeConversationId, 'dup');
    const ids = state.conversations[0].messages.map((m) => m.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('falls back to a draft when the stored active id no longer exists', () => {
    const raw = JSON.stringify({ version: 1, activeConversationId: 'ghost', conversations: [{ id: 'a', subject: 'DBMS', createdAt: NOW, updatedAt: NOW, messages: [] }] });
    assert.equal(loadChatState(createStorage({ [CHAT_STORAGE_KEY]: raw }), NOW).state.activeConversationId, null);
  });

  it('sorts by last activity and tolerates bad timestamps', () => {
    const conv = (id, updatedAt) => ({ id, subject: 'DBMS', createdAt: NOW, updatedAt, messages: [] });
    const raw = JSON.stringify({ version: 1, conversations: [conv('old', '2026-10-01T00:00:00.000Z'), conv('bad', 'garbage'), conv('new', '2026-10-19T00:00:00.000Z')] });
    const ids = loadChatState(createStorage({ [CHAT_STORAGE_KEY]: raw }), NOW).state.conversations.map((c) => c.id);
    // 'bad' falls back to its createdAt (NOW), which sits between the other two.
    assert.deepEqual(ids, ['new', 'bad', 'old']);
  });
});

describe('parseMessages', () => {
  it('only accepts arrays', () => {
    for (const value of [null, undefined, {}, 'x', 5]) assert.deepEqual(parseMessages(value, NOW, 'DBMS'), { messages: [], dropped: 0 });
  });

  it('drops the error flag unless it is exactly true', () => {
    const { messages } = parseMessages([{ id: 'a', role: 'assistant', content: 'x', error: 'yes' }], NOW, 'DBMS');
    assert.equal('error' in messages[0], false);
  });
});

describe('clearing storage (sign out)', () => {
  it('removes only chat keys', () => {
    const storage = createStorage({
      [CHAT_STORAGE_KEY]: '{}',
      [LEGACY_CHAT_STORAGE_KEY]: '{}',
      [CHAT_BACKUP_KEY]: 'x',
      ...OTHER_KEYS
    });
    assert.equal(clearChatStorage(storage), true);
    assert.deepEqual([...storage.data.keys()].sort(), Object.keys(OTHER_KEYS).sort());
  });
});
