export default function Avatar({ name = 'HIMI', size = 'md' }) {
  const dimensions = {
    sm: 'h-10 w-10 text-sm',
    md: 'h-12 w-12 text-base',
    lg: 'h-16 w-16 text-lg',
    xl: 'h-24 w-24 text-3xl'
  };

  return (
    <div
      className={`flex items-center justify-center rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-400 font-bold text-white shadow-soft ${dimensions[size]}`}
      aria-label={name}
    >
      {name
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()}
    </div>
  );
}