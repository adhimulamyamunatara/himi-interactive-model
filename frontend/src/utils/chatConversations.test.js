import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAX_CONVERSATIONS,
  MAX_MANUAL_TITLE_LENGTH,
  MAX_TITLE_LENGTH,
  appendMessage,
  canCreateConversation,
  clearConversationMessages,
  createConversationWithMessage,
  createInitialState,
  deleteConversation,
  findConversation,
  generateTitle,
  getActiveConversation,
  getActiveMessages,
  getAllMessages,
  getRecentConversations,
  getSelectedSubject,
  removeMessage,
  renameConversation,
  sanitizeTitle,
  selectConversation,
  setSubject,
  startDraft,
  updateMessage
} from './chatConversations.js';

let counter = 0;
const msg = (role, content, extra = {}) => {
  counter += 1;
  return {
    id: `m${counter}`,
    role,
    content,
    timestamp: new Date(Date.UTC(2026, 9, 18, 10, 0, counter)).toISOString(),
    subject: 'DBMS',
    ...extra
  };
};
const at = (minute) => new Date(Date.UTC(2026, 9, 18, 12, minute)).toISOString();

function withTwoConversations() {
  let state = createInitialState();
  state = createConversationWithMessage(state, { id: 'a', subject: 'DBMS', message: msg('user', 'Explain DBMS normalization'), now: at(1) });
  state = createConversationWithMessage(state, { id: 'b', subject: 'Python', message: msg('user', 'What is a decorator?'), now: at(2) });
  return state;
}

describe('generateTitle', () => {
  it('drops conversational openers', () => {
    assert.equal(generateTitle('Explain DBMS normalization'), 'DBMS normalization');
    assert.equal(generateTitle('What is TCP?'), 'TCP');
    assert.equal(generateTitle('Can you please explain the difference between TCP and UDP?'), 'Difference between TCP and UDP');
    assert.equal(generateTitle('Hi, can you explain deadlock'), 'Deadlock');
  });

  it('keeps questions that need their wording', () => {
    assert.equal(generateTitle('How does a hash map handle collisions?'), 'How does a hash map handle collisions');
  });

  it('collapses whitespace and control characters', () => {
    assert.equal(generateTitle('  Explain \n\t  binary    search  '), 'Binary search');
    assert.equal(generateTitle('abc\u0007def'), 'Abc def');
  });

  it('handles very short and empty messages', () => {
    assert.equal(generateTitle('hi'), 'Hi');
    assert.equal(generateTitle('?'), 'New chat');
    assert.equal(generateTitle('', 'DBMS'), 'DBMS chat');
    assert.equal(generateTitle('   ', undefined), 'New chat');
    assert.equal(generateTitle(undefined, 'Java'), 'Java chat');
    assert.equal(generateTitle('Explain', 'Java'), 'Explain');
  });

  it('never returns an empty title', () => {
    for (const input of ['', ' ', '???', '```js\nconsole.log(1)\n```', '***', null, undefined, 42]) {
      assert.ok(generateTitle(input, 'DBMS').length > 0, JSON.stringify(input));
    }
  });

  it('ignores code blocks and markdown markers', () => {
    assert.equal(generateTitle('```python\nprint(1)\n``` why does this print 1'), 'Why does this print 1');
    assert.equal(generateTitle('## **Explain** paging'), 'Paging');
  });

  it('limits the length and prefers word boundaries', () => {
    const long = `Explain ${'concurrency control in distributed databases '.repeat(5)}`;
    const title = generateTitle(long);
    assert.ok(title.length <= MAX_TITLE_LENGTH, `${title.length}`);
    assert.ok(title.endsWith('…'));
    assert.ok(!title.includes('  '));
    assert.equal(generateTitle('x'.repeat(200)).length, MAX_TITLE_LENGTH);
  });

  it('keeps markup as plain text (it is rendered by React as text)', () => {
    assert.equal(generateTitle('<img src=x onerror=alert(1)> explain ACID'), '<img src=x onerror=alert(1)> explain ACID');
  });
});

