/**
 * Whiteboard model: the drawing is a list of small vector shapes (not pixels), which keeps undo/redo exact,
 * keeps storage tiny and lets the board look sharp at any size. Pure and framework-free so it can be tested.
 *
 * Shapes (all coordinates are in the fixed logical board space, BOARD_WIDTH x BOARD_HEIGHT):
 *   { id, type: 'stroke', tool: 'pen' | 'eraser', color, size, points: [[x, y], ...] }
 *   { id, type: 'line' | 'rect' | 'ellipse', color, size, x1, y1, x2, y2 }
 *   { id, type: 'text', color, size, x, y, text }
 */

import { createId } from './chatConversations.js';

export const BOARD_WIDTH = 1000;
export const BOARD_HEIGHT = 625; // 16:10, kept fixed so the board never changes shape on small screens
export const BOARD_BACKGROUND = '#ffffff';

export const MAX_SHAPES = 300;
export const MAX_TOTAL_POINTS = 30000;
export const MAX_POINTS_PER_STROKE = 2000;
export const MAX_TEXT_LENGTH = 120;
export const MAX_HISTORY = 100;
export const MIN_POINT_DISTANCE = 1.5;
export const MIN_BRUSH_SIZE = 1;
export const MAX_BRUSH_SIZE = 24;
export const DEFAULT_BRUSH_SIZE = 4;
export const ERASER_SCALE = 3;

export const COLORS = [
  { value: '#0f172a', label: 'Black' },
  { value: '#dc2626', label: 'Red' },
  { value: '#ea580c', label: 'Orange' },
  { value: '#ca8a04', label: 'Yellow' },
  { value: '#16a34a', label: 'Green' },
  { value: '#2563eb', label: 'Blue' },
  { value: '#7c3aed', label: 'Purple' },
  { value: '#db2777', label: 'Pink' }
];
export const DEFAULT_COLOR = COLORS[0].value;

export const TOOLS = [
  { id: 'pen', label: 'Pen' },
  { id: 'eraser', label: 'Eraser' },
  { id: 'line', label: 'Line' },
  { id: 'rect', label: 'Rectangle' },
  { id: 'ellipse', label: 'Ellipse' },
  { id: 'text', label: 'Text' }
];

const COLOR_VALUES = new Set(COLORS.map((color) => color.value));
const ID_PATTERN = /^[\w-]{1,64}$/;
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const MARGIN = 50; // stored coordinates may sit slightly outside the board (a stroke that leaves the edge)

const round1 = (value) => Math.round(value * 10) / 10;
const isCoordinate = (value) => typeof value === 'number' && Number.isFinite(value) && value >= -MARGIN && value <= BOARD_WIDTH + MARGIN;
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** The stroke width actually painted. The eraser is wider than the pen so it is practical to use. */
export const getPaintWidth = (shape) => (shape.type === 'stroke' && shape.tool === 'eraser' ? shape.size * ERASER_SCALE : shape.size);

export const getTextFontSize = (size) => 14 + size * 2;

/** Convert a pointer position on the displayed (CSS-scaled) canvas into logical board coordinates. */
export function toLogicalPoint(clientX, clientY, rect) {
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  return [
    round1(clamp(((clientX - rect.left) / rect.width) * BOARD_WIDTH, 0, BOARD_WIDTH)),
    round1(clamp(((clientY - rect.top) / rect.height) * BOARD_HEIGHT, 0, BOARD_HEIGHT))
  ];
}

/** Add a point to a stroke, skipping near-duplicates so strokes stay small. Returns the same array if unchanged. */
export function appendPoint(points, point) {
  const last = points[points.length - 1];

  if (last && Math.hypot(point[0] - last[0], point[1] - last[1]) < MIN_POINT_DISTANCE) {
    return points;
  }

  if (points.length >= MAX_POINTS_PER_STROKE) {
    return points;
  }

  return [...points, point];
}

/** Build a clean shape from a finished drag. Returns null when nothing visible was drawn. */
export function buildShape({ tool, color, size, points, start, end, text }) {
  const base = { id: createId(), color, size };

  if (tool === 'pen' || tool === 'eraser') {
    return points && points.length > 0 ? { ...base, type: 'stroke', tool, points } : null;
  }

  if (tool === 'line' || tool === 'rect' || tool === 'ellipse') {
    if (!start || !end || Math.hypot(end[0] - start[0], end[1] - start[1]) < 3) {
      return null;
    }

    return { ...base, type: tool, x1: start[0], y1: start[1], x2: end[0], y2: end[1] };
  }

  if (tool === 'text') {
    const clean = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_LENGTH) : '';
    return clean && start ? { ...base, type: 'text', x: start[0], y: start[1], text: clean } : null;
  }

  return null;
}

