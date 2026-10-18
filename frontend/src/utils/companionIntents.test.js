import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { COMMAND_TARGETS, isDockVisibleOn, quickActionsFor, routeCommand } from './companionIntents.js';

describe('routeCommand: explicit open commands', () => {
  const cases = [
    ['open the whiteboard', '/whiteboard'],
    ['Open whiteboard', '/whiteboard'],
    ['open notes', '/notes'],
    ['go to the campus assistant', '/campus'],
    ['take me to my progress', '/progress'],
    ['launch the photo helper', '/camera'],
    ['open the solo study room', '/classroom'],
    ['open virtual classroom', '/classroom'],
    ['open the study planner', '/study-planner'],
    ['open the code assistant', '/code'],
    ['open learning memory', '/learning-memory'],
    ['open the quiz page', '/quiz'],
    ['switch to diagrams', '/diagrams'],
    ['navigate to the dashboard', '/dashboard']
  ];

  for (const [text, to] of cases) {
    test(`"${text}" opens ${to}`, () => {
      assert.equal(routeCommand(text)?.to, to);
    });
  }

  test('copes with greetings, politeness and punctuation', () => {
    assert.equal(routeCommand('Hey HIMI, please open the whiteboard, thanks!')?.to, '/whiteboard');
    assert.equal(routeCommand('  Could you open   my notes please?  ')?.to, '/notes');
    assert.equal(routeCommand('hi himi can you take me to the campus page.')?.to, '/campus');
  });

  test('a command followed by a question is NOT swallowed: it goes to the tutor', () => {
    assert.equal(routeCommand('open the whiteboard and explain binary trees'), null);
    assert.equal(routeCommand('open notes about deadlock and summarise them'), null);
  });

  test('questions that merely mention a page are not commands', () => {
    assert.equal(routeCommand('what is a whiteboard?'), null);
    assert.equal(routeCommand('show me the code for bubble sort'), null);
    assert.equal(routeCommand('quiz me on operating systems'), null);
    assert.equal(routeCommand('help me debug this python code'), null);
    assert.equal(routeCommand('explain this using a diagram'), null);
    assert.equal(routeCommand('help me plan for my exam'), null);
  });

  test('unknown or empty targets are not guessed', () => {
    assert.equal(routeCommand('open the pod bay doors'), null);
    assert.equal(routeCommand('open'), null);
    assert.equal(routeCommand('open the'), null);
    assert.equal(routeCommand(''), null);
    assert.equal(routeCommand(null), null);
    assert.equal(routeCommand(undefined), null);
  });

  test('every routable page is a real app route', () => {
    const routes = ['/whiteboard', '/notes', '/progress', '/campus', '/camera', '/classroom', '/learning-memory', '/profile', '/dashboard', '/chat', '/mentor', '/quiz', '/study-planner', '/diagrams', '/code'];

    assert.deepEqual([...COMMAND_TARGETS.map((target) => target.to)].sort(), [...routes].sort());
  });
});

describe('quickActionsFor', () => {
  test('carries the active subject to the pages that accept it', () => {
    const actions = quickActionsFor('/campus', { subject: 'Operating Systems', limit: 20 });

    assert.equal(actions.find((action) => action.id === 'quiz').to, '/quiz?subject=Operating+Systems');
    assert.equal(actions.find((action) => action.id === 'planner').to, '/study-planner?subject=Operating+Systems');
    assert.equal(actions.find((action) => action.id === 'diagram').to, '/diagrams?subject=Operating+Systems');
    assert.equal(actions.find((action) => action.id === 'code').to, '/code');
  });

  test('omits the query when there is no subject', () => {
    assert.equal(quickActionsFor('/campus', { limit: 20 }).find((action) => action.id === 'quiz').to, '/quiz');
  });

  test('never offers the page the student is already on', () => {
    assert.equal(quickActionsFor('/quiz', { subject: 'DBMS', limit: 20 }).some((action) => action.to?.startsWith('/quiz')), false);
    assert.equal(quickActionsFor('/notes', { limit: 20 }).some((action) => action.to === '/notes'), false);
  });

  test('is ordered for the page, with no duplicates, and respects the limit', () => {
    const planner = quickActionsFor('/study-planner', { limit: 20 }).map((action) => action.id);

    assert.deepEqual(planner.slice(0, 3), ['explain', 'quiz', 'notes']);
    assert.equal(new Set(planner).size, planner.length);
    assert.equal(quickActionsFor('/code', { limit: 3 }).length, 3);
    assert.equal(quickActionsFor('/code', { limit: 0 }).length, 0);
  });

  test('"explain" is a draft (the student finishes the question); the rest open pages', () => {
    const actions = quickActionsFor('/campus', { limit: 20 });

    assert.equal(actions.find((action) => action.id === 'explain').kind, 'draft');
    assert.ok(actions.filter((action) => action.id !== 'explain').every((action) => action.kind === 'go' && action.to.startsWith('/')));
  });

  test('covers every capability the companion advertises', () => {
    const ids = quickActionsFor('/unknown', { limit: 50 }).map((action) => action.id);

    for (const id of ['explain', 'quiz', 'planner', 'diagram', 'code', 'notes', 'whiteboard', 'campus', 'camera', 'classroom', 'progress']) {
      assert.ok(ids.includes(id), `missing ${id}`);
    }
  });
});

describe('isDockVisibleOn', () => {
  test('hides the floating companion where it would duplicate a conversation UI', () => {
    for (const path of ['/', '/login', '/chat', '/mentor', '/dashboard']) {
      assert.equal(isDockVisibleOn(path), false, path);
    }
  });

  test('shows it on the tool pages', () => {
    for (const path of ['/quiz', '/notes', '/code', '/diagrams', '/whiteboard', '/campus', '/profile']) {
      assert.equal(isDockVisibleOn(path), true, path);
    }
  });
});
