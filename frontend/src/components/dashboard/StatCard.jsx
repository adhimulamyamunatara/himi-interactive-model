import Card from '../common/Card';

const ACCENTS = {
  blue: { icon: 'from-blue-500 to-cyan-400', glow: 'shadow-blue-500/30' },
  purple: { icon: 'from-violet-500 to-fuchsia-400', glow: 'shadow-violet-500/30' },
  cyan: { icon: 'from-cyan-500 to-sky-400', glow: 'shadow-cyan-500/30' },
  amber: { icon: 'from-amber-500 to-orange-400', glow: 'shadow-amber-500/30' }
};

/** Single KPI tile with a gradient icon badge. */
export default function StatCard({ title, value, caption, icon: Icon, accent = 'blue' }) {
  const style = ACCENTS[accent];

  return (
    <Card interactive>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="mt-2 truncate text-3xl font-black tracking-tight text-slate-950">{value}</p>
        </div>
        {Icon ? (
          <div className={`rounded-2xl bg-gradient-to-br p-3 text-xl text-white shadow-lg ${style.icon} ${style.glow}`}>
            <Icon aria-hidden="true" />
          </div>
        ) : null}
      </div>
      {caption ? <p className="mt-3 text-sm leading-6 text-slate-600">{caption}</p> : null}
    </Card>
  );
}
