export default function Card({ children, className = '' }) {
  return <div className={`section-card p-6 ${className}`}>{children}</div>;
}