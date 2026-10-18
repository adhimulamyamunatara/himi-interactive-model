const QUOTES = [
  { text: 'The expert in anything was once a beginner.', author: 'Helen Hayes' },
  { text: 'Learning never exhausts the mind.', author: 'Leonardo da Vinci' },
  { text: 'Programs must be written for people to read, and only incidentally for machines to execute.', author: 'Harold Abelson' },
  { text: 'First, solve the problem. Then, write the code.', author: 'John Johnson' },
  { text: 'Small daily improvements are the key to staggering long-term results.', author: 'Robin Sharma' },
  { text: 'Simplicity is prerequisite for reliability.', author: 'Edsger W. Dijkstra' },
  { text: 'An investment in knowledge pays the best interest.', author: 'Benjamin Franklin' }
];

/**
 * Time-of-day greeting.
 *
 * @param {string} name
 * @returns {string}
 */
export function formatGreeting(name) {
  const hour = new Date().getHours();

  if (hour < 12) {
    return `Good morning, ${name}`;
  }

  if (hour < 18) {
    return `Good afternoon, ${name}`;
  }

  return `Good evening, ${name}`;
}

/**
 * Long, human readable date, e.g. "Sunday, October 18, 2026".
 *
 * @param {Date} [date]
 * @returns {string}
 */
export function formatLongDate(date = new Date()) {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Short clock time for chat timestamps.
 *
 * @param {string} isoTimestamp
 * @returns {string}
 */
export function formatTime(isoTimestamp) {
  const date = new Date(isoTimestamp);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Relative time such as "just now", "5 min ago" or "2 d ago".
 *
 * @param {string} isoTimestamp
 * @returns {string}
 */
export function formatRelativeTime(isoTimestamp) {
  const date = new Date(isoTimestamp);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));

  if (seconds < 45) {
    return 'just now';
  }

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours} h ago`;
  }

  const days = Math.round(hours / 24);

  if (days < 7) {
    return `${days} d ago`;
  }

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Deterministic quote of the day so it does not change on every render.
 *
 * @param {Date} [date]
 * @returns {{text: string, author: string}}
 */
export function getDailyQuote(date = new Date()) {
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86_400_000);
  return QUOTES[dayOfYear % QUOTES.length];
}

/**
 * Up to two initials for avatar placeholders.
 *
 * @param {string} [name]
 * @returns {string}
 */
export function getInitials(name = '') {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return initials || 'H';
}
