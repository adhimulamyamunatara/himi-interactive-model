/**
 * Diagrams: validation of the (untrusted) diagram spec, an own layered layout, SVG export and conversion to
 * whiteboard shapes. Pure and framework-free so it can be tested. The model only ever supplies a node/edge graph;
 * everything drawn comes from this file, so no model output is ever interpreted as markup.
 */
import { palette } from '../styles/tokens.js';
import { BOARD_HEIGHT, BOARD_WIDTH, MAX_SHAPES, MAX_TEXT_LENGTH, MAX_TOTAL_POINTS } from './whiteboard.js';

export const DIAGRAM_TYPES = ['flowchart', 'hierarchy', 'states'];
export const MAX_TOPIC_CHARS = 120;
export const MAX_DETAILS_CHARS = 500;

const NODE_KINDS = ['start', 'process', 'decision', 'end', 'state', 'concept'];
const NODE_ID = /^[a-z][a-z0-9_]{0,23}$/;
const MAX_NODES = 14;
const MAX_EDGES = 24;

export class InvalidDiagramError extends Error {
  constructor(message = 'The diagram was not in the expected format.') {
    super(message);
    this.name = 'InvalidDiagramError';
  }
}

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value, max) => (typeof value === 'string' && value.replace(/\s+/g, ' ').trim() ? value.replace(/\s+/g, ' ').trim().slice(0, max) : null);

/* ------------------------------------------------------------------ request */

export function buildDiagramRequest({ topic, subject, diagramType, details, language }) {
  const request = { topic: topic.trim().slice(0, MAX_TOPIC_CHARS), subject, diagramType, language };
  const cleanDetails = (details ?? '').trim().slice(0, MAX_DETAILS_CHARS);

  if (cleanDetails) {
    request.details = cleanDetails;
  }

  return request;
}

/* ----------------------------------------------------------------- response */

/** Validate a `/api/diagrams/generate` payload. Re-checks every graph invariant instead of trusting the server. */
export function parseDiagramResponse(data) {
  if (!isObject(data) || !DIAGRAM_TYPES.includes(data.diagramType)) {
    throw new InvalidDiagramError();
  }

  const title = text(data.title, 100);
  const explanation = typeof data.explanation === 'string' ? data.explanation.trim().slice(0, 1600) : '';

  if (!title || !explanation || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
    throw new InvalidDiagramError();
  }

  const nodes = [];
  const ids = new Set();

  for (const raw of data.nodes) {
    const label = isObject(raw) ? text(raw.label, 40) : null;

    if (!label || typeof raw.id !== 'string' || !NODE_ID.test(raw.id) || ids.has(raw.id)) {
      throw new InvalidDiagramError('Invalid node.');
    }

    ids.add(raw.id);
    nodes.push({ id: raw.id, label, kind: NODE_KINDS.includes(raw.kind) ? raw.kind : 'process' });
  }

  const edges = [];
  const pairs = new Set();

  for (const raw of data.edges) {
    if (!isObject(raw) || !ids.has(raw.from) || !ids.has(raw.to) || raw.from === raw.to || pairs.has(`${raw.from}>${raw.to}`)) {
      throw new InvalidDiagramError('Invalid edge.');
    }

    pairs.add(`${raw.from}>${raw.to}`);
    edges.push({ from: raw.from, to: raw.to, label: text(raw.label, 30) });
  }

  if (nodes.length < 2 || nodes.length > MAX_NODES || edges.length < 1 || edges.length > MAX_EDGES) {
    throw new InvalidDiagramError('Invalid diagram size.');
  }

  return {
    requestId: text(data.requestId, 40) ?? '',
    diagramType: data.diagramType,
    language: data.language === 'te' ? 'te' : 'en',
    title,
    explanation,
    nodes,
    edges,
    review: isObject(data.review)
      ? { passed: data.review.passed === true, issues: (Array.isArray(data.review.issues) ? data.review.issues : []).flatMap((issue) => (text(issue, 300) ? [text(issue, 300)] : [])).slice(0, 6) }
      : null,
    modelCalls: Number.isFinite(data.modelCalls) ? Math.max(0, Math.round(data.modelCalls)) : 0
  };
}

