import { BOARD_BACKGROUND, BOARD_HEIGHT, BOARD_WIDTH, getPaintWidth, getTextFontSize } from './whiteboard.js';

function drawStroke(ctx, shape) {
  const { points } = shape;
  const color = shape.tool === 'eraser' ? BOARD_BACKGROUND : shape.color;
  const width = getPaintWidth(shape);

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;

  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0][0], points[0][1], width / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);

  // Smooth the stroke through the midpoints of consecutive points.
  for (let index = 1; index < points.length - 1; index += 1) {
    const midX = (points[index][0] + points[index + 1][0]) / 2;
    const midY = (points[index][1] + points[index + 1][1]) / 2;
    ctx.quadraticCurveTo(points[index][0], points[index][1], midX, midY);
  }

  const last = points[points.length - 1];
  ctx.lineTo(last[0], last[1]);
  ctx.stroke();
}

/** Draw one shape. The context's lineCap/lineJoin are expected to be 'round' (see `drawBoard`). */
export function drawShape(ctx, shape) {
  if (shape.type === 'stroke') {
    drawStroke(ctx, shape);
    return;
  }

  ctx.strokeStyle = shape.color;
  ctx.fillStyle = shape.color;
  ctx.lineWidth = shape.size;

  if (shape.type === 'line') {
    ctx.beginPath();
    ctx.moveTo(shape.x1, shape.y1);
    ctx.lineTo(shape.x2, shape.y2);
    ctx.stroke();
  } else if (shape.type === 'rect') {
    ctx.strokeRect(Math.min(shape.x1, shape.x2), Math.min(shape.y1, shape.y2), Math.abs(shape.x2 - shape.x1), Math.abs(shape.y2 - shape.y1));
  } else if (shape.type === 'ellipse') {
    ctx.beginPath();
    ctx.ellipse((shape.x1 + shape.x2) / 2, (shape.y1 + shape.y2) / 2, Math.abs(shape.x2 - shape.x1) / 2, Math.abs(shape.y2 - shape.y1) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (shape.type === 'text') {
    ctx.font = `600 ${getTextFontSize(shape.size)}px system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(shape.text, shape.x, shape.y, BOARD_WIDTH - shape.x + 40);
  }
}

/**
 * Paint a list of shapes onto a context that is already scaled to the logical board space.
 * `withBackground` paints the white page first (needed for export; the on-screen canvas gets it from CSS).
 */
export function drawBoard(ctx, shapes, { withBackground = false } = {}) {
  ctx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  if (withBackground) {
    ctx.fillStyle = BOARD_BACKGROUND;
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
  }

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const shape of shapes) {
    drawShape(ctx, shape);
  }
}
