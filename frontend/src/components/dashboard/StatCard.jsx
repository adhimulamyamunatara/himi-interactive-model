import Card from '../common/Card';

export default function StatCard({ title, value, caption, accent = 'blue' }) {
  const accents = {
    blue: 'from-blue-500 to-cyan-400',
    purple: 'from-violet-500 to-fuchsia-400',
    cyan: 'from-cyan-500 to-sky-400'
  };

  return (
    <Card>
      <div className={`mb-4 h-2 w-20 rounded-full bg-gradient-to-r ${accents[accent]}`} />
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{caption}</p>
    </Card>
  );
}