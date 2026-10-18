import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findConversation, getActiveConversation, getActiveMessages } from './chatConversations.js';
import { CHAT_ERROR_MESSAGE, createChatStore } from './chatStore.js';
import { CHAT_STORAGE_KEY, LEGACY_CHAT_STORAGE_KEY } from './chatStorage.js';

function createStorage(initial = {}, { failWrites = false } = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem(key, value) {
      if (failWrites) throw new Error('quota');
      data.set(key, String(value));
    },
    removeItem: (key) => data.delete(key)
  };
}

/** A fake chat backend whose replies are resolved by the test, in any order. */
function createFakeBackend() {
  const calls = [];
  return {
    calls,
    sendChat(payload, { signal }) {
      return new Promise((resolve, reject) => {
        const call = { payload, signal, resolve, reject };
        calls.push(call);
        signal.addEventListener('abort', () => reject(Object.assign(new Error('cancelled'), { code: 'ERR_CANCELED' })));
      });
    },
    reply(index, text) {
      calls[index].resolve({ status: 'success', response: text, timestamp: 'x' });
    },
    fail(index) {
      calls[index].reject(new Error('network down'));
    }
  };
}

function setup(options = {}) {
  const backend = createFakeBackend();
  const storage = options.storage ?? createStorage();
  const notices = [];
  const store = createChatStore({ sendChat: backend.sendChat, storage });
  store.setNotifier((notice) => notices.push(notice));
  const chat = () => store.getSnapshot().state;
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { backend, storage, notices, store, chat, flush };
}

const contents = (state, id) => findConversation(state, id).messages.map((m) => `${m.role}:${m.content}`);

describe('sending messages', () => {
  it('creates a conversation on the first message and sends the right payload', async () => {
    const { store, backend, chat, flush } = setup();
    store.setUserName('Asha');
    store.setSubject('DBMS');
    const sending = store.sendMessage('  Explain DBMS normalization  ');
    await flush();

    assert.equal(chat().conversations.length, 1);
    const conversation = getActiveConversation(chat());
    assert.equal(conversation.title, 'DBMS normalization');
    assert.equal(conversation.subject, 'DBMS');
    assert.deepEqual(backend.calls[0].payload, { message: 'Explain DBMS normalization', subject: 'DBMS', userName: 'Asha' });
    assert.equal(store.isPending(conversation.id), true);

    backend.reply(0, 'Normalization removes redundancy.');
    assert.equal(await sending, true);
    assert.deepEqual(contents(chat(), conversation.id), ['user:Explain DBMS normalization', 'assistant:Normalization removes redundancy.']);
    assert.equal(store.isPending(conversation.id), false);
  });

  it('ignores blank messages', async () => {
    const { store, backend, chat } = setup();
    assert.equal(await store.sendMessage('   '), false);
    assert.equal(await store.sendMessage(undefined), false);
    assert.equal(backend.calls.length, 0);
    assert.equal(chat().conversations.length, 0);
  });

  it('never sends two requests at once from the same conversation', async () => {
    const { store, backend, flush } = setup();
    const first = store.sendMessage('First question');
    await flush();
    assert.equal(await store.sendMessage('Second question while waiting'), false);
    assert.equal(backend.calls.length, 1);
    backend.reply(0, 'ok');
    await first;
  });

  it('appends later messages to the same conversation', async () => {
    const { store, backend, chat, flush } = setup();
    const a = store.sendMessage('Explain ACID');
    await flush();
    backend.reply(0, 'A');
    await a;
    const b = store.sendMessage('And isolation?');
    await flush();
    backend.reply(1, 'B');
    await b;
    assert.equal(chat().conversations.length, 1);
    assert.equal(getActiveMessages(chat()).length, 4);
    assert.equal(getActiveConversation(chat()).title, 'ACID');
  });
});

