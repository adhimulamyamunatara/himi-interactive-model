import { useLayoutEffect, useRef } from 'react';

/**
 * Grow a textarea with its content up to a maximum height.
 *
 * @param {string} value Current textarea value (re-measures when it changes).
 * @param {number} [maxHeight] Maximum height in pixels before the textarea scrolls.
 * @returns {import('react').RefObject<HTMLTextAreaElement>}
 */
export function useAutoResizeTextarea(value, maxHeight = 160) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`;
  }, [value, maxHeight]);

  return ref;
}
