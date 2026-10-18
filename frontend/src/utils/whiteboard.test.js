import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  MAX_HISTORY,
  MAX_POINTS_PER_STROKE,
  MAX_SHAPES,
  MAX_TEXT_LENGTH,
  MAX_TOTAL_POINTS,
  addShape,
  appendPoint,
  buildShape,
  canAddShape,
  canRedo,
  canUndo,
  clearBoard,
  countPoints,
  createBoard,
  getPaintWidth,
  parseShape,
  parseShapes,
  redo,
  toLogicalPoint,
  undo
} from './whiteboard.js';

const stroke = (id = 's1', points = [[1, 1], [10, 10]]) => ({ id, type: 'stroke', tool: 'pen', color: '#0f172a', size: 4, points });
const rect = (id = 'r1') => ({ id, type: 'rect', color: '#2563eb', size: 3, x1: 10, y1: 10, x2: 100, y2: 80 });

describe('toLogicalPoint', () => {
  it('maps the same physical spot to the same logical point at any display size', () => {
    const small = { left: 10, top: 20, width: 340, height: 212.5 };
    const big = { left: 0, top: 0, width: 1000, height: 625 };
    assert.deepEqual(toLogicalPoint(10 + 170, 20 + 106.25, small), [500, 312.5]);
    assert.deepEqual(toLogicalPoint(500, 312.5, big), [500, 312.5]);
  });

  it('clamps points outside the board and ignores an unusable rect', () => {
    const rectangle = { left: 0, top: 0, width: 500, height: 312.5 };
    assert.deepEqual(toLogicalPoint(-30, 9999, rectangle), [0, BOARD_HEIGHT]);
    assert.deepEqual(toLogicalPoint(9999, -5, rectangle), [BOARD_WIDTH, 0]);
    assert.equal(toLogicalPoint(1, 1, { left: 0, top: 0, width: 0, height: 0 }), null);
    assert.equal(toLogicalPoint(1, 1, null), null);
  });
});

describe('appendPoint', () => {
  it('skips near-duplicates (same array back) and respects the per-stroke limit', () => {
    const points = [[0, 0]];
    assert.equal(appendPoint(points, [0.5, 0.5]), points);
    assert.deepEqual(appendPoint(points, [5, 5]), [[0, 0], [5, 5]]);
    const full = Array.from({ length: MAX_POINTS_PER_STROKE }, (_, i) => [i % 900, 5]);
    assert.equal(appendPoint(full, [999, 600]), full);
  });
});

describe('buildShape', () => {
  const common = { color: '#0f172a', size: 4 };

  it('builds strokes, shapes and text', () => {
    assert.equal(buildShape({ ...common, tool: 'pen', points: [[1, 1]] }).type, 'stroke');
    assert.equal(buildShape({ ...common, tool: 'eraser', points: [[1, 1], [9, 9]] }).tool, 'eraser');
    assert.deepEqual(
      (({ type, x1, y1, x2, y2 }) => ({ type, x1, y1, x2, y2 }))(buildShape({ ...common, tool: 'ellipse', start: [0, 0], end: [50, 40] })),
      { type: 'ellipse', x1: 0, y1: 0, x2: 50, y2: 40 }
    );
    const text = buildShape({ ...common, tool: 'text', start: [10, 20], text: '  hello   world ' });
    assert.equal(text.text, 'hello world');
  });

  it('returns null for nothing visible', () => {
    assert.equal(buildShape({ ...common, tool: 'pen', points: [] }), null);
    assert.equal(buildShape({ ...common, tool: 'line', start: [5, 5], end: [5, 6] }), null, 'a tiny drag is not a shape');
    assert.equal(buildShape({ ...common, tool: 'text', start: [5, 5], text: '   ' }), null);
    assert.equal(buildShape({ ...common, tool: 'text', text: 'x' }), null, 'text needs a position');
    assert.equal(buildShape({ ...common, tool: 'laser', start: [0, 0], end: [50, 50] }), null);
  });

  it('truncates very long text and gives every shape a unique id', () => {
    const long = buildShape({ ...common, tool: 'text', start: [1, 1], text: 'a'.repeat(1000) });
    assert.equal(long.text.length, MAX_TEXT_LENGTH);
    const ids = new Set(Array.from({ length: 50 }, () => buildShape({ ...common, tool: 'pen', points: [[1, 1]] }).id));
    assert.equal(ids.size, 50);
  });
});

