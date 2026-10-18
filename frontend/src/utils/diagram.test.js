import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BOARD_METRICS,
  buildDiagramRequest,
  buildSvgString,
  diagramToText,
  diagramToWhiteboardShapes,
  escapeXml,
  fitsOnBoard,
  InvalidDiagramError,
  layoutDiagram,
  parseDiagramResponse,
  wrapLabel
} from './diagram.js';
import { BOARD_HEIGHT, BOARD_WIDTH, parseShape } from './whiteboard.js';

const payload = (overrides = {}) => ({
  requestId: 'd1',
  diagramType: 'flowchart',
  language: 'en',
  title: 'Bubble sort',
  explanation: 'Compare neighbours and swap. Repeat until no swaps.',
  nodes: [
    { id: 'start', label: 'Start', kind: 'start' },
    { id: 'compare', label: 'Compare neighbours', kind: 'process' },
    { id: 'swapped', label: 'Any swap?', kind: 'decision' },
    { id: 'done', label: 'Sorted', kind: 'end' }
  ],
  edges: [
    { from: 'start', to: 'compare' },
    { from: 'compare', to: 'swapped' },
    { from: 'swapped', to: 'compare', label: 'Yes' },
    { from: 'swapped', to: 'done', label: 'No' }
  ],
  review: { passed: true, issues: [] },
  modelCalls: 1,
  ...overrides
});

const chain = (count) => ({
  nodes: Array.from({ length: count }, (_, index) => ({ id: `n${index}`, label: `Step ${index}`, kind: 'process' })),
  edges: Array.from({ length: count - 1 }, (_, index) => ({ from: `n${index}`, to: `n${index + 1}`, label: null }))
});

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/* -------------------------------------------------------------- validation */

test('buildDiagramRequest trims and omits empty details', () => {
  const request = buildDiagramRequest({ topic: '  Paging  ', subject: 'Operating Systems', diagramType: 'states', details: '  ', language: 'te' });
  assert.deepEqual(request, { topic: 'Paging', subject: 'Operating Systems', diagramType: 'states', language: 'te' });
});

test('parseDiagramResponse accepts a valid diagram', () => {
  const diagram = parseDiagramResponse(payload());
  assert.equal(diagram.nodes.length, 4);
  assert.equal(diagram.edges[2].label, 'Yes');
});

test('parseDiagramResponse rejects structurally invalid diagrams', () => {
  const nodes = payload().nodes;
  const bad = [
    null,
    'text',
    payload({ diagramType: 'pie' }),
    payload({ title: '' }),
    payload({ explanation: '  ' }),
    payload({ nodes: [...nodes, { id: 'start', label: 'dup' }] }),
    payload({ nodes: [{ id: 'Bad Id', label: 'x' }, ...nodes.slice(1)] }),
    payload({ nodes: [{ id: 'a', label: '' }, { id: 'b', label: 'B' }], edges: [{ from: 'a', to: 'b' }] }),
    payload({ edges: [{ from: 'start', to: 'ghost' }] }),
    payload({ edges: [{ from: 'start', to: 'start' }] }),
    payload({ edges: [{ from: 'start', to: 'compare' }, { from: 'start', to: 'compare' }] }),
    payload({ edges: [] }),
    payload({ nodes: [{ id: 'a', label: 'A' }], edges: [] })
  ];

  for (const item of bad) {
    assert.throws(() => parseDiagramResponse(item), InvalidDiagramError);
  }
});

test('parseDiagramResponse treats markup as text and normalises unknown kinds', () => {
  const diagram = parseDiagramResponse(
    payload({ nodes: [{ id: 'a', label: '<img src=x onerror=alert(1)>', kind: 'banana' }, { id: 'b', label: 'B' }], edges: [{ from: 'a', to: 'b' }] })
  );
  assert.equal(diagram.nodes[0].label, '<img src=x onerror=alert(1)>');
  assert.equal(diagram.nodes[0].kind, 'process');
});

test('parseDiagramResponse rejects oversized diagrams', () => {
  assert.throws(() => parseDiagramResponse(payload(chain(15))), InvalidDiagramError);
});

/* ------------------------------------------------------------------ layout */