describe('conversations stay independent', () => {
  it('keeps two conversations separate and switching restores each', async () => {
    const { store, backend, chat, flush } = setup();
    const a = store.sendMessage('Explain deadlock');
    await flush();
    backend.reply(0, 'Deadlock answer');
    await a;
    const idA = chat().activeConversationId;

    store.startNewConversation('Python');
    assert.equal(chat().activeConversationId, null);
    assert.deepEqual(getActiveMessages(chat()), []);
    const b = store.sendMessage('What is a decorator?');
    await flush();
    backend.reply(1, 'Decorator answer');
    await b;
    const idB = chat().activeConversationId;

    assert.notEqual(idA, idB);
    assert.deepEqual(contents(chat(), idA), ['user:Explain deadlock', 'assistant:Deadlock answer']);
    assert.deepEqual(contents(chat(), idB), ['user:What is a decorator?', 'assistant:Decorator answer']);
    assert.equal(findConversation(chat(), idB).subject, 'Python');

    store.selectConversation(idA);
    assert.deepEqual(getActiveMessages(chat()).map((m) => m.content), ['Explain deadlock', 'Deadlock answer']);
    assert.equal(backend.calls[1].payload.subject, 'Python', 'second chat used its own subject');
  });

  it('keeps the subject chosen for a draft independent of existing conversations', async () => {
    const { store, backend, chat, flush } = setup();
    store.setSubject('Java');
    const a = store.sendMessage('Explain interfaces');
    await flush();
    backend.reply(0, 'x');
    await a;
    store.startNewConversation('Algorithms');
    store.setSubject('Machine Learning');
    assert.equal(chat().conversations[0].subject, 'Java');
    assert.equal(chat().draftSubject, 'Machine Learning');
  });
});

describe('late responses (ownership)', () => {
  it('a reply that arrives after switching lands in the originating conversation only', async () => {
    const { store, backend, chat, flush } = setup();
    const a = store.sendMessage('Question for A');
    await flush();
    const idA = chat().activeConversationId;

    store.startNewConversation();
    const b = store.sendMessage('Question for B');
    await flush();
    const idB = chat().activeConversationId;

    // B's reply arrives first, A's reply arrives while B is open
    backend.reply(1, 'Reply to B');
    await b;
    backend.reply(0, 'Reply to A');
    await a;

    assert.deepEqual(contents(chat(), idA), ['user:Question for A', 'assistant:Reply to A']);
    assert.deepEqual(contents(chat(), idB), ['user:Question for B', 'assistant:Reply to B']);
    assert.equal(chat().activeConversationId, idB, 'the open conversation does not change');
  });

  it('a pending reply never blocks switching to another conversation', async () => {
    const { store, backend, chat, flush } = setup();
    const a = store.sendMessage('Slow question');
    await flush();
    const idA = chat().activeConversationId;
    store.startNewConversation();
    assert.equal(chat().activeConversationId, null);
    assert.equal(store.isPending(idA), true);

    store.selectConversation(idA);
    assert.equal(chat().activeConversationId, idA);
    backend.reply(0, 'done');
    await a;
  });

  it('allows a different conversation to send while another is waiting', async () => {
    const { store, backend, chat, flush } = setup();
    const a = store.sendMessage('First chat');
    await flush();
    store.startNewConversation();
    const b = store.sendMessage('Second chat');
    await flush();
    assert.equal(backend.calls.length, 2);
    backend.reply(0, 'A');
    backend.reply(1, 'B');
    await Promise.all([a, b]);
    assert.equal(chat().conversations.length, 2);
  });

  it('drops a late reply for a conversation that was deleted, without resurrecting it', async () => {
    const { store, backend, chat, flush, notices } = setup();
    const sending = store.sendMessage('Delete me soon');
    await flush();
    const id = chat().activeConversationId;

    store.deleteConversation(id);
    assert.equal(backend.calls[0].signal.aborted, true, 'the request was cancelled');
    backend.reply(0, 'too late');
    await sending;

    assert.equal(chat().conversations.length, 0);
    assert.equal(findConversation(chat(), id), null);
    assert.equal(store.isPending(id), false);
    assert.deepEqual(notices, [], 'no error toast for a deleted conversation');
  });

  it('does not leak a late reply into a conversation opened after the delete', async () => {
    const { store, backend, chat, flush } = setup();
    const a = store.sendMessage('Question A');
    await flush();
    store.deleteConversation(chat().activeConversationId);
    const b = store.sendMessage('Question B');
    await flush();
    backend.reply(0, 'Reply for deleted A');
    backend.reply(1, 'Reply B');
    await Promise.all([a, b]);
    assert.deepEqual(getActiveMessages(chat()).map((m) => m.content), ['Question B', 'Reply B']);
  });

  it('drops a late failure for a deleted conversation (no bubble, no toast)', async () => {
    const { store, backend, chat, flush, notices } = setup();
    const sending = store.sendMessage('Will fail');
    await flush();
    store.deleteConversation(chat().activeConversationId);
    backend.fail(0);
    await sending;
    assert.equal(chat().conversations.length, 0);
    assert.deepEqual(notices, []);
  });

  it('deleting one conversation does not cancel another conversation\'s request', async () => {
    const { store, backend, chat, flush } = setup();
    const a = store.sendMessage('A');
    await flush();
    const idA = chat().activeConversationId;
    store.startNewConversation();
    const b = store.sendMessage('B');
    await flush();
    store.deleteConversation(chat().activeConversationId);
    assert.equal(backend.calls[0].signal.aborted, false);
    backend.reply(0, 'A reply');
    await Promise.all([a, b]);
    assert.deepEqual(contents(chat(), idA), ['user:A', 'assistant:A reply']);
  });

  it('clearing a conversation cancels its request so a late reply cannot appear without its question', async () => {
    const { store, backend, chat, flush } = setup();
    const sending = store.sendMessage('Question');
    await flush();
    const id = chat().activeConversationId;
    store.clearConversation(id);
    backend.reply(0, 'orphan reply');
    await sending;
    assert.equal(findConversation(chat(), id).messages.length, 0);
    assert.equal(findConversation(chat(), id).title, 'Question', 'record and title are kept');
    assert.equal(store.isPending(id), false);
  });

  it('can send again right after clearing while the old request is still winding down', async () => {
    const { store, backend, chat, flush } = setup();
    const first = store.sendMessage('Old');
    await flush();
    const id = chat().activeConversationId;
    store.clearConversation(id);
    const second = store.sendMessage('New');
    await flush();
    backend.reply(0, 'old reply');
    backend.reply(1, 'new reply');
    await Promise.all([first, second]);
    assert.deepEqual(contents(chat(), id), ['user:New', 'assistant:new reply']);
  });
});