describe('sanitizeTitle', () => {
  it('trims, collapses and limits manual titles', () => {
    assert.equal(sanitizeTitle('  My   notes \n '), 'My notes');
    assert.equal(sanitizeTitle('x'.repeat(300)).length, MAX_MANUAL_TITLE_LENGTH);
  });

  it('returns an empty string for unusable input', () => {
    for (const input of ['', '   ', '\n\t', null, undefined, 5, {}]) assert.equal(sanitizeTitle(input), '');
  });
});

describe('creating conversations', () => {
  it('starts empty with a draft and a valid subject', () => {
    const state = createInitialState();
    assert.deepEqual(state.conversations, []);
    assert.equal(state.activeConversationId, null);
    assert.equal(getSelectedSubject(state), 'Operating Systems');
    assert.equal(createInitialState('Nonsense').draftSubject, 'Operating Systems');
    assert.equal(createInitialState('Java').draftSubject, 'Java');
    assert.deepEqual(getActiveMessages(state), []);
  });

  it('creates a conversation with its first message and opens it', () => {
    const state = createConversationWithMessage(createInitialState(), {
      id: 'a',
      subject: 'DBMS',
      message: msg('user', 'Explain DBMS normalization'),
      now: at(1)
    });
    const conversation = getActiveConversation(state);
    assert.equal(conversation.id, 'a');
    assert.equal(conversation.title, 'DBMS normalization');
    assert.equal(conversation.titleSource, 'auto');
    assert.equal(conversation.subject, 'DBMS');
    assert.equal(conversation.createdAt, at(1));
    assert.equal(conversation.messages.length, 1);
  });

  it('puts the newest conversation first and keeps ids unique', () => {
    const state = withTwoConversations();
    assert.deepEqual(state.conversations.map((c) => c.id), ['b', 'a']);
    const again = createConversationWithMessage(state, { id: 'a', subject: 'DBMS', message: msg('user', 'dup'), now: at(5) });
    assert.equal(again, state);
  });

  it('reports when the conversation limit is reached', () => {
    let state = createInitialState();
    for (let i = 0; i < MAX_CONVERSATIONS; i += 1) {
      state = createConversationWithMessage(state, { id: `c${i}`, subject: 'DBMS', message: msg('user', `q${i}`), now: at(i % 60) });
    }
    assert.equal(canCreateConversation(state), false);
    assert.equal(canCreateConversation(withTwoConversations()), true);
  });
});

describe('selecting and drafts', () => {
  it('selects only existing conversations', () => {
    const state = withTwoConversations();
    assert.equal(selectConversation(state, 'a').activeConversationId, 'a');
    assert.equal(selectConversation(state, 'missing'), state);
    assert.equal(selectConversation(state, state.activeConversationId), state);
  });

  it('switching shows only that conversation\'s messages', () => {
    const state = withTwoConversations();
    assert.deepEqual(getActiveMessages(selectConversation(state, 'a')).map((m) => m.content), ['Explain DBMS normalization']);
    assert.deepEqual(getActiveMessages(selectConversation(state, 'b')).map((m) => m.content), ['What is a decorator?']);
  });

  it('a new chat is a blank draft that keeps the previous subject by default', () => {
    const state = startDraft(withTwoConversations());
    assert.equal(state.activeConversationId, null);
    assert.equal(state.draftSubject, 'Python');
    assert.deepEqual(getActiveMessages(state), []);
    assert.equal(state.conversations.length, 2, 'no empty conversation is created');
    assert.equal(startDraft(state), state, 'repeating New chat is a no-op');
  });

  it('a new chat can start with a chosen subject', () => {
    assert.equal(startDraft(withTwoConversations(), 'Java').draftSubject, 'Java');
    assert.equal(startDraft(withTwoConversations(), 'Nonsense').draftSubject, 'Python');
  });
});