test('wrapLabel wraps, splits long words and truncates with an ellipsis', () => {
  assert.deepEqual(wrapLabel('Compare neighbours now', 14, 3), ['Compare', 'neighbours now']);
  assert.deepEqual(wrapLabel('Supercalifragilistic', 8, 3), ['Supercal', 'ifragili', 'stic']);
  const truncated = wrapLabel('one two three four five six seven eight nine ten', 8, 2);
  assert.equal(truncated.length, 2);
  assert.ok(truncated[1].endsWith('…'));
});

test('a chain lays out top to bottom without overlaps', () => {
  const layout = layoutDiagram(chain(6));
  const ys = layout.nodes.map((node) => node.y);
  assert.deepEqual([...ys].sort((a, b) => a - b), ys);

  for (let i = 0; i < layout.nodes.length; i += 1) {
    for (let j = i + 1; j < layout.nodes.length; j += 1) {
      assert.equal(overlaps(layout.nodes[i], layout.nodes[j]), false);
    }
  }
});

test('every node and edge stays inside the reported canvas', () => {
  const layout = layoutDiagram(parseDiagramResponse(payload()));

  for (const node of layout.nodes) {
    assert.ok(node.x >= 0 && node.y >= 0 && node.x + node.w <= layout.width && node.y + node.h <= layout.height, node.id);
  }

  for (const edge of layout.edges) {
    for (const [x, y] of edge.bezier) {
      assert.ok(x >= 0 && x <= layout.width && y >= 0 && y <= layout.height, edge.key);
    }
  }
});

test('a branching diagram never overlaps nodes and routes a loop around the side', () => {
  const layout = layoutDiagram(parseDiagramResponse(payload()));

  for (let i = 0; i < layout.nodes.length; i += 1) {
    for (let j = i + 1; j < layout.nodes.length; j += 1) {
      assert.equal(overlaps(layout.nodes[i], layout.nodes[j]), false, `${layout.nodes[i].id} overlaps ${layout.nodes[j].id}`);
    }
  }

  assert.equal(layout.edges.find((edge) => edge.key === 'swapped>compare').back, true);
  assert.equal(layout.edges.filter((edge) => edge.back).length, 1);
});

test('edges start and end on the node boundary', () => {
  const layout = layoutDiagram(chain(3));
  const [first] = layout.edges;
  const from = layout.nodes.find((node) => node.id === first.from);
  const to = layout.nodes.find((node) => node.id === first.to);
  assert.equal(first.bezier[0][1], from.y + from.h);
  assert.equal(first.bezier[3][1], to.y);
});

test('layout is deterministic', () => {
  const diagram = parseDiagramResponse(payload());
  assert.deepEqual(layoutDiagram(diagram), layoutDiagram(diagram));
});

test('a state machine with cycles lays out without hanging', () => {
  const states = {
    nodes: ['new', 'ready', 'running', 'waiting'].map((id) => ({ id, label: id, kind: 'state' })),
    edges: [['new', 'ready'], ['ready', 'running'], ['running', 'waiting'], ['waiting', 'ready'], ['running', 'ready']].map(([from, to]) => ({ from, to, label: 'event' }))
  };
  const layout = layoutDiagram(states);
  assert.equal(layout.nodes.length, 4);
  assert.ok(layout.edges.some((edge) => edge.back));
});

test('a graph where every node has an incoming edge still lays out', () => {
  const ring = {
    nodes: ['a', 'b', 'c'].map((id) => ({ id, label: id, kind: 'state' })),
    edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'a' }]
  };
  assert.equal(layoutDiagram(ring).nodes.length, 3);
});

test('wide Telugu labels get boxes wide enough for their text', () => {
  const base = { nodes: [{ id: 'a', label: 'ప్రాసెస్', kind: 'process' }, { id: 'b', label: 'B', kind: 'process' }], edges: [{ from: 'a', to: 'b', label: null }] };
  const telugu = layoutDiagram(base);
  const latin = layoutDiagram({ ...base, nodes: [{ id: 'a', label: 'abcdefgh', kind: 'process' }, base.nodes[1]] });
  assert.ok(telugu.nodes[0].w >= latin.nodes[0].w);
});

test('a maximum-size diagram lays out within sane bounds', () => {
  const layout = layoutDiagram(chain(14));
  assert.equal(layout.nodes.length, 14);
  assert.ok(layout.width < 600 && layout.height < 1500);
});

/* ------------------------------------------------------------------- export */

