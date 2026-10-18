import { Link } from 'react-router-dom';

const BASE_CLASSES =
  'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60';

const VARIANTS = {
  primary:
    'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-glow enabled:hover:-translate-y-0.5 enabled:hover:shadow-xl',
  secondary:
    'border border-slate-200 bg-white text-slate-900 shadow-sm hover:border-blue-200 hover:bg-slate-50',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100',
  light: 'bg-white text-slate-950 shadow-card hover:-translate-y-0.5 hover:bg-slate-100',
  danger: 'bg-rose-600 text-white shadow-sm hover:bg-rose-700 focus-visible:ring-rose-200'
};

const SIZES = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-5 py-3 text-sm',
  lg: 'px-7 py-4 text-base'
};

/**
 * Button that renders a router link (`to`), an anchor (`href`) or a native button.
 */
export default function Button({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  type = 'button',
  to,
  href,
  ...props
}) {
  const classes = `${BASE_CLASSES} ${VARIANTS[variant]} ${SIZES[size]} ${className}`;

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    );
  }

  if (href) {
    return (
      <a href={href} className={classes} {...props}>
        {children}
      </a>
    );
  }

  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  );
}