describe('independent subjects', () => {
  it('each conversation keeps its own subject', () => {
    let state = withTwoConversations();
    state = setSubject(selectConversation(state, 'a'), 'Algorithms');
    assert.equal(findConversation(state, 'a').subject, 'Algorithms');
    assert.equal(findConversation(state, 'b').subject, 'Python');
    assert.equal(getSelectedSubject(selectConversation(state, 'b')), 'Python');
  });

  it('changing the subject of a draft does not touch any conversation', () => {
    const base = startDraft(withTwoConversations());
    const state = setSubject(base, 'Java');
    assert.equal(state.draftSubject, 'Java');
    assert.equal(state.conversations, base.conversations);
  });

  it('ignores unknown subjects', () => {
    const state = withTwoConversations();
    assert.equal(setSubject(state, 'Astrology'), state);
  });
});

describe('message ownership', () => {
  it('appends to the owning conversation only', () => {
    const state = withTwoConversations();
    const next = appendMessage(state, 'a', msg('assistant', 'Normalization removes redundancy.'), at(10));
    assert.equal(findConversation(next, 'a').messages.length, 2);
    assert.equal(findConversation(next, 'b'), state.conversations.find((c) => c.id === 'b'), 'b is the very same object');
  });

  it('keeps untouched conversations by identity (no mutation)', () => {
    const state = withTwoConversations();
    const snapshot = JSON.stringify(state);
    appendMessage(state, 'a', msg('assistant', 'x'), at(10));
    updateMessage(state, 'a', state.conversations[1].messages[0].id, { content: 'changed' });
    renameConversation(state, 'a', 'Renamed');
    deleteConversation(state, 'a');
    clearConversationMessages(state, 'a');
    assert.equal(JSON.stringify(state), snapshot);
  });

  it('drops a message for a conversation that does not exist (late reply after delete)', () => {
    const state = deleteConversation(withTwoConversations(), 'a');
    const next = appendMessage(state, 'a', msg('assistant', 'late reply'), at(20));
    assert.equal(next, state);
    assert.equal(findConversation(next, 'a'), null);
  });

  it('moves the conversation with new activity to the top', () => {
    const state = withTwoConversations();
    const next = appendMessage(state, 'a', msg('assistant', 'reply'), at(30));
    assert.deepEqual(next.conversations.map((c) => c.id), ['a', 'b']);
    assert.equal(findConversation(next, 'a').updatedAt, at(30));
  });

  it('keeps the order stable when nothing happens', () => {
    const state = withTwoConversations();
    assert.equal(appendMessage(state, 'b', msg('assistant', 'x'), at(40)).conversations[0].id, 'b');
  });

  it('updates and removes a message by id', () => {
    const state = withTwoConversations();
    const target = findConversation(state, 'a').messages[0];
    const updated = updateMessage(state, 'a', target.id, { error: true, id: 'hacked' });
    assert.equal(findConversation(updated, 'a').messages[0].error, true);
    assert.equal(findConversation(updated, 'a').messages[0].id, target.id, 'id cannot be changed');
    assert.equal(updateMessage(state, 'a', 'nope', { error: true }), state);
    assert.equal(findConversation(removeMessage(state, 'a', target.id), 'a').messages.length, 0);
    assert.equal(removeMessage(state, 'a', 'nope'), state);
  });
});

describe('titles over time', () => {
  it('is set from the first user message and not regenerated afterwards', () => {
    let state = createConversationWithMessage(createInitialState(), { id: 'a', subject: 'DBMS', message: msg('user', 'Explain ACID'), now: at(1) });
    state = appendMessage(state, 'a', msg('assistant', 'ACID is...'), at(2));
    state = appendMessage(state, 'a', msg('user', 'Now explain indexing'), at(3));
    assert.equal(findConversation(state, 'a').title, 'ACID');
  });

  it('regenerates an automatic title only when the conversation is empty again', () => {
    let state = createConversationWithMessage(createInitialState(), { id: 'a', subject: 'DBMS', message: msg('user', 'Explain ACID'), now: at(1) });
    state = clearConversationMessages(state, 'a');
    assert.equal(findConversation(state, 'a').title, 'ACID', 'clearing keeps the title');
    state = appendMessage(state, 'a', msg('user', 'Explain indexing'), at(5));
    assert.equal(findConversation(state, 'a').title, 'Indexing');
  });

  it('preserves a manual title', () => {
    let state = withTwoConversations();
    state = renameConversation(state, 'a', '  Exam   prep  ');
    assert.equal(findConversation(state, 'a').title, 'Exam prep');
    assert.equal(findConversation(state, 'a').titleSource, 'manual');
    state = appendMessage(state, 'a', msg('user', 'Something else'), at(9));
    assert.equal(findConversation(state, 'a').title, 'Exam prep');
    state = clearConversationMessages(state, 'a');
    state = appendMessage(state, 'a', msg('user', 'Brand new topic'), at(10));
    assert.equal(findConversation(state, 'a').title, 'Exam prep');
  });
});

