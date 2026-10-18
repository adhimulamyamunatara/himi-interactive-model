/**
 * What the student can ask HIMI to *do*, as opposed to explain.
 *
 * Two deliberately small pieces:
 *
 *  - `routeCommand`: an explicit "open the whiteboard" style command is recognised locally and opens that page.
 *    It only matches when the whole message is the command, so "open the whiteboard and explain trees" is
 *    never swallowed; it goes to the tutor like any other question. Opening a page is all it does: it never
 *    starts the camera, uploads a file or submits a form.
 *  - `quickActionsFor`: the shortcuts shown in the companion, ordered for the page the student is on.
 *
 * Everything else (quizzes, study plans, code help, diagrams, explanations) is decided by the real tutor
 * backend, which answers or hands the student to the right tool. Nothing here pretends to answer.
 * No browser APIs are touched, so it is all unit tested.
 */

/** Every page the companion can open by name. `phrases` are matched against the whole target text. */
const TARGETS = [
  { id: 'whiteboard', to: '/whiteboard', phrases: ['whiteboard', 'white board', 'drawing board', 'board'] },
  { id: 'notes', to: '/notes', phrases: ['notes', 'my notes', 'pdf notes', 'pdf', 'notes summarizer', 'notes summariser', 'summarizer', 'summariser'] },
  { id: 'progress', to: '/progress', phrases: ['progress', 'my progress', 'analytics', 'revision tracker', 'revision', 'revision tracking'] },
  { id: 'campus', to: '/campus', phrases: ['campus', 'campus assistant', 'college assistant'] },
  { id: 'camera', to: '/camera', phrases: ['camera', 'photo helper', 'photo', 'photo assistant'] },
  { id: 'classroom', to: '/classroom', phrases: ['classroom', 'virtual classroom', 'study room', 'solo study room', 'solo classroom'] },
  { id: 'memory', to: '/learning-memory', phrases: ['learning memory', 'memory', 'my memory'] },
  { id: 'profile', to: '/profile', phrases: ['profile', 'settings', 'my profile', 'preferences'] },
  { id: 'dashboard', to: '/dashboard', phrases: ['dashboard', 'home'] },
  { id: 'chat', to: '/chat', phrases: ['chat', 'chats', 'my chats'] },
  { id: 'mentor', to: '/mentor', phrases: ['mentor', 'ai mentor'] },
  { id: 'quiz', to: '/quiz', phrases: ['quiz', 'quizzes'] },
  { id: 'planner', to: '/study-planner', phrases: ['planner', 'study planner', 'study plan', 'plan'] },
  { id: 'diagrams', to: '/diagrams', phrases: ['diagrams', 'diagram', 'diagram maker', 'diagram tool'] },
  { id: 'code', to: '/code', phrases: ['code', 'code assistant', 'coding assistant', 'code helper', 'code help'] }
];

// Only clear "go there" verbs. "show me ..." is left out on purpose: "show me the code for bubble sort" is a question.
const VERBS = ['open', 'go to', 'take me to', 'launch', 'start', 'switch to', 'navigate to'];

// "hey himi, please open the whiteboard page, thanks" -> "whiteboard"
const LEAD_IN = /^(?:(?:hey|hi|hello|ok|okay)[\s,]+)?(?:himi[\s,]+)?(?:please[\s,]+)?(?:can you[\s,]+|could you[\s,]+)?/;
const TRAIL = /(?:[\s,]+(?:please|thanks|thank you))?[\s.!?]*$/;
const FILLER = /^(?:the|my|a|an)\s+/;
const SUFFIX = /\s+(?:page|tool|screen|section|feature)$/;

const normalise = (value) => String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * @param {string} message what the student typed or dictated
 * @returns {{target: string, to: string} | null} a page to open, or null when this is not a plain open command
 */
