import { Link, NavLink, useNavigate } from 'react-router-dom';
import { FiArrowRight, FiMenu } from 'react-icons/fi';
import Button from '../common/Button';
import Avatar from '../common/Avatar';
import { useUser } from '../../context/UserContext';

export default function Navbar() {
  const { user, logout } = useUser();
  const navigate = useNavigate();

  const navItems = [
    { to: '/', label: 'Home' },
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/chat', label: 'Chat' },
    { to: '/profile', label: 'Profile' }
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-white/60 bg-white/80 backdrop-blur-xl">
      <div className="section-shell flex items-center justify-between py-4">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-400 text-lg font-bold text-white shadow-soft">
            H
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">HIMI</p>
            <p className="text-xs text-slate-500">Human Inspired Multimodal Interaction Model</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 lg:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 sm:flex">
                <Avatar name={user.name} size="sm" />
                <div className="text-left">
                  <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                  <p className="text-xs text-slate-500">Student account</p>
                </div>
              </div>
              <Button variant="secondary" onClick={() => logout()}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                className="hidden sm:inline-flex"
                onClick={() => navigate('/login')}
              >
                Login
              </Button>
              <Button onClick={() => navigate('/login')}>
                Start Learning <FiArrowRight />
              </Button>
            </>
          )}
          <button className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 lg:hidden">
            <FiMenu />
          </button>
        </div>
      </div>
    </header>
  );
}