const pointCount = (shape) => (shape.type === 'stroke' ? shape.points.length : 2);

export function countPoints(shapes) {
  return shapes.reduce((total, shape) => total + pointCount(shape), 0);
}

/** @returns {{ ok: true } | { ok: false, error: string }} */
export function canAddShape(shapes, shape) {
  if (shapes.length >= MAX_SHAPES || countPoints(shapes) + pointCount(shape) > MAX_TOTAL_POINTS) {
    return { ok: false, error: 'The board is full. Undo or clear some of it to keep drawing.' };
  }

  return { ok: true };
}

/** Validate one stored shape. Returns a clean copy, or null when it is unusable. Never trusts stored values. */
export function parseShape(raw) {
  if (!isObject(raw) || typeof raw.id !== 'string' || !ID_PATTERN.test(raw.id)) {
    return null;
  }

  if (!COLOR_VALUES.has(raw.color) || !Number.isFinite(raw.size) || raw.size < MIN_BRUSH_SIZE || raw.size > MAX_BRUSH_SIZE) {
    return null;
  }

  const base = { id: raw.id, color: raw.color, size: Math.round(raw.size) };

  if (raw.type === 'stroke') {
    if ((raw.tool !== 'pen' && raw.tool !== 'eraser') || !Array.isArray(raw.points) || raw.points.length === 0 || raw.points.length > MAX_POINTS_PER_STROKE) {
      return null;
    }

    const points = [];

    for (const point of raw.points) {
      if (!Array.isArray(point) || point.length !== 2 || !isCoordinate(point[0]) || !isCoordinate(point[1])) {
        return null;
      }
      points.push([round1(point[0]), round1(point[1])]);
    }

    return { ...base, type: 'stroke', tool: raw.tool, points };
  }

  if (raw.type === 'line' || raw.type === 'rect' || raw.type === 'ellipse') {
    if (![raw.x1, raw.y1, raw.x2, raw.y2].every(isCoordinate)) {
      return null;
    }

    return { ...base, type: raw.type, x1: round1(raw.x1), y1: round1(raw.y1), x2: round1(raw.x2), y2: round1(raw.y2) };
  }

  if (raw.type === 'text') {
    if (!isCoordinate(raw.x) || !isCoordinate(raw.y) || typeof raw.text !== 'string') {
      return null;
    }

    const text = raw.text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_LENGTH);
    return text ? { ...base, type: 'text', x: round1(raw.x), y: round1(raw.y), text } : null;
  }

  return null;
}

/**
 * Validate a stored list. Keeps what is valid (unique ids, within the limits).
 *
 * @returns {{ shapes: object[], skipped: number }}
 */
export function parseShapes(rawList) {
  const shapes = [];
  const seen = new Set();
  let skipped = 0;

  for (const raw of Array.isArray(rawList) ? rawList : []) {
    const shape = parseShape(raw);

    if (!shape || seen.has(shape.id) || !canAddShape(shapes, shape).ok) {
      skipped += 1;
      continue;
    }

    seen.add(shape.id);
    shapes.push(shape);
  }

  return { shapes, skipped };
}

// ---- undo / redo ----------------------------------------------------------------------------------------------------------
// History keeps whole shape lists. Lists share the shape objects, so this is cheap. "Clear" is undoable too.

export const createBoard = (shapes = []) => ({ past: [], present: shapes, future: [] });

export const canUndo = (board) => board.past.length > 0;
export const canRedo = (board) => board.future.length > 0;

/** Returns the same board object when the shape is refused, so callers can detect "nothing changed". */
export function addShape(board, shape) {
  if (!canAddShape(board.present, shape).ok) {
    return board;
  }

  return { past: [...board.past, board.present].slice(-MAX_HISTORY), present: [...board.present, shape], future: [] };
}

export function undo(board) {
  if (!canUndo(board)) {
    return board;
  }

  return { past: board.past.slice(0, -1), present: board.past[board.past.length - 1], future: [board.present, ...board.future] };
}

export function redo(board) {
  if (!canRedo(board)) {
    return board;
  }

  return { past: [...board.past, board.present].slice(-MAX_HISTORY), present: board.future[0], future: board.future.slice(1) };
}

/** Clearing an empty board is a no-op (no empty history entry). */
export function clearBoard(board) {
  if (board.present.length === 0) {
    return board;
  }

  return { past: [...board.past, board.present].slice(-MAX_HISTORY), present: [], future: [] };
}