describe('failure and retry', () => {
  it('turns a failure into an error message in the same conversation and notifies', async () => {
    const { store, backend, chat, flush, notices } = setup();
    const sending = store.sendMessage('Explain paging');
    await flush();
    backend.fail(0);
    await sending;
    const messages = getActiveMessages(chat());
    assert.equal(messages[1].content, CHAT_ERROR_MESSAGE);
    assert.equal(messages[1].error, true);
    assert.equal(notices.length, 1);
    assert.equal(notices[0].type, 'reply-failed');
    assert.equal(notices[0].active, true);
    assert.equal(store.isPending(chat().activeConversationId), false);
  });

  it('treats a non-success payload as a failure', async () => {
    const { store, backend, chat, flush } = setup();
    const sending = store.sendMessage('Hi there');
    await flush();
    backend.calls[0].resolve({ status: 'error', response: '' });
    await sending;
    assert.equal(getActiveMessages(chat())[1].error, true);
  });

  it('a failure in one conversation does not touch another', async () => {
    const { store, backend, chat, flush } = setup();
    const a = store.sendMessage('Chat A');
    await flush();
    backend.reply(0, 'fine');
    await a;
    const idA = chat().activeConversationId;
    store.startNewConversation();
    const b = store.sendMessage('Chat B');
    await flush();
    backend.fail(1);
    await b;
    assert.deepEqual(contents(chat(), idA), ['user:Chat A', 'assistant:fine']);
  });

  it('flags a failure that happens in a conversation that is not open', async () => {
    const { store, backend, flush, notices } = setup();
    const a = store.sendMessage('Chat A');
    await flush();
    store.startNewConversation();
    backend.fail(0);
    await a;
    assert.equal(notices[0].active, false);
    assert.equal(notices[0].title, 'Chat A');
  });

  it('retry replaces the error bubble with a fresh request for the same question and subject', async () => {
    const { store, backend, chat, flush } = setup();
    store.setSubject('Python');
    const sending = store.sendMessage('Explain generators');
    await flush();
    backend.fail(0);
    await sending;
    const id = chat().activeConversationId;
    const errorId = findConversation(chat(), id).messages[1].id;

    const retrying = store.retryMessage(id, errorId);
    await flush();
    assert.equal(findConversation(chat(), id).messages.length, 1, 'error bubble removed');
    assert.equal(backend.calls.length, 2);
    assert.equal(backend.calls[1].payload.message, 'Explain generators');
    assert.equal(backend.calls[1].payload.subject, 'Python');
    backend.reply(1, 'Generators yield values.');
    assert.equal(await retrying, true);
    assert.deepEqual(contents(chat(), id), ['user:Explain generators', 'assistant:Generators yield values.']);
  });

  it('retry targets the conversation it was invoked for, even if another one is open', async () => {
    const { store, backend, chat, flush } = setup();
    const a = store.sendMessage('Question A');
    await flush();
    backend.fail(0);
    await a;
    const idA = chat().activeConversationId;
    const errorId = findConversation(chat(), idA).messages[1].id;
    store.startNewConversation();

    const retrying = store.retryMessage(idA, errorId);
    await flush();
    backend.reply(1, 'Recovered');
    await retrying;
    assert.deepEqual(contents(chat(), idA), ['user:Question A', 'assistant:Recovered']);
    assert.equal(chat().activeConversationId, null);
  });

  it('retry is a no-op for unknown ids or while a request is pending', async () => {
    const { store, backend, chat, flush } = setup();
    const sending = store.sendMessage('Q');
    await flush();
    const id = chat().activeConversationId;
    assert.equal(await store.retryMessage(id, 'nope'), false);
    assert.equal(await store.retryMessage('ghost', 'nope'), false);
    backend.fail(0);
    await sending;
    const errorId = findConversation(chat(), id).messages[1].id;
    const retrying = store.retryMessage(id, errorId);
    await flush();
    assert.equal(await store.retryMessage(id, errorId), false, 'already retrying');
    backend.reply(1, 'ok');
    await retrying;
  });

  it('a retry that fails again leaves a new error bubble', async () => {
    const { store, backend, chat, flush } = setup();
    const sending = store.sendMessage('Q');
    await flush();
    backend.fail(0);
    await sending;
    const id = chat().activeConversationId;
    const retrying = store.retryMessage(id, findConversation(chat(), id).messages[1].id);
    await flush();
    backend.fail(1);
    await retrying;
    assert.equal(findConversation(chat(), id).messages.length, 2);
    assert.equal(findConversation(chat(), id).messages[1].error, true);
  });
});