/* ------------------------------------------------------------------- layout */

export const SCREEN_METRICS = {
  fontSize: 13, charWidth: 7.4, wideCharWidth: 11, lineHeight: 17, padX: 16, padY: 11,
  minWidth: 92, minHeight: 44, maxLineChars: 18, maxLines: 3, layerGap: 58, nodeGap: 34, margin: 26
};

/** Larger text so it stays legible on the whiteboard, whose smallest text size is 16px. */
export const BOARD_METRICS = {
  fontSize: 16, charWidth: 9.2, wideCharWidth: 13, lineHeight: 22, padX: 12, padY: 9,
  minWidth: 84, minHeight: 40, maxLineChars: 14, maxLines: 3, layerGap: 40, nodeGap: 22, margin: 20
};

const textWidth = (line, metrics) => [...line].reduce((sum, char) => sum + (char.codePointAt(0) > 0x7f ? metrics.wideCharWidth : metrics.charWidth), 0);

/** Greedy word wrap into at most `maxLines` lines; very long words are split; overflow ends in an ellipsis. */
export function wrapLabel(label, maxChars, maxLines) {
  const words = label.split(' ').flatMap((word) => (word.length > maxChars ? word.match(new RegExp(`.{1,${maxChars}}`, 'gu')) : [word]));
  const lines = [];
  let current = '';

  for (const word of words) {
    if (current && `${current} ${word}`.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }

  if (current) {
    lines.push(current);
  }

  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, Math.max(1, maxChars - 1))}…`;
    return kept;
  }

  return lines;
}

function measure(node, metrics) {
  const lines = wrapLabel(node.label, metrics.maxLineChars, metrics.maxLines);
  const widest = Math.max(...lines.map((line) => textWidth(line, metrics)));
  let w = Math.max(metrics.minWidth, widest + metrics.padX * 2);
  let h = Math.max(metrics.minHeight, lines.length * metrics.lineHeight + metrics.padY * 2);

  if (node.kind === 'decision') {
    w *= 1.45;
    h *= 1.55;
  }

  return { lines, w: Math.round(w), h: Math.round(h) };
}

/** Find edges that close a cycle (they are drawn around the side) and assign each node to a layer. */
function layerGraph(nodes, edges) {
  const order = new Map(nodes.map((node, index) => [node.id, index]));
  const outgoing = new Map(nodes.map((node) => [node.id, []]));
  const incomingCount = new Map(nodes.map((node) => [node.id, 0]));

  edges.forEach((edge, index) => {
    outgoing.get(edge.from).push(index);
    incomingCount.set(edge.to, incomingCount.get(edge.to) + 1);
  });

  const state = new Map(); // undefined | 'open' | 'done'
  const back = new Set();

  const visit = (id) => {
    state.set(id, 'open');

    for (const edgeIndex of outgoing.get(id)) {
      const target = edges[edgeIndex].to;

      if (state.get(target) === 'open') {
        back.add(edgeIndex);
      } else if (!state.has(target)) {
        visit(target);
      }
    }

    state.set(id, 'done');
  };

  const roots = nodes.filter((node) => incomingCount.get(node.id) === 0);

  for (const node of [...roots, ...nodes]) {
    if (!state.has(node.id)) {
      visit(node.id);
    }
  }

  const forward = edges.map((edge, index) => ({ edge, index })).filter(({ index }) => !back.has(index));
  const layer = new Map(nodes.map((node) => [node.id, 0]));

  // Longest-path layering over the acyclic part (repeat until stable; the graph has at most 14 nodes).
  for (let pass = 0; pass < nodes.length; pass += 1) {
    let changed = false;

    for (const { edge } of forward) {
      if (layer.get(edge.to) < layer.get(edge.from) + 1) {
        layer.set(edge.to, layer.get(edge.from) + 1);
        changed = true;
      }
    }

    if (!changed) {
      break;
    }
  }

  return { layer, back, forward: forward.map(({ edge }) => edge), order };
}

const cubicPoint = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return [
    u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
    u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1]
  ];
};

/**
 * Lay a diagram out top-to-bottom.
 *
 * @returns {{width: number, height: number, nodes: object[], edges: object[]}} node boxes plus edge curves
 *          (each edge has cubic Bézier points `bezier = [p0, p1, p2, p3]`, an SVG path `d` and a label position).
 */
export function layoutDiagram(spec, metrics = SCREEN_METRICS) {
  const { nodes, edges } = spec;
  const { layer, back, forward, order } = layerGraph(nodes, edges);
  const sizes = new Map(nodes.map((node) => [node.id, measure(node, metrics)]));
  const layerCount = Math.max(...layer.values()) + 1;
  const layers = Array.from({ length: layerCount }, () => []);

  for (const node of nodes) {
    layers[layer.get(node.id)].push(node.id);
  }

  layers.forEach((ids) => ids.sort((a, b) => order.get(a) - order.get(b)));

  // Reduce crossings: order each layer by the average position of its neighbours in the adjacent layer.
  const position = () => new Map(layers.flatMap((ids) => ids.map((id, index) => [id, index])));
  const sweep = (from, to, neighbours) => {
    const positions = position();

    for (let index = from; index !== to; index += from < to ? 1 : -1) {
      layers[index].sort((a, b) => {
        const score = (id) => {
          const linked = neighbours(id).filter((other) => layer.get(other) === index + (from < to ? -1 : 1));
          return linked.length ? linked.reduce((sum, other) => sum + positions.get(other), 0) / linked.length : positions.get(id);
        };
        return score(a) - score(b) || order.get(a) - order.get(b);
      });
    }
  };
  const predecessors = (id) => forward.filter((edge) => edge.to === id).map((edge) => edge.from);
  const successors = (id) => forward.filter((edge) => edge.from === id).map((edge) => edge.to);

  for (let round = 0; round < 2; round += 1) {
    sweep(1, layerCount, predecessors);
    sweep(layerCount - 2, -1, successors);
  }

  // Coordinates. Layers go down; within a layer nodes are packed left to right, then each layer is pulled toward
  // the average x of its parents so edges stay short and mostly vertical.
  const box = new Map();
  let y = metrics.margin;

  layers.forEach((ids) => {
    const height = Math.max(...ids.map((id) => sizes.get(id).h));
    let x = 0;

    ids.forEach((id) => {
      const { w, h, lines } = sizes.get(id);
      box.set(id, { id, lines, w, h, x, y: y + (height - h) / 2 });
      x += w + metrics.nodeGap;
    });

    y += height + metrics.layerGap;
  });

  const layerBounds = (ids) => ({ left: box.get(ids[0]).x, right: box.get(ids.at(-1)).x + box.get(ids.at(-1)).w });
  const widest = Math.max(...layers.map((ids) => layerBounds(ids).right - layerBounds(ids).left));

  layers.forEach((ids) => {
    const { left, right } = layerBounds(ids);
    const shift = (widest - (right - left)) / 2 - left;
    ids.forEach((id) => (box.get(id).x += shift));
  });

  const pull = (ids, neighbours) => {
    const desired = ids.map((id) => {
      const linked = neighbours(id);
      const target = box.get(id);
      return linked.length ? linked.reduce((sum, other) => sum + box.get(other).x + box.get(other).w / 2, 0) / linked.length - target.w / 2 : target.x;
    });
    let cursor = -Infinity;

    ids.forEach((id, index) => {
      const target = box.get(id);
      target.x = Math.max(desired[index], cursor);
      cursor = target.x + target.w + metrics.nodeGap;
    });
  };

  for (let round = 0; round < 2; round += 1) {
    for (let index = 1; index < layerCount; index += 1) {
      pull(layers[index], predecessors);
    }
    for (let index = layerCount - 2; index >= 0; index -= 1) {
      pull(layers[index], successors);
    }
  }

  const minX = Math.min(...[...box.values()].map((item) => item.x));
  const placed = nodes.map((node) => {
    const item = box.get(node.id);
    const x = Math.round(item.x - minX + metrics.margin);
    return { id: node.id, kind: node.kind, label: node.label, lines: item.lines, x, y: Math.round(item.y), w: item.w, h: item.h, cx: x + item.w / 2, cy: Math.round(item.y) + item.h / 2 };
  });
  const byId = new Map(placed.map((node) => [node.id, node]));
  const maxRight = Math.max(...placed.map((node) => node.x + node.w));
  let loopIndex = 0;

  const laid = edges.map((edge, index) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    let bezier;

    if (back.has(index)) {
      const reach = maxRight + 30 + loopIndex * 20;
      loopIndex += 1;
      const start = [from.x + from.w, from.cy];
      const end = [to.x + to.w, to.cy];
      bezier = [start, [reach, start[1]], [reach, end[1]], end];
    } else {
      const start = [from.cx, from.y + from.h];
      const end = [to.cx, to.y];
      const pull = Math.max(24, (end[1] - start[1]) / 2);
      bezier = [start, [start[0], start[1] + pull], [end[0], end[1] - pull], end];
    }

    const [p0, p1, p2, p3] = bezier;
    const labelPos = cubicPoint(p0, p1, p2, p3, 0.5);
    const round = (value) => Math.round(value * 10) / 10;

    return {
      key: `${edge.from}>${edge.to}`,
      from: edge.from,
      to: edge.to,
      label: edge.label ?? null,
      back: back.has(index),
      bezier: bezier.map(([bx, by]) => [round(bx), round(by)]),
      d: `M ${round(p0[0])} ${round(p0[1])} C ${round(p1[0])} ${round(p1[1])}, ${round(p2[0])} ${round(p2[1])}, ${round(p3[0])} ${round(p3[1])}`,
      labelPos: [round(labelPos[0]), round(labelPos[1])]
    };
  });

  const labelRight = Math.max(...laid.filter((edge) => edge.label).map((edge) => edge.labelPos[0] + (edge.label.length * metrics.charWidth) / 2 + 6), 0);
  const curveRight = Math.max(...laid.flatMap((edge) => edge.bezier.map((point) => point[0])));

  return {
    width: Math.ceil(Math.max(maxRight, curveRight, labelRight) + metrics.margin),
    height: Math.ceil(Math.max(...placed.map((node) => node.y + node.h)) + metrics.margin),
    nodes: placed,
    edges: laid
  };
}

/* ------------------------------------------------------------- text + export */

/** Plain-text outline: the accessible alternative to the picture, and what "Copy as text" copies. */
export function diagramToText(diagram) {
  const label = new Map(diagram.nodes.map((node) => [node.id, node.label]));
  const lines = [diagram.title, '', diagram.explanation, '', 'Connections:'];

  for (const edge of diagram.edges) {
    lines.push(`- ${label.get(edge.from)} -> ${label.get(edge.to)}${edge.label ? ` (${edge.label})` : ''}`);
  }

  return lines.join('\n');
}

export const escapeXml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);

const KIND_COLORS = {
  start: { fill: palette.emerald[50], stroke: palette.emerald[600] },
  end: { fill: palette.violet[50], stroke: palette.violet[600] },
  process: { fill: '#ffffff', stroke: palette.blue[600] },
  decision: { fill: palette.cyan[50], stroke: palette.cyan[700] },
  state: { fill: palette.indigo[50], stroke: palette.indigo[600] },
  concept: { fill: palette.blue[50], stroke: palette.blue[600] }
};

export const nodeColors = (kind) => KIND_COLORS[kind] ?? KIND_COLORS.process;

/** Geometry of a node's outline for the SVG exporter (the React view draws the same shapes). */
export function nodeOutline(node) {
  const { x, y, w, h, cx, cy, kind } = node;

  if (kind === 'decision') {
    return { tag: 'polygon', points: `${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}` };
  }

  if (kind === 'start' || kind === 'end') {
    return { tag: 'rect', x, y, width: w, height: h, rx: h / 2 };
  }

  return { tag: 'rect', x, y, width: w, height: h, rx: 10 };
}

/** A standalone SVG document. Every dynamic string is XML-escaped; no scripts, styles from outside or links. */
export function buildSvgString(layout, { title, description }) {
  const ink = palette.slate[800];
  const edgeColor = palette.slate[500];
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-labelledby="t d" font-family="system-ui, sans-serif">`,
    `<title id="t">${escapeXml(title)}</title>`,
    `<desc id="d">${escapeXml(description)}</desc>`,
    `<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${edgeColor}"/></marker></defs>`,
    `<rect width="${layout.width}" height="${layout.height}" fill="#ffffff"/>`
  ];

  for (const edge of layout.edges) {
    parts.push(`<path d="${edge.d}" fill="none" stroke="${edgeColor}" stroke-width="1.6" marker-end="url(#a)"/>`);

    if (edge.label) {
      const width = edge.label.length * 6.8 + 10;
      parts.push(
        `<rect x="${edge.labelPos[0] - width / 2}" y="${edge.labelPos[1] - 10}" width="${width}" height="20" rx="5" fill="#ffffff" fill-opacity="0.92"/>`,
        `<text x="${edge.labelPos[0]}" y="${edge.labelPos[1] + 4}" text-anchor="middle" font-size="11" fill="${palette.slate[700]}">${escapeXml(edge.label)}</text>`
      );
    }
  }

  for (const node of layout.nodes) {
    const outline = nodeOutline(node);
    const colors = nodeColors(node.kind);
    const attrs = Object.entries(outline).filter(([key]) => key !== 'tag').map(([key, value]) => `${key}="${value}"`).join(' ');
    parts.push(`<${outline.tag} ${attrs} fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="1.8"/>`);

    const top = node.cy - ((node.lines.length - 1) * SCREEN_METRICS.lineHeight) / 2 + 4;
    node.lines.forEach((line, index) => {
      parts.push(`<text x="${node.cx}" y="${top + index * SCREEN_METRICS.lineHeight}" text-anchor="middle" font-size="13" font-weight="600" fill="${ink}">${escapeXml(line)}</text>`);
    });
  }

  parts.push('</svg>');
  return parts.join('');
}

