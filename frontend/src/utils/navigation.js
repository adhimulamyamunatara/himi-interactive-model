/**
 * Signed-in pages, in one place so the navbar, footer and dashboard stay in sync.
 * `primary` pages sit directly in the desktop nav bar; the rest live in its "More" menu.
 *
 * `label` / `footerLabel` are the English text (also the fallback); `labelKey` / `footerKey` are the
 * translation keys the UI actually renders through `t()`.
 */
export const MEMBER_PAGES = [
  { to: '/dashboard', label: 'Dashboard', labelKey: 'nav.dashboard', primary: true },
  { to: '/chat', label: 'Chat', labelKey: 'nav.chat', primary: true },
  { to: '/mentor', label: 'Mentor', labelKey: 'nav.mentor', primary: true },
  { to: '/quiz', label: 'Quiz', labelKey: 'nav.quiz', primary: true },
  { to: '/study-planner', label: 'Planner', labelKey: 'nav.planner', footerLabel: 'Study Planner', footerKey: 'nav.plannerFull', primary: true },
  { to: '/notes', label: 'Notes', labelKey: 'nav.notes', primary: true },
  { to: '/progress', label: 'Progress', labelKey: 'nav.progress', primary: true },
  { to: '/whiteboard', label: 'Whiteboard', labelKey: 'nav.whiteboard', primary: false },
  { to: '/code', label: 'Code', labelKey: 'nav.code', footerLabel: 'Code Assistant', footerKey: 'nav.codeFull', primary: false },
  { to: '/diagrams', label: 'Diagrams', labelKey: 'nav.diagrams', primary: false },
  { to: '/camera', label: 'Camera', labelKey: 'nav.camera', footerLabel: 'Photo Helper', footerKey: 'nav.cameraFull', primary: false },
  { to: '/learning-memory', label: 'Memory', labelKey: 'nav.memory', footerLabel: 'Learning Memory', footerKey: 'nav.memoryFull', primary: false },
  { to: '/profile', label: 'Profile', labelKey: 'nav.profile', primary: false }
];

export const PUBLIC_PAGES = [{ to: '/', label: 'Home', labelKey: 'nav.home' }];

/** Translated label for a page entry. */
export const pageLabel = (page, t, { footer = false } = {}) => t(footer ? page.footerKey ?? page.labelKey : page.labelKey);
