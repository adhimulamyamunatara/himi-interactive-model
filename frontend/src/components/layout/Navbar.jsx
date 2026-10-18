import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiArrowRight, FiChevronDown, FiLogOut, FiMenu, FiX } from 'react-icons/fi';
import { useChat } from '../../context/ChatContext';
import { useToast } from '../../context/ToastContext';
import { useUser } from '../../context/UserContext';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import Avatar from '../common/Avatar';
import { MEMBER_PAGES, PUBLIC_PAGES } from '../../utils/navigation';
import Button from '../common/Button';

const PRIMARY_LINKS = MEMBER_PAGES.filter((page) => page.primary);
const MORE_LINKS = MEMBER_PAGES.filter((page) => !page.primary);

const desktopLinkClass = ({ isActive }) =>
  `rounded-full px-4 py-2 text-sm font-medium transition ${
    isActive ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
  }`;

const mobileLinkClass = ({ isActive }) =>
  `rounded-2xl px-4 py-3 text-base font-medium transition ${
    isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
  }`;

/** "More" dropdown for the pages that do not fit in the bar. Closes on Escape, outside click and navigation. */
function MoreMenu({ links }) {
  const location = useLocation();
  const [openPath, setOpenPath] = useState(null);
  const containerRef = useRef(null);
  const open = openPath === location.pathname;
  const isActive = links.some((link) => link.to === location.pathname);
  const close = useCallback(() => setOpenPath(null), []);

  useEscapeKey(close, open);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        close();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [close, open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpenPath(open ? null : location.pathname)}
        aria-expanded={open}
        aria-controls="more-menu"
        className={`flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium transition ${
          isActive ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        More <FiChevronDown className={`transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open ? (
        <ul
          id="more-menu"
          className="absolute right-0 top-full z-50 mt-3 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
        >
          {links.map((link) => (
            <li key={link.to}>
              <NavLink to={link.to} className={mobileLinkClass}>
                {link.footerLabel ?? link.label}
              </NavLink>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function Navbar() {
  const { user, logout } = useUser();
  const { clearAllConversations } = useChat();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  // Remember which path the menu was opened on so it closes automatically after navigation.
  const [menuPath, setMenuPath] = useState(null);
  const menuOpen = menuPath === location.pathname;

  const mobileLinks = user ? MEMBER_PAGES : PUBLIC_PAGES;
  const closeMenu = useCallback(() => setMenuPath(null), []);

  useEscapeKey(closeMenu, menuOpen);

  const handleLogout = () => {
    clearAllConversations();
    logout();
    closeMenu();
    toast.success('Signed out', 'Your local session and chat history were cleared.');
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/60 bg-white/80 backdrop-blur-xl">
      <div className="section-shell flex items-center justify-between gap-4 py-4">
        <Link to="/" className="flex items-center gap-3" aria-label="HIMI home">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gradient text-lg font-bold text-white shadow-glow">
            H
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">HIMI</p>
            <p className="hidden text-xs text-slate-500 md:block xl:hidden 2xl:block">Human Inspired Multimodal Interaction Model</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-slate-200 bg-white p-1.5 shadow-sm xl:flex" aria-label="Main">
          {(user ? PRIMARY_LINKS : PUBLIC_PAGES).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={desktopLinkClass}>
              {item.label}
            </NavLink>
          ))}
          {user ? <MoreMenu links={MORE_LINKS} /> : null}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                to="/profile"
                className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 transition hover:border-blue-200 sm:flex"
              >
                <Avatar name={user.name} size="sm" className="!h-8 !w-8 !rounded-xl !text-xs" />
                <div className="text-left">
                  <p className="max-w-[9rem] truncate text-sm font-semibold leading-tight text-slate-900">{user.name}</p>
                  <p className="text-xs text-slate-500">Student</p>
                </div>
              </Link>
              <Button variant="secondary" size="sm" className="hidden sm:inline-flex" onClick={handleLogout}>
                <FiLogOut aria-hidden="true" /> Logout
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" className="hidden sm:inline-flex" to="/login">
                Login
              </Button>
              <Button size="sm" to="/login">
                Start Learning <FiArrowRight aria-hidden="true" />
              </Button>
            </>
          )}
          <button
            type="button"
            onClick={() => setMenuPath(menuOpen ? null : location.pathname)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 xl:hidden"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            {menuOpen ? <FiX aria-hidden="true" /> : <FiMenu aria-hidden="true" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen ? (
          <motion.nav
            id="mobile-menu"
            aria-label="Mobile"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-slate-200/70 bg-white/95 xl:hidden"
          >
            <div className="section-shell flex flex-col gap-1 py-4">
              {mobileLinks.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === '/'} className={mobileLinkClass}>
                  {item.footerLabel ?? item.label}
                </NavLink>
              ))}
              {user ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-2 flex items-center gap-2 rounded-2xl px-4 py-3 text-left text-base font-medium text-rose-600 transition hover:bg-rose-50"
                >
                  <FiLogOut aria-hidden="true" /> Logout
                </button>
              ) : (
                <NavLink to="/login" className={mobileLinkClass}>
                  Login
                </NavLink>
              )}
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