describe('management actions', () => {
  async function twoChats(ctx) {
    const a = ctx.store.sendMessage('Explain ACID');
    await ctx.flush();
    ctx.backend.reply(0, 'A');
    await a;
    const idA = ctx.chat().activeConversationId;
    ctx.store.startNewConversation();
    const b = ctx.store.sendMessage('Explain TCP');
    await ctx.flush();
    ctx.backend.reply(1, 'B');
    await b;
    return { idA, idB: ctx.chat().activeConversationId };
  }

  it('renames, deletes and clears without affecting the others', async () => {
    const ctx = setup();
    const { idA, idB } = await twoChats(ctx);

    assert.equal(ctx.store.renameConversation(idA, 'Database exam'), true);
    assert.equal(ctx.store.renameConversation(idA, '   '), false);
    assert.equal(findConversation(ctx.chat(), idA).title, 'Database exam');

    ctx.store.clearConversation(idB);
    assert.equal(findConversation(ctx.chat(), idB).messages.length, 0);
    assert.equal(findConversation(ctx.chat(), idA).messages.length, 2, 'clear only affects the target');

    ctx.store.deleteConversation(idB);
    assert.equal(ctx.chat().conversations.length, 1);
    assert.equal(ctx.chat().activeConversationId, null);
    assert.equal(findConversation(ctx.chat(), idA).title, 'Database exam');
  });

  it('keeps a manual title when the next messages arrive', async () => {
    const ctx = setup();
    const { idA } = await twoChats(ctx);
    ctx.store.renameConversation(idA, 'My title');
    ctx.store.selectConversation(idA);
    const more = ctx.store.sendMessage('Totally different topic');
    await ctx.flush();
    ctx.backend.reply(2, 'x');
    await more;
    assert.equal(findConversation(ctx.chat(), idA).title, 'My title');
  });

  it('notifies subscribers on change and only on change', async () => {
    const ctx = setup();
    let count = 0;
    const unsubscribe = ctx.store.subscribe(() => {
      count += 1;
    });
    ctx.store.selectConversation('missing');
    assert.equal(count, 0);
    ctx.store.setSubject('Java');
    assert.equal(count, 1);
    unsubscribe();
    ctx.store.setSubject('Python');
    assert.equal(count, 1);
  });

  it('returns a stable snapshot between changes (required by useSyncExternalStore)', () => {
    const { store } = setup();
    assert.equal(store.getSnapshot(), store.getSnapshot());
    const before = store.getSnapshot();
    store.setSubject('Java');
    assert.notEqual(store.getSnapshot(), before);
  });

  it('clear all (sign out) removes every conversation and chat key, and cancels requests', async () => {
    const ctx = setup({ storage: createStorage({ 'himi.user': 'keep', himi_study_plans_v1: 'keep' }) });
    const sending = ctx.store.sendMessage('In flight');
    await ctx.flush();
    ctx.store.clearAll();
    ctx.backend.reply(0, 'late');
    await sending;
    assert.equal(ctx.chat().conversations.length, 0);
    assert.equal(ctx.storage.data.has(CHAT_STORAGE_KEY), false);
    assert.equal(ctx.storage.data.get('himi.user'), 'keep');
    assert.equal(ctx.storage.data.get('himi_study_plans_v1'), 'keep');
  });

  it('enforces the conversation limit when starting a new one', async () => {
    const ctx = setup();
    for (let i = 0; i < 50; i += 1) {
      ctx.store.startNewConversation();
      const sending = ctx.store.sendMessage(`Question ${i}`);
      await ctx.flush();
      ctx.backend.reply(i, 'ok');
      await sending;
    }
    ctx.store.startNewConversation();
    assert.equal(await ctx.store.sendMessage('One too many'), false);
    assert.equal(ctx.chat().conversations.length, 50);
    assert.equal(ctx.notices.at(-1).type, 'limit-reached');
  });
});

