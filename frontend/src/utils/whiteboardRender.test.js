import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BOARD_BACKGROUND, BOARD_HEIGHT, BOARD_WIDTH } from './whiteboard.js';
import { drawBoard } from './whiteboardRender.js';

/** A canvas context stand-in that records what was drawn and with which style. */
function createRecorder() {
  const calls = [];
  const target = {};
  const record = (name) => (...args) => calls.push({ name, args, strokeStyle: target.strokeStyle, fillStyle: target.fillStyle, lineWidth: target.lineWidth });
  for (const name of ['clearRect', 'fillRect', 'beginPath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'stroke', 'fill', 'arc', 'ellipse', 'strokeRect', 'fillText']) {
    target[name] = record(name);
  }
  return { ctx: target, calls, names: () => calls.map((c) => c.name) };
}

describe('drawBoard', () => {
  it('clears the board and paints a white page only when exporting', () => {
    const screen = createRecorder();
    drawBoard(screen.ctx, []);
    assert.deepEqual(screen.names(), ['clearRect']);
    assert.deepEqual(screen.calls[0].args, [0, 0, BOARD_WIDTH, BOARD_HEIGHT]);

    const exported = createRecorder();
    drawBoard(exported.ctx, [], { withBackground: true });
    assert.deepEqual(exported.names(), ['clearRect', 'fillRect']);
    assert.equal(exported.calls[1].fillStyle, BOARD_BACKGROUND);
  });

  it('draws a single-point stroke as a dot and a longer stroke as a smooth path', () => {
    const dot = createRecorder();
    drawBoard(dot.ctx, [{ id: 'a', type: 'stroke', tool: 'pen', color: '#dc2626', size: 6, points: [[50, 50]] }]);
    assert.ok(dot.names().includes('arc') && dot.names().includes('fill'));

    const path = createRecorder();
    drawBoard(path.ctx, [{ id: 'b', type: 'stroke', tool: 'pen', color: '#dc2626', size: 6, points: [[0, 0], [10, 10], [20, 0], [30, 10]] }]);
    assert.ok(path.names().includes('quadraticCurveTo'));
    assert.equal(path.names().filter((name) => name === 'stroke').length, 1);
  });

  it('the eraser paints in the page colour and wider than the brush', () => {
    const rec = createRecorder();
    drawBoard(rec.ctx, [{ id: 'e', type: 'stroke', tool: 'eraser', color: '#dc2626', size: 6, points: [[0, 0], [20, 20]] }]);
    const stroked = rec.calls.find((c) => c.name === 'stroke');
    assert.equal(stroked.strokeStyle, BOARD_BACKGROUND);
    assert.ok(stroked.lineWidth > 6);
  });

  it('draws lines, rectangles (any drag direction), ellipses and text', () => {
    const rec = createRecorder();
    drawBoard(rec.ctx, [
      { id: '1', type: 'line', color: '#2563eb', size: 3, x1: 0, y1: 0, x2: 10, y2: 10 },
      { id: '2', type: 'rect', color: '#2563eb', size: 3, x1: 100, y1: 90, x2: 40, y2: 30 },
      { id: '3', type: 'ellipse', color: '#2563eb', size: 3, x1: 0, y1: 0, x2: 60, y2: 40 },
      { id: '4', type: 'text', color: '#16a34a', size: 4, x: 5, y: 5, text: 'Hello' }
    ]);
    assert.deepEqual(rec.calls.find((c) => c.name === 'strokeRect').args, [40, 30, 60, 60]);
    assert.deepEqual(rec.calls.find((c) => c.name === 'ellipse').args.slice(0, 4), [30, 20, 30, 20]);
    assert.equal(rec.calls.find((c) => c.name === 'fillText').args[0], 'Hello');
  });
});
