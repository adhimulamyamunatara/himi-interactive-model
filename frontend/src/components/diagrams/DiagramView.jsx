import { useId } from 'react';
import { nodeColors, nodeOutline } from '../../utils/diagram';

const STROKE_EDGE = 'stroke-slate-500';

/**
 * Draws a laid-out diagram as SVG. Every label is rendered as React text, so a node called `<script>` is just text.
 * The SVG has an accessible name and description; the full text alternative sits next to it on the page.
 */
export default function DiagramView({ layout, title, description }) {
  const markerId = useId();
  const titleId = useId();
  const descriptionId = useId();

  return (
    <svg
      role="img"
      aria-labelledby={`${titleId} ${descriptionId}`}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width={layout.width}
      height={layout.height}
      className="mx-auto block h-auto max-w-none"
      style={{ minWidth: Math.min(layout.width, 320) }}
      fontFamily="system-ui, sans-serif"
    >
      <title id={titleId}>{title}</title>
      <desc id={descriptionId}>{description}</desc>
      <defs>
        <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" className="fill-slate-500" />
        </marker>
      </defs>

      {layout.edges.map((edge) => (
        <g key={edge.key}>
          <path d={edge.d} fill="none" className={STROKE_EDGE} strokeWidth="1.6" markerEnd={`url(#${markerId})`} />
          {edge.label ? (
            <>
              <rect x={edge.labelPos[0] - (edge.label.length * 6.8 + 10) / 2} y={edge.labelPos[1] - 10} width={edge.label.length * 6.8 + 10} height="20" rx="5" fill="#ffffff" fillOpacity="0.92" />
              <text x={edge.labelPos[0]} y={edge.labelPos[1] + 4} textAnchor="middle" fontSize="11" className="fill-slate-700">
                {edge.label}
              </text>
            </>
          ) : null}
        </g>
      ))}

      {layout.nodes.map((node) => {
        const { tag, ...shape } = nodeOutline(node);
        const colors = nodeColors(node.kind);
        const Shape = tag;
        const top = node.cy - ((node.lines.length - 1) * 17) / 2 + 4;

        return (
          <g key={node.id}>
            <Shape {...shape} fill={colors.fill} stroke={colors.stroke} strokeWidth="1.8" />
            {node.lines.map((line, index) => (
              <text key={index} x={node.cx} y={top + index * 17} textAnchor="middle" fontSize="13" fontWeight="600" className="fill-slate-900">
                {line}
              </text>
            ))}
          </g>
        );
      })}
    </svg>
  );
}