test('escapeXml escapes every dangerous character', () => {
  assert.equal(escapeXml(`<a href="x" onclick='y'>&</a>`), '&lt;a href=&quot;x&quot; onclick=&apos;y&apos;&gt;&amp;&lt;/a&gt;');
});

test('the SVG export escapes model text and contains no script or external references', () => {
  const diagram = parseDiagramResponse(
    payload({
      title: 'T <script>alert(1)</script>',
      nodes: [{ id: 'a', label: '<script>alert(1)</script>' }, { id: 'b', label: 'B & C' }],
      edges: [{ from: 'a', to: 'b', label: '"quoted"' }]
    })
  );
  const svg = buildSvgString(layoutDiagram(diagram), { title: diagram.title, description: diagram.explanation });

  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.endsWith('</svg>'));
  assert.equal(/<script/i.test(svg), false);
  assert.equal(/href=|onload|onerror|<image|<foreignObject|javascript:/i.test(svg), false);
  assert.ok(svg.includes('&lt;script&gt;'));
  assert.ok(svg.includes('B &amp; C'));
});

test('the SVG export carries an accessible title and description', () => {
  const diagram = parseDiagramResponse(payload());
  const svg = buildSvgString(layoutDiagram(diagram), { title: diagram.title, description: diagram.explanation });
  assert.ok(svg.includes('<title id="t">Bubble sort</title>'));
  assert.ok(svg.includes('<desc id="d">'));
});

test('diagramToText gives a readable outline of every connection', () => {
  const text = diagramToText(parseDiagramResponse(payload()));
  assert.ok(text.includes('Bubble sort'));
  assert.ok(text.includes('- Any swap? -> Compare neighbours (Yes)'));
  assert.equal((text.match(/^- /gm) ?? []).length, 4);
});

/* --------------------------------------------------------------- whiteboard */

const nextId = () => {
  let counter = 0;
  return () => `shape-${(counter += 1)}`;
};

test('diagramToWhiteboardShapes produces valid whiteboard shapes inside the board', () => {
  const result = diagramToWhiteboardShapes(parseDiagramResponse(payload()), nextId());
  assert.equal(result.ok, true);
  assert.ok(result.shapes.length > 10 && result.shapes.length < 300);

  for (const shape of result.shapes) {
    assert.ok(parseShape(shape), `invalid shape ${JSON.stringify(shape)}`);
  }

  const xs = result.shapes.flatMap((shape) => (shape.type === 'stroke' ? shape.points.map((p) => p[0]) : [shape.x1 ?? shape.x, shape.x2 ?? shape.x]));
  const ys = result.shapes.flatMap((shape) => (shape.type === 'stroke' ? shape.points.map((p) => p[1]) : [shape.y1 ?? shape.y, shape.y2 ?? shape.y]));
  assert.ok(Math.min(...xs) >= 0 && Math.max(...xs) <= BOARD_WIDTH);
  assert.ok(Math.min(...ys) >= 0 && Math.max(...ys) <= BOARD_HEIGHT);
});

test('whiteboard shape ids are unique and the text stays at the readable minimum size', () => {
  const { shapes } = diagramToWhiteboardShapes(parseDiagramResponse(payload()), nextId());
  assert.equal(new Set(shapes.map((shape) => shape.id)).size, shapes.length);
  assert.ok(shapes.filter((shape) => shape.type === 'text').every((shape) => shape.size === 1));
});

test('a diagram too large for the board is refused instead of being squashed', () => {
  assert.deepEqual(diagramToWhiteboardShapes(chain(14), () => 'x'), { ok: false, reason: 'too_large' });
});

test('fitsOnBoard respects the shape and point limits', () => {
  const stroke = { type: 'stroke', points: Array.from({ length: 20 }, () => [0, 0]) };
  assert.equal(fitsOnBoard([], [stroke]), true);
  assert.equal(fitsOnBoard(Array.from({ length: 290 }, () => ({ type: 'line' })), Array.from({ length: 11 }, () => ({ type: 'line' }))), false);
  assert.equal(fitsOnBoard([{ type: 'stroke', points: Array.from({ length: 29990 }, () => [0, 0]) }], [stroke]), false);
});

test('board metrics keep text at least as large as the whiteboard minimum', () => {
  assert.ok(BOARD_METRICS.fontSize >= 16);
});
