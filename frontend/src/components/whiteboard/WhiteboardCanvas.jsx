import { useCallback, useEffect, useRef } from 'react';
import { chartColors } from '../../styles/tokens';
import { BOARD_HEIGHT, BOARD_WIDTH, appendPoint, buildShape, toLogicalPoint } from '../../utils/whiteboard';
import { drawBoard, drawShape } from '../../utils/whiteboardRender';

const MAX_PIXEL_RATIO = 2;
const DRAG_TOOLS = ['line', 'rect', 'ellipse'];

function prepare(canvas) {
  const ratio = Math.min(MAX_PIXEL_RATIO, window.devicePixelRatio || 1);
  canvas.width = Math.round(BOARD_WIDTH * ratio);
  canvas.height = Math.round(BOARD_HEIGHT * ratio);
  const context = canvas.getContext('2d');
  context?.setTransform(ratio, 0, 0, ratio, 0, 0);
  return context;
}

/**
 * The drawing surface: a committed layer (redrawn only when the shapes change) under a draft layer (the stroke
 * being drawn). The board has a fixed logical size and is scaled by CSS, so it keeps its shape on every screen
 * and nothing needs redrawing when the window is resized. Pointer events cover mouse, pen and touch; only the
 * first pointer draws, so a second finger or an interrupted touch cannot leave a half-finished shape behind.
 */
export default function WhiteboardCanvas({ shapes, tool, color, size, textAnchor, onCommit, onPlaceText }) {
  const baseRef = useRef(null);
  const overlayRef = useRef(null);
  const baseContextRef = useRef(null);
  const draftRef = useRef(null);
  const frameRef = useRef(0);
  const propsRef = useRef({ tool, color, size, textAnchor });

  useEffect(() => {
    propsRef.current = { tool, color, size, textAnchor };
  });

  const paintOverlay = useCallback(() => {
    frameRef.current = 0;
    const context = overlayRef.current?.getContext('2d');

    if (!context) {
      return;
    }

    context.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    const draft = draftRef.current;
    const { textAnchor: anchor, color: currentColor, size: currentSize } = propsRef.current;

    if (draft) {
      const shape = buildShape({ tool: draft.tool, color: currentColor, size: currentSize, points: draft.points, start: draft.start, end: draft.end });

      if (shape) {
        drawShape(context, shape);
      }
    } else if (propsRef.current.tool === 'text' && anchor) {
      // A small marker shows where the next piece of text will go.
      context.strokeStyle = chartColors.line;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(anchor[0] - 10, anchor[1]);
      context.lineTo(anchor[0] + 10, anchor[1]);
      context.moveTo(anchor[0], anchor[1] - 10);
      context.lineTo(anchor[0], anchor[1] + 10);
      context.stroke();
    }
  }, []);

  const schedulePaint = useCallback(() => {
    if (!frameRef.current) {
      frameRef.current = requestAnimationFrame(paintOverlay);
    }
  }, [paintOverlay]);

  // Size the backing stores once. Changing canvas.width reallocates the bitmap, so it is not done per stroke.
  useEffect(() => {
    if (baseRef.current) {
      baseContextRef.current = prepare(baseRef.current);
    }

    if (overlayRef.current) {
      prepare(overlayRef.current);
    }
  }, []);

  useEffect(() => {
    if (baseContextRef.current) {
      drawBoard(baseContextRef.current, shapes);
    }
  }, [shapes]);

  useEffect(() => {
    // The text marker follows the selected tool and position; a tool change also drops any unfinished drag.
    draftRef.current = null;
    schedulePaint();
  }, [tool, textAnchor, schedulePaint]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frameRef.current);
      draftRef.current = null;
    },
    []
  );

  const pointFromEvent = (event) => toLogicalPoint(event.clientX, event.clientY, overlayRef.current.getBoundingClientRect());

  const handlePointerDown = (event) => {
    if (draftRef.current || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }

    const point = pointFromEvent(event);

    if (!point) {
      return;
    }

    if (tool === 'text') {
      onPlaceText(point);
      return;
    }

    event.currentTarget.setPointerCapture?.(event.pointerId);
    draftRef.current = { pointerId: event.pointerId, tool, points: [point], start: point, end: point };
    schedulePaint();
  };

  const handlePointerMove = (event) => {
    const draft = draftRef.current;

    if (!draft || draft.pointerId !== event.pointerId) {
      return;
    }

    const point = pointFromEvent(event);

    if (!point) {
      return;
    }

    if (DRAG_TOOLS.includes(draft.tool)) {
      draft.end = point;
    } else {
      draft.points = appendPoint(draft.points, point);
    }

    schedulePaint();
  };

  const finish = (event, { commit }) => {
    const draft = draftRef.current;

    if (!draft || draft.pointerId !== event.pointerId) {
      return;
    }

    draftRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    if (commit) {
      const point = pointFromEvent(event);
      const end = point ?? draft.end;
      const points = DRAG_TOOLS.includes(draft.tool) ? draft.points : appendPoint(draft.points, end);
      const shape = buildShape({ tool: draft.tool, color, size, points, start: draft.start, end });

      if (shape) {
        onCommit(shape);
      }
    }

    schedulePaint();
  };

  return (
    <div className="relative w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card" style={{ aspectRatio: `${BOARD_WIDTH} / ${BOARD_HEIGHT}` }}>
      <canvas ref={baseRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
      <canvas
        ref={overlayRef}
        role="img"
        tabIndex={0}
        aria-label={`Drawing board with ${shapes.length} ${shapes.length === 1 ? 'item' : 'items'}. Drawing needs a mouse, pen or touch. Use the buttons above to add text, undo, redo, clear or export.`}
        data-testid="whiteboard-canvas"
        data-shape-count={shapes.length}
        className="absolute inset-0 h-full w-full cursor-crosshair touch-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-blue-300"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => finish(event, { commit: true })}
        onPointerCancel={(event) => finish(event, { commit: false })}
      />
    </div>
  );
}