describe('renaming', () => {
  it('rejects empty titles and unknown ids', () => {
    const state = withTwoConversations();
    assert.equal(renameConversation(state, 'a', '   '), state);
    assert.equal(renameConversation(state, 'a', null), state);
    assert.equal(renameConversation(state, 'zzz', 'Title'), state);
  });

  it('does not change the activity order', () => {
    const state = renameConversation(withTwoConversations(), 'a', 'Renamed');
    assert.deepEqual(state.conversations.map((c) => c.id), ['b', 'a']);
  });

  it('stores titles as text (no HTML interpretation happens in state)', () => {
    const state = renameConversation(withTwoConversations(), 'a', '<script>alert(1)</script>');
    assert.equal(findConversation(state, 'a').title, '<script>alert(1)</script>');
  });
});

describe('deleting and clearing', () => {
  it('deletes only the target and leaves the rest intact', () => {
    const state = deleteConversation(withTwoConversations(), 'a');
    assert.deepEqual(state.conversations.map((c) => c.id), ['b']);
    assert.equal(findConversation(state, 'b').messages.length, 1);
    assert.equal(deleteConversation(state, 'a'), state);
  });

  it('falls back to a blank draft (not another chat) when the open one is deleted', () => {
    const open = selectConversation(withTwoConversations(), 'a');
    const state = deleteConversation(open, 'a');
    assert.equal(state.activeConversationId, null);
    assert.equal(state.draftSubject, 'DBMS');
    assert.deepEqual(getActiveMessages(state), []);
  });

  it('keeps the open conversation when another one is deleted', () => {
    const state = deleteConversation(selectConversation(withTwoConversations(), 'a'), 'b');
    assert.equal(state.activeConversationId, 'a');
  });

  it('handles deleting the last conversation', () => {
    const state = deleteConversation(deleteConversation(withTwoConversations(), 'a'), 'b');
    assert.deepEqual(state.conversations, []);
    assert.deepEqual(getAllMessages(state), []);
  });

  it('clearing empties only the target and keeps its record and title', () => {
    const state = clearConversationMessages(withTwoConversations(), 'a');
    assert.equal(findConversation(state, 'a').messages.length, 0);
    assert.equal(findConversation(state, 'a').title, 'DBMS normalization');
    assert.equal(findConversation(state, 'b').messages.length, 1);
    assert.equal(state.conversations.length, 2);
    assert.equal(clearConversationMessages(state, 'a'), state, 'already empty');
    assert.equal(clearConversationMessages(state, 'zzz'), state);
  });
});

describe('derived views', () => {
  it('aggregates messages across conversations in time order', () => {
    const state = withTwoConversations();
    const contents = getAllMessages(state).map((m) => m.content);
    assert.equal(contents.length, 2);
    assert.ok(contents.includes('What is a decorator?') && contents.includes('Explain DBMS normalization'));
  });

  it('lists recent conversations that have messages', () => {
    const cleared = clearConversationMessages(withTwoConversations(), 'b');
    assert.deepEqual(getRecentConversations(cleared).map((c) => c.id), ['a']);
    assert.equal(getRecentConversations(withTwoConversations(), 1).length, 1);
  });
});
