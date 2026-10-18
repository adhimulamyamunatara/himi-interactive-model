import { Link } from 'react-router-dom';
import Button from '../components/common/Button';

export default function NotFound() {
  return (
    <section className="section-shell grid min-h-[calc(100vh-140px)] place-items-center py-16 text-center">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">404</p>
        <h1 className="mt-4 text-4xl font-black text-slate-950 sm:text-6xl">Page not found</h1>
        <p className="mt-5 text-lg leading-8 text-slate-600">
          The route you requested does not exist in the Phase 1 MVP shell.
        </p>
        <Link to="/">
          <Button className="mt-8">Return home</Button>
        </Link>
      </div>
    </section>
  );
}