/* ---------------------------------------------------------------- whiteboard */

const BOARD_INK = '#0f172a';
const BOARD_ACCENT = { start: '#16a34a', end: '#7c3aed', decision: '#2563eb', process: '#2563eb', state: '#7c3aed', concept: '#2563eb' };
const BOARD_MARGIN = 24;
const CURVE_SAMPLES = 14;

/**
 * Convert a diagram to whiteboard shapes (lines, rectangles, ellipses, text and pen strokes). The result is only
 * returned if it fits the board; it is never scaled below the whiteboard's readable text size.
 *
 * @param {{nodes: object[], edges: object[]}} spec
 * @param {() => string} createId unique shape ids
 * @returns {{ok: true, shapes: object[]} | {ok: false, reason: 'too_large'}}
 */
export function diagramToWhiteboardShapes(spec, createId) {
  const layout = layoutDiagram(spec, BOARD_METRICS);
  const scale = Math.min(1, (BOARD_WIDTH - BOARD_MARGIN * 2) / layout.width, (BOARD_HEIGHT - BOARD_MARGIN * 2) / layout.height);

  if (scale < 0.8) {
    return { ok: false, reason: 'too_large' };
  }

  const offsetX = (BOARD_WIDTH - layout.width * scale) / 2;
  const offsetY = (BOARD_HEIGHT - layout.height * scale) / 2;
  const mapX = (value) => Math.round((offsetX + value * scale) * 10) / 10;
  const mapY = (value) => Math.round((offsetY + value * scale) * 10) / 10;
  const shapes = [];
  const add = (shape) => shapes.push({ id: createId(), ...shape });

  for (const edge of layout.edges) {
    const [p0, p1, p2, p3] = edge.bezier;
    const points = Array.from({ length: CURVE_SAMPLES + 1 }, (_, index) => cubicPoint(p0, p1, p2, p3, index / CURVE_SAMPLES)).map(([px, py]) => [mapX(px), mapY(py)]);
    add({ type: 'stroke', tool: 'pen', color: BOARD_INK, size: 2, points });

    // Arrow head: two short strokes back from the tip along the curve's final direction.
    const tip = points.at(-1);
    const before = points.at(-3);
    const angle = Math.atan2(tip[1] - before[1], tip[0] - before[0]);
    const wing = (delta) => [Math.round((tip[0] - 11 * Math.cos(angle + delta)) * 10) / 10, Math.round((tip[1] - 11 * Math.sin(angle + delta)) * 10) / 10];
    add({ type: 'stroke', tool: 'pen', color: BOARD_INK, size: 2, points: [wing(0.45), tip, wing(-0.45)] });

    if (edge.label) {
      add({ type: 'text', color: BOARD_INK, size: 1, x: mapX(edge.labelPos[0] - (edge.label.length * BOARD_METRICS.charWidth) / 2), y: mapY(edge.labelPos[1] - 9), text: edge.label.slice(0, MAX_TEXT_LENGTH) });
    }
  }

  for (const node of layout.nodes) {
    const color = BOARD_ACCENT[node.kind] ?? BOARD_ACCENT.process;
    const [x1, y1, x2, y2] = [mapX(node.x), mapY(node.y), mapX(node.x + node.w), mapY(node.y + node.h)];

    if (node.kind === 'decision') {
      const [cx, cy] = [mapX(node.cx), mapY(node.cy)];
      add({ type: 'line', color, size: 2, x1: cx, y1, x2, y2: cy });
      add({ type: 'line', color, size: 2, x1: x2, y1: cy, x2: cx, y2 });
      add({ type: 'line', color, size: 2, x1: cx, y1: y2, x2: x1, y2: cy });
      add({ type: 'line', color, size: 2, x1, y1: cy, x2: cx, y2: y1 });
    } else {
      add({ type: node.kind === 'start' || node.kind === 'end' || node.kind === 'state' ? 'ellipse' : 'rect', color, size: 2, x1, y1, x2, y2 });
    }

    node.lines.forEach((line, index) => {
      const lineWidth = [...line].reduce((sum, char) => sum + (char.codePointAt(0) > 0x7f ? BOARD_METRICS.wideCharWidth : BOARD_METRICS.charWidth), 0);
      const top = node.cy - (node.lines.length * BOARD_METRICS.lineHeight) / 2 + index * BOARD_METRICS.lineHeight;
      add({ type: 'text', color: BOARD_INK, size: 1, x: mapX(node.cx - lineWidth / 2), y: mapY(top + 1), text: line.slice(0, MAX_TEXT_LENGTH) });
    });
  }

  return { ok: true, shapes };
}

/** Whether `extra` shapes can be added to a board that already holds `existing`. */
export function fitsOnBoard(existing, extra) {
  const points = (list) => list.reduce((sum, shape) => sum + (shape.type === 'stroke' ? shape.points.length : 2), 0);
  return existing.length + extra.length <= MAX_SHAPES && points(existing) + points(extra) <= MAX_TOTAL_POINTS;
}