describe('persistence', () => {
  it('restores conversations, messages and the active conversation after a reload', async () => {
    const ctx = setup();
    const a = ctx.store.sendMessage('Explain ACID');
    await ctx.flush();
    ctx.backend.reply(0, 'A');
    await a;
    ctx.store.startNewConversation('Java');
    const b = ctx.store.sendMessage('Explain interfaces');
    await ctx.flush();
    ctx.backend.reply(1, 'B');
    await b;
    const idB = ctx.chat().activeConversationId;
    ctx.store.renameConversation(idB, 'OOP notes');

    const reloaded = createChatStore({ sendChat: createFakeBackend().sendChat, storage: ctx.storage }).getSnapshot().state;
    assert.equal(reloaded.conversations.length, 2);
    assert.equal(reloaded.activeConversationId, idB);
    assert.equal(findConversation(reloaded, idB).title, 'OOP notes');
    assert.deepEqual(contents(reloaded, idB), ['user:Explain interfaces', 'assistant:B']);
  });

  it('persists the user message immediately, before the reply arrives', async () => {
    const ctx = setup();
    const sending = ctx.store.sendMessage('Question in flight');
    await ctx.flush();
    const reloaded = createChatStore({ sendChat: createFakeBackend().sendChat, storage: ctx.storage }).getSnapshot().state;
    assert.equal(reloaded.conversations[0].messages.length, 1);
    ctx.backend.reply(0, 'x');
    await sending;
  });

  it('migrates legacy history when the store starts, then uses the new format', () => {
    const legacy = JSON.stringify({
      selectedSubject: 'DBMS',
      messages: [{ id: 'u1', role: 'user', content: 'Explain normalization', timestamp: '2026-10-17T09:00:00.000Z', subject: 'DBMS' }]
    });
    const storage = createStorage({ [LEGACY_CHAT_STORAGE_KEY]: legacy });
    const first = createChatStore({ sendChat: createFakeBackend().sendChat, storage }).getSnapshot().state;
    const second = createChatStore({ sendChat: createFakeBackend().sendChat, storage }).getSnapshot().state;
    assert.equal(first.conversations.length, 1);
    assert.equal(second.conversations.length, 1);
    assert.equal(second.conversations[0].messages[0].id, 'u1');
    assert.equal(storage.data.has(LEGACY_CHAT_STORAGE_KEY), false);
  });

  it('exposes load issues and lets the UI dismiss them', () => {
    const storage = createStorage({ [CHAT_STORAGE_KEY]: '{broken' });
    const store = createChatStore({ sendChat: createFakeBackend().sendChat, storage });
    assert.equal(store.getSnapshot().loadIssue.type, 'unreadable');
    store.dismissLoadIssue();
    assert.equal(store.getSnapshot().loadIssue, null);
  });

  it('keeps working when storage rejects writes, warning only once', async () => {
    const ctx = setup({ storage: createStorage({}, { failWrites: true }) });
    const a = ctx.store.sendMessage('First');
    await ctx.flush();
    ctx.backend.reply(0, 'ok');
    await a;
    assert.equal(ctx.chat().conversations[0].messages.length, 2);
    assert.equal(ctx.notices.filter((n) => n.type === 'storage-failed').length, 1);
  });

  it('works with no storage at all', async () => {
    const backend = createFakeBackend();
    const store = createChatStore({ sendChat: backend.sendChat, storage: null });
    const sending = store.sendMessage('No storage');
    await new Promise((resolve) => setTimeout(resolve, 0));
    backend.reply(0, 'ok');
    await sending;
    assert.equal(store.getSnapshot().state.conversations[0].messages.length, 2);
    assert.equal(store.getSnapshot().loadIssue.type, 'unavailable');
  });
});
