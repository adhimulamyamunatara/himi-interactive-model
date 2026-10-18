import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { addShape, canAddShape, canRedo, canUndo, clearBoard, createBoard, redo, undo } from '../utils/whiteboard';
import { loadWhiteboard, saveWhiteboard } from '../utils/whiteboardStorage';

const SAVE_DELAY_MS = 500;

function reducer(board, action) {
  switch (action.type) {
    case 'add':
      return addShape(board, action.shape);
    case 'undo':
      return undo(board);
    case 'redo':
      return redo(board);
    case 'clear':
      return clearBoard(board);
    default:
      return board;
  }
}

const LOAD_NOTICES = {
  unreadable: 'Your saved whiteboard could not be read, so a blank board was started. The old data was kept aside in this browser.',
  partial: 'Some parts of your saved whiteboard were damaged and were skipped.',
  unavailable: 'This browser is not allowing HIMI to save your whiteboard, so it will be lost when you leave the page.'
};

/**
 * Whiteboard state with undo/redo and debounced local saving.
 * Saving is skipped when nothing changed, flushed when the student leaves the page, and never blocks drawing:
 * if the browser refuses the write the board stays usable and `saveState` says so.
 */
export function useWhiteboard() {
  const [initial] = useState(() => loadWhiteboard());
  const [board, dispatch] = useReducer(reducer, initial.shapes, createBoard);
  const [saveState, setSaveState] = useState(initial.issue === 'unavailable' ? 'unavailable' : 'idle');
  const [notice, setNotice] = useState(LOAD_NOTICES[initial.issue] ?? '');
  const presentRef = useRef(board.present);
  const savedRef = useRef(initial.shapes);
  const timerRef = useRef(null);

  const flush = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = null;

    if (presentRef.current === savedRef.current) {
      return;
    }

    const result = saveWhiteboard(presentRef.current);

    if (result.ok) {
      savedRef.current = presentRef.current;
      setSaveState('saved');
    } else {
      setSaveState(result.reason === 'full' ? 'full' : 'unavailable');
    }
  }, []);

  useEffect(() => {
    presentRef.current = board.present;

    if (board.present === savedRef.current) {
      return undefined;
    }

    timerRef.current = setTimeout(flush, SAVE_DELAY_MS);

    return () => clearTimeout(timerRef.current);
  }, [board.present, flush]);

  useEffect(() => {
    const handlePageHide = () => flush();
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      flush();
    };
  }, [flush]);

  /** @returns {{ ok: true } | { ok: false, error: string }} */
  const commitShape = useCallback((shape) => {
    const check = canAddShape(presentRef.current, shape);

    if (check.ok) {
      dispatch({ type: 'add', shape });
    }

    return check;
  }, []);

  return {
    shapes: board.present,
    canUndo: canUndo(board),
    canRedo: canRedo(board),
    saveState,
    notice,
    dismissNotice: useCallback(() => setNotice(''), []),
    commitShape,
    undo: useCallback(() => dispatch({ type: 'undo' }), []),
    redo: useCallback(() => dispatch({ type: 'redo' }), []),
    clear: useCallback(() => dispatch({ type: 'clear' }), [])
  };
}