export function routeCommand(message) {
  let rest = normalise(message);

  rest = rest.replace(LEAD_IN, '').replace(TRAIL, '').trim();

  const verb = VERBS.find((candidate) => rest === candidate || rest.startsWith(`${candidate} `));

  if (!verb) {
    return null;
  }

  rest = rest.slice(verb.length).trim().replace(FILLER, '').replace(SUFFIX, '').trim();

  if (!rest) {
    return null;
  }

  const matches = TARGETS.filter((target) => target.phrases.includes(rest));

  // Exactly one page must match: an unknown or ambiguous name is left to the tutor, which can ask what is meant.
  return matches.length === 1 ? { target: matches[0].id, to: matches[0].to } : null;
}

/** Page ids the companion can name, for labels. */
export const COMMAND_TARGETS = Object.freeze(TARGETS.map(({ id, to }) => ({ id, to })));

/* ------------------------------------------------------------- quick actions */

const query = (params) => {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }

  const serialised = search.toString();
  return serialised ? `?${serialised}` : '';
};

/**
 * One shortcut per capability. `ask` shortcuts put the start of a question into the message box (the student
 * finishes and sends it); `go` shortcuts open the page, carrying the active subject where the page accepts it.
 */
function buildAction(id, subject) {
  switch (id) {
    case 'explain':
      return { id, kind: 'draft' };
    case 'quiz':
      return { id, kind: 'go', to: `/quiz${query({ subject })}` };
    case 'planner':
      return { id, kind: 'go', to: `/study-planner${query({ subject })}` };
    case 'diagram':
      return { id, kind: 'go', to: `/diagrams${query({ subject })}` };
    case 'code':
      return { id, kind: 'go', to: '/code' };
    case 'notes':
      return { id, kind: 'go', to: '/notes' };
    case 'whiteboard':
      return { id, kind: 'go', to: '/whiteboard' };
    case 'campus':
      return { id, kind: 'go', to: '/campus' };
    case 'camera':
      return { id, kind: 'go', to: '/camera' };
    case 'classroom':
      return { id, kind: 'go', to: '/classroom' };
    case 'progress':
      return { id, kind: 'go', to: '/progress' };
    default:
      return null;
  }
}

const DEFAULT_ORDER = ['explain', 'quiz', 'planner', 'diagram', 'code', 'notes', 'whiteboard', 'campus', 'camera', 'classroom', 'progress'];

/** Page-specific order: what is most useful next from where the student is. */
const CONTEXT_ORDER = {
  '/quiz': ['explain', 'planner', 'notes', 'diagram', 'progress'],
  '/study-planner': ['explain', 'quiz', 'notes', 'progress'],
  '/notes': ['explain', 'quiz', 'diagram', 'planner'],
  '/code': ['explain', 'diagram', 'quiz', 'whiteboard'],
  '/diagrams': ['explain', 'quiz', 'whiteboard', 'notes'],
  '/whiteboard': ['explain', 'diagram', 'quiz'],
  '/campus': ['explain', 'planner', 'classroom'],
  '/camera': ['explain', 'notes', 'code'],
  '/classroom': ['explain', 'quiz', 'notes', 'planner'],
  '/progress': ['quiz', 'planner', 'explain', 'notes'],
  '/learning-memory': ['planner', 'quiz', 'explain']
};

/**
 * @param {string} pathname current route
 * @param {{subject?: string, limit?: number}} [options]
 * @returns {Array<{id: string, kind: 'draft' | 'go', to?: string}>}
 */
export function quickActionsFor(pathname, { subject = '', limit = 6 } = {}) {
  const order = CONTEXT_ORDER[pathname] ?? DEFAULT_ORDER;
  const seen = new Set();
  const ids = [...order, ...DEFAULT_ORDER].filter((id) => !seen.has(id) && seen.add(id));

  return ids
    .map((id) => buildAction(id, subject))
    // A shortcut that opens the page the student is already on is noise.
    .filter((action) => action && !(action.kind === 'go' && action.to.split('?')[0] === pathname))
    .slice(0, Math.max(0, limit));
}

/** Routes where the floating companion would duplicate a conversation UI, so it stays out of the way. */
const DOCK_HIDDEN = new Set(['/', '/login', '/chat', '/mentor', '/dashboard']);

export const isDockVisibleOn = (pathname) => !DOCK_HIDDEN.has(pathname);
