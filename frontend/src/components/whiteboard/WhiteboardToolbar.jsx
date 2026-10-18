import { LuCircle, LuDownload, LuEraser, LuMinus, LuPencil, LuRedo2, LuSquare, LuTrash2, LuType, LuUndo2 } from 'react-icons/lu';
import { COLORS, MAX_BRUSH_SIZE, MIN_BRUSH_SIZE, TOOLS } from '../../utils/whiteboard';
import Button from '../common/Button';

const TOOL_ICONS = { pen: LuPencil, eraser: LuEraser, line: LuMinus, rect: LuSquare, ellipse: LuCircle, text: LuType };

export default function WhiteboardToolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  size,
  onSizeChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  hasShapes,
  exporting,
  onClear,
  onExport
}) {
  return (
    <div className="section-card grid gap-5 p-4 sm:p-5">
      <div className="flex flex-wrap gap-x-8 gap-y-5">
        <div role="group" aria-label="Drawing tools">
          <p className="mb-2 text-sm font-semibold text-slate-800">Tool</p>
          <div className="flex flex-wrap gap-2">
            {TOOLS.map((item) => {
              const Icon = TOOL_ICONS[item.id];
              const active = tool === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onToolChange(item.id)}
                  className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 ${
                    active ? 'border-blue-600 bg-blue-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-800 hover:border-blue-200 hover:bg-slate-50'
                  }`}
                >
                  <Icon aria-hidden="true" /> {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-slate-800">Colour</legend>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((item) => (
              <label key={item.value} className="relative cursor-pointer">
                <input
                  type="radio"
                  name="whiteboard-color"
                  value={item.value}
                  checked={color === item.value}
                  onChange={() => onColorChange(item.value)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  style={{ backgroundColor: item.value }}
                  className="block h-8 w-8 rounded-full ring-offset-2 transition peer-checked:ring-2 peer-checked:ring-slate-900 peer-focus-visible:ring-4 peer-focus-visible:ring-blue-300"
                />
                <span className="sr-only">{item.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="min-w-[10rem]">
          <label htmlFor="whiteboard-size" className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold text-slate-800">
            Brush size <span className="font-medium text-slate-500">{size}</span>
          </label>
          <input
            id="whiteboard-size"
            type="range"
            min={MIN_BRUSH_SIZE}
            max={MAX_BRUSH_SIZE}
            step="1"
            value={size}
            onChange={(event) => onSizeChange(Number(event.target.value))}
            className="h-2 w-full cursor-pointer accent-blue-600"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4" role="group" aria-label="Board actions">
        <Button variant="secondary" size="sm" onClick={onUndo} disabled={!canUndo}>
          <LuUndo2 aria-hidden="true" /> Undo
        </Button>
        <Button variant="secondary" size="sm" onClick={onRedo} disabled={!canRedo}>
          <LuRedo2 aria-hidden="true" /> Redo
        </Button>
        <Button variant="secondary" size="sm" onClick={onClear} disabled={!hasShapes}>
          <LuTrash2 aria-hidden="true" /> Clear board
        </Button>
        <Button size="sm" onClick={onExport} disabled={!hasShapes || exporting} aria-busy={exporting}>
          <LuDownload aria-hidden="true" /> {exporting ? 'Preparing…' : 'Export image'}
        </Button>
      </div>
    </div>
  );
}
