import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FiInfo, FiX } from 'react-icons/fi';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import WhiteboardCanvas from '../components/whiteboard/WhiteboardCanvas';
import WhiteboardToolbar from '../components/whiteboard/WhiteboardToolbar';
import { useWhiteboard } from '../hooks/useWhiteboard';
import { DEFAULT_BRUSH_SIZE, DEFAULT_COLOR, MAX_TEXT_LENGTH, buildShape } from '../utils/whiteboard';
import { downloadBoardImage } from '../utils/whiteboardExport';

const DEFAULT_TEXT_ANCHOR = [60, 60];

const SAVE_LABELS = {
  idle: 'Saved on this device as you draw.',
  saved: 'Saved on this device.',
  full: 'Not saved: this browser has no space left. Export an image to keep your drawing.',
  unavailable: 'Not saved: this browser is blocking storage. Export an image to keep your drawing.'
};

export default function Whiteboard() {
  const board = useWhiteboard();
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [size, setSize] = useState(DEFAULT_BRUSH_SIZE);
  const [textAnchor, setTextAnchor] = useState(DEFAULT_TEXT_ANCHOR);
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [problem, setProblem] = useState('');
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportRequestRef = useRef(0);

  const announce = (message) => {
    setProblem('');
    setStatus(message);
  };

  const commit = (shape) => {
    const result = board.commitShape(shape);

    if (!result.ok) {
      setStatus('');
      setProblem(result.error);
    } else {
      setProblem('');
    }

    return result.ok;
  };

  const handleUndo = () => {
    if (board.canUndo) {
      board.undo();
      announce('Undid the last change.');
    }
  };

  const handleRedo = () => {
    if (board.canRedo) {
      board.redo();
      announce('Redid the change.');
    }
  };

  const handleAddText = (event) => {
    event.preventDefault();
    const shape = buildShape({ tool: 'text', color, size, start: textAnchor, text });

    if (!shape) {
      setStatus('');
      setProblem('Type some text first.');
      return;
    }

    if (commit(shape)) {
      setText('');
      announce('Text added.');
    }
  };

  const handleExport = async () => {
    exportRequestRef.current += 1;
    const requestId = exportRequestRef.current;
    setExporting(true);
    setProblem('');

    try {
      await downloadBoardImage(board.shapes);

      if (requestId === exportRequestRef.current) {
        setStatus('Your image was prepared. Check your downloads.');
      }
    } catch (error) {
      if (requestId === exportRequestRef.current) {
        setStatus('');
        setProblem(error instanceof Error && error.message ? error.message : 'The image could not be exported.');
      }
    } finally {
      if (requestId === exportRequestRef.current) {
        setExporting(false);
      }
    }
  };

  const handleKeyDown = (event) => {
    const target = event.target;
    const typing = target instanceof HTMLElement && (target.tagName === 'TEXTAREA' || (target.tagName === 'INPUT' && target.type === 'text'));

    if (typing || !(event.ctrlKey || event.metaKey) || event.altKey) {
      return;
    }

    const key = event.key.toLowerCase();

    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      handleUndo();
    } else if ((key === 'z' && event.shiftKey) || key === 'y') {
      event.preventDefault();
      handleRedo();
    }
  };

  const confirmClear = () => {
    setConfirmingClear(false);
    board.clear();
    announce('Board cleared. You can bring it back with Undo.');
  };

  return (
    <motion.section className="section-shell py-10 lg:py-14" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="mb-8">
        <p className="eyebrow">Whiteboard</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Sketch it out</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Draw diagrams, trees and formulas while you study. Your board stays on this device and is not sent to HIMI&apos;s AI or any server.
        </p>
      </div>

      {board.notice ? (
        <div role="status" className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="flex items-start gap-2">
            <FiInfo className="mt-0.5 shrink-0" aria-hidden="true" /> {board.notice}
          </p>
          <button type="button" onClick={board.dismissNotice} className="rounded-lg p-1 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200" aria-label="Dismiss notice">
            <FiX aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {/* Shortcuts live on this wrapper so they work wherever focus is inside the tool area. */}
      <div className="grid gap-4" onKeyDown={handleKeyDown}>
        <WhiteboardToolbar
          tool={tool}
          onToolChange={setTool}
          color={color}
          onColorChange={setColor}
          size={size}
          onSizeChange={setSize}
          canUndo={board.canUndo}
          canRedo={board.canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          hasShapes={board.shapes.length > 0}
          exporting={exporting}
          onClear={() => setConfirmingClear(true)}
          onExport={handleExport}
        />

        {tool === 'text' ? (
          <form onSubmit={handleAddText} className="section-card flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:p-5">
            <div className="min-w-0 flex-1">
              <Input
                label="Text to add"
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={MAX_TEXT_LENGTH}
                placeholder="e.g. O(n log n)"
                hint="Click the board to choose where it goes, then add it."
              />
            </div>
            <Button type="submit" className="sm:mb-0.5">
              Add text
            </Button>
          </form>
        ) : null}

        <WhiteboardCanvas shapes={board.shapes} tool={tool} color={color} size={size} textAnchor={textAnchor} onCommit={commit} onPlaceText={setTextAnchor} />

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p role="status" className="min-h-5 text-slate-700">
            {status}
          </p>
          <p className="text-slate-500">{SAVE_LABELS[board.saveState]}</p>
        </div>

        {problem ? (
          <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {problem}
          </p>
        ) : null}

        <p className="text-xs leading-5 text-slate-500">
          Shortcuts: Ctrl or Cmd + Z to undo, Ctrl or Cmd + Shift + Z to redo. Pen, eraser and shapes need a mouse, pen or finger; text, undo, redo, clear and export work from the keyboard.
        </p>
      </div>

      <ConfirmDialog
        open={confirmingClear}
        title="Clear the whole board?"
        description="Everything you drew will be removed. You can still bring it back with Undo straight afterwards."
        confirmLabel="Clear board"
        onConfirm={confirmClear}
        onCancel={() => setConfirmingClear(false)}
      />
    </motion.section>
  );
}