describe('undo / redo / clear', () => {
  it('adds, undoes and redoes shapes in order', () => {
    let board = createBoard();
    assert.equal(canUndo(board), false);
    board = addShape(board, stroke('a'));
    board = addShape(board, rect('b'));
    assert.deepEqual(board.present.map((s) => s.id), ['a', 'b']);
    board = undo(board);
    assert.deepEqual(board.present.map((s) => s.id), ['a']);
    assert.equal(canRedo(board), true);
    board = undo(board);
    assert.deepEqual(board.present, []);
    board = redo(board);
    board = redo(board);
    assert.deepEqual(board.present.map((s) => s.id), ['a', 'b']);
    assert.equal(canRedo(board), false);
  });

  it('drawing after an undo discards the redo branch', () => {
    let board = addShape(addShape(createBoard(), stroke('a')), stroke('b'));
    board = undo(board);
    board = addShape(board, rect('c'));
    assert.deepEqual(board.present.map((s) => s.id), ['a', 'c']);
    assert.equal(canRedo(board), false);
  });

  it('undo/redo with nothing to do returns the same board', () => {
    const board = createBoard();
    assert.equal(undo(board), board);
    assert.equal(redo(board), board);
    assert.equal(clearBoard(board), board, 'clearing an empty board adds no history');
  });

  it('clear is undoable and redo-able', () => {
    let board = addShape(addShape(createBoard(), stroke('a')), rect('b'));
    board = clearBoard(board);
    assert.deepEqual(board.present, []);
    assert.equal(canUndo(board), true);
    board = undo(board);
    assert.equal(board.present.length, 2);
    board = redo(board);
    assert.deepEqual(board.present, []);
  });

  it('history is bounded', () => {
    let board = createBoard();
    for (let i = 0; i < MAX_HISTORY + 20; i += 1) {
      board = addShape(board, buildShape({ tool: 'pen', color: '#0f172a', size: 2, points: [[i % 900, 5]] }));
      if (board.present.length >= MAX_SHAPES) break;
    }
    assert.ok(board.past.length <= MAX_HISTORY);
  });

  it('does not mutate earlier states', () => {
    const first = addShape(createBoard(), stroke('a'));
    const snapshot = JSON.stringify(first);
    addShape(first, rect('b'));
    undo(first);
    clearBoard(first);
    assert.equal(JSON.stringify(first), snapshot);
  });
});

describe('limits', () => {
  it('refuses new shapes once the shape or point budget is used up, and tells the user why', () => {
    let board = createBoard();
    for (let i = 0; i < MAX_SHAPES; i += 1) board = addShape(board, rect(`r${i}`));
    assert.equal(board.present.length, MAX_SHAPES);
    const refused = addShape(board, rect('extra'));
    assert.equal(refused, board);
    assert.match(canAddShape(board.present, rect('extra')).error, /board is full/);

    const heavy = Array.from({ length: Math.floor(MAX_TOTAL_POINTS / MAX_POINTS_PER_STROKE) }, (_, i) =>
      stroke(`h${i}`, Array.from({ length: MAX_POINTS_PER_STROKE }, (_, j) => [j % 900, 10]))
    );
    assert.equal(countPoints(heavy), MAX_TOTAL_POINTS);
    assert.equal(canAddShape(heavy, stroke('one-more', [[1, 1]])).ok, false);
  });
});

describe('parseShape / parseShapes', () => {
  it('accepts valid shapes and rounds coordinates', () => {
    assert.deepEqual(parseShape({ ...stroke(), points: [[1.234, 2.345], [3, 4]] }).points, [[1.2, 2.3], [3, 4]]);
    assert.equal(parseShape(rect()).type, 'rect');
    assert.equal(parseShape({ id: 't1', type: 'text', color: '#dc2626', size: 5, x: 10, y: 10, text: ' hi ' }).text, 'hi');
  });

  it('rejects malformed or hostile shapes', () => {
    const bad = [
      null, 'x', [], {},
      { ...stroke(), id: '' },
      { ...stroke(), id: 'a b/../c' },
      { ...stroke(), color: 'red' },
      { ...stroke(), color: 'javascript:alert(1)' },
      { ...stroke(), size: 0 },
      { ...stroke(), size: 9999 },
      { ...stroke(), size: 'big' },
      { ...stroke(), tool: 'laser' },
      { ...stroke(), points: [] },
      { ...stroke(), points: [[1, 2, 3]] },
      { ...stroke(), points: [[NaN, 1]] },
      { ...stroke(), points: [[1, Infinity]] },
      { ...stroke(), points: [['1', '2']] },
      { ...stroke(), points: [[99999, 1]] },
      { ...stroke(), points: Array.from({ length: MAX_POINTS_PER_STROKE + 1 }, () => [1, 1]) },
      { ...rect(), x2: undefined },
      { ...rect(), type: 'triangle' },
      { id: 't', type: 'text', color: '#0f172a', size: 4, x: 1, y: 1, text: '   ' },
      { id: 't', type: 'text', color: '#0f172a', size: 4, x: 1, y: 1, text: 42 }
    ];
    for (const item of bad) assert.equal(parseShape(item), null, JSON.stringify(item)?.slice(0, 60));
  });

  it('keeps valid shapes, skips invalid and duplicate ones, and enforces the shape cap', () => {
    const { shapes, skipped } = parseShapes([stroke('a'), { nope: true }, stroke('a'), rect('b')]);
    assert.deepEqual(shapes.map((s) => s.id), ['a', 'b']);
    assert.equal(skipped, 2);
    const many = Array.from({ length: MAX_SHAPES + 25 }, (_, i) => rect(`r${i}`));
    const capped = parseShapes(many);
    assert.equal(capped.shapes.length, MAX_SHAPES);
    assert.equal(capped.skipped, 25);
    assert.deepEqual(parseShapes('not a list'), { shapes: [], skipped: 0 });
  });

  it('paint width: the eraser is wider than the brush size', () => {
    assert.equal(getPaintWidth(stroke()), 4);
    assert.ok(getPaintWidth({ ...stroke(), tool: 'eraser' }) > 4);
  });
});
