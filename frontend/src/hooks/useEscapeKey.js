import { useEffect } from 'react';

/**
 * Invoke a callback when Escape is pressed while `active` is true.
 *
 * @param {() => void} onEscape
 * @param {boolean} [active]
 */
export function useEscapeKey(onEscape, active = true) {
  useEffect(() => {
    if (!active) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onEscape();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, onEscape]);
}
