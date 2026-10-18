/**
 * Signed-in pages, in one place so the navbar, footer and dashboard stay in sync.
 * `primary` pages sit directly in the desktop nav bar; the rest live in its "More" menu.
 */
export const MEMBER_PAGES = [
  { to: '/dashboard', label: 'Dashboard', primary: true },
  { to: '/chat', label: 'Chat', primary: true },
  { to: '/quiz', label: 'Quiz', primary: true },
  { to: '/study-planner', label: 'Planner', footerLabel: 'Study Planner', primary: true },
  { to: '/notes', label: 'Notes', primary: true },
  { to: '/progress', label: 'Progress', primary: true },
  { to: '/learning-memory', label: 'Memory', footerLabel: 'Learning Memory', primary: false },
  { to: '/profile', label: 'Profile', primary: false }
];

export const PUBLIC_PAGES = [{ to: '/', label: 'Home' }];
