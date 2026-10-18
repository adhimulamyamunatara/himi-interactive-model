import { DATE_PRESETS } from '../../utils/analytics';
import Input from '../common/Input';
import Select from '../common/Select';

/** Preset ranges plus a custom from/to range. Shows the validation message for an invalid custom range. */
export default function DateRangeFilter({ filter, onChange, error }) {
  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:items-start">
      <Select label="Time period" value={filter.preset} onChange={(event) => onChange({ ...filter, preset: event.target.value })}>
        {DATE_PRESETS.map((preset) => (
          <option key={preset.value} value={preset.value}>
            {preset.label}
          </option>
        ))}
      </Select>

      {filter.preset === 'custom' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="From" type="date" value={filter.from} onChange={(event) => onChange({ ...filter, from: event.target.value })} />
          <Input label="To" type="date" value={filter.to} onChange={(event) => onChange({ ...filter, to: event.target.value })} />
        </div>
      ) : null}

      {error ? (
        <p className="text-sm font-medium text-rose-600 sm:col-span-2" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
