import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiArrowRight, FiChevronDown, FiLogOut, FiMenu, FiX } from 'react-icons/fi';
import { useChat } from '../../context/ChatContext';
import { useToast } from '../../context/ToastContext';
import { useUser } from '../../context/UserContext';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useT } from '../../i18n/I18nContext';
import UserAvatar from '../common/UserAvatar';
import { MEMBER_PAGES, PUBLIC_PAGES, pageLabel } from '../../utils/navigation';
import BrandLogo from '../common/BrandLogo';
import Button from '../common/Button';
import LanguageSelect from '../common/LanguageSelect';

const PRIMARY_LINKS = MEMBER_PAGES.filter((page) => page.primary);
const MORE_LINKS = MEMBER_PAGES.filter((page) => !page.primary);

const desktopLinkClass = ({ isActive }) =>
  `rounded-full px-4 py-2 text-sm font-medium transition ${
    isActive ? 'bg-brand-gradient text-white shadow-glow-soft' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
  }`;

const mobileLinkClass = ({ isActive }) =>
  `rounded-2xl px-4 py-3 text-base font-medium transition ${
    isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
  }`;

/** "More" dropdown for the pages that do not fit in the bar. Closes on Escape, outside click and navigation. */
function MoreMenu({ links }) {
  const { t } = useT();
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
          isActive ? 'bg-brand-gradient text-white shadow-glow-soft' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
        }`}
      >
        {t('nav.more')} <FiChevronDown className={`transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open ? (
        <ul
          id="more-menu"
          className="absolute right-0 top-full z-50 mt-3 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
        >
          {links.map((link) => (
            <li key={link.to}>
              <NavLink to={link.to} className={mobileLinkClass}>
                {pageLabel(link, t, { footer: true })}
              </NavLink>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function Navbar() {
  const { t } = useT();
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
        <Link to="/" className="flex shrink-0 items-center rounded-xl" aria-label="HIMI home">
          <BrandLogo variant="horizontal" className="h-11 sm:h-12" alt="" />
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-slate-200 bg-white p-1.5 shadow-sm xl:flex" aria-label="Main">
          {(user ? PRIMARY_LINKS : PUBLIC_PAGES).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={desktopLinkClass}>
              {pageLabel(item, t)}
            </NavLink>
          ))}
          {user ? <MoreMenu links={MORE_LINKS} /> : null}
        </nav>

        <div className="flex items-center gap-3">
          <LanguageSelect className="hidden sm:inline-flex" />
          {user ? (
            <>
              <Link
                to="/profile"
                className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 transition hover:border-blue-200 sm:flex"
              >
                <UserAvatar size="sm" className="!h-8 !w-8 !rounded-xl !text-xs" />
                <div className="text-left">
                  <p className="max-w-[9rem] truncate text-sm font-semibold leading-tight text-slate-900">{user.name}</p>
                  <p className="text-xs text-slate-500">{t('common.student')}</p>
                </div>
              </Link>
              <Button variant="secondary" size="sm" className="hidden sm:inline-flex" onClick={handleLogout}>
                <FiLogOut aria-hidden="true" /> {t('nav.logout')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" className="hidden sm:inline-flex" to="/login">
                {t('nav.login')}
              </Button>
              <Button size="sm" to="/login">
                {t('nav.startLearning')} <FiArrowRight aria-hidden="true" />
              </Button>
            </>
          )}
          <button
            type="button"
            onClick={() => setMenuPath(menuOpen ? null : location.pathname)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 xl:hidden"
            aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
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
              <LanguageSelect className="mb-2 self-start sm:hidden" />
              {mobileLinks.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === '/'} className={mobileLinkClass}>
                  {pageLabel(item, t, { footer: true })}
                </NavLink>
              ))}
              {user ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-2 flex items-center gap-2 rounded-2xl px-4 py-3 text-left text-base font-medium text-rose-600 transition hover:bg-rose-50"
                >
                  <FiLogOut aria-hidden="true" /> {t('nav.logout')}
                </button>
              ) : (
                <NavLink to="/login" className={mobileLinkClass}>
                  {t('nav.login')}
                </NavLink>
              )}
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
