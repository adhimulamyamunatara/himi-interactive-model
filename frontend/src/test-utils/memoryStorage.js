/** Minimal in-memory `Storage` for tests (not bundled: nothing in the app imports it). */
export function createMemoryStorage(initial = {}, { failWrites = false } = {}) {
  const data = new Map(Object.entries(initial));

  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => {
      if (failWrites) {
        throw new Error('QuotaExceededError');
      }
      data.set(key, String(value));
    },
    removeItem: (key) => {
      data.delete(key);
    }
  };
}
