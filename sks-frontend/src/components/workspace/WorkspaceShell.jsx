import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { getProfile } from '../../service/authAPI.js';
import { clearToken } from '../../utils/auth.js';
import { SKSMark } from '../BrandBadge.jsx';

const WORKSPACE_SCROLL_STORAGE_KEY = 'sks.workspace.scrollPositions.v1';

const NAV_ITEMS = [
  { to: '/app', label: 'Workspace', end: true },
  { to: '/app/study-gps', label: 'Study GPS' },
  { to: '/app/quiz', label: 'Quiz' },
  { to: '/app/favorites', label: 'Favorites' },
];

const getWindowScrollTop = () =>
  window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;

const loadStoredScrollPositions = () => {
  try {
    const rawValue = window.sessionStorage.getItem(WORKSPACE_SCROLL_STORAGE_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : {};

    return parsedValue && typeof parsedValue === 'object' && !Array.isArray(parsedValue)
      ? parsedValue
      : {};
  } catch {
    return {};
  }
};

const saveStoredScrollPositions = (positions) => {
  try {
    window.sessionStorage.setItem(
      WORKSPACE_SCROLL_STORAGE_KEY,
      JSON.stringify(positions),
    );
  } catch {
    // In-memory scroll restoration still works if storage is unavailable.
  }
};

const WorkspaceShell = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [profileName, setProfileName] = useState('Workspace member');
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollPositionsRef = useRef(loadStoredScrollPositions());
  const currentRouteKey = `${location.pathname}${location.search}`;

  const isDocumentViewer = /^\/app\/documents\//.test(location.pathname);
  const isHeaderCompact = isScrolled || isDocumentViewer;

  useEffect(() => {
    let isActive = true;

    const loadProfile = async () => {
      try {
        const profile = await getProfile();
        if (!isActive) return;
        const nextName =
          profile?.name?.trim() ||
          profile?.email?.split('@')[0] ||
          'Workspace member';
        setProfileName(nextName);
      } catch {
        if (isActive) setProfileName('Workspace member');
      }
    };

    void loadProfile();

    const handleScroll = (e) => {
      const scrollTop =
        (e.target && e.target.scrollTop) ||
        getWindowScrollTop() ||
        0;
      setIsScrolled(scrollTop > 20);
    };

    window.addEventListener('scroll', handleScroll, true);
    return () => {
      isActive = false;
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, []);

  useEffect(() => {
    const handleScrollPosition = () => {
      scrollPositionsRef.current[currentRouteKey] = getWindowScrollTop();
      saveStoredScrollPositions(scrollPositionsRef.current);
    };

    window.addEventListener('scroll', handleScrollPosition, { passive: true });
    window.addEventListener('beforeunload', handleScrollPosition);

    return () => {
      window.removeEventListener('scroll', handleScrollPosition);
      window.removeEventListener('beforeunload', handleScrollPosition);
    };
  }, [currentRouteKey]);

  useLayoutEffect(() => {
    const savedScrollTop = scrollPositionsRef.current[currentRouteKey] || 0;

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: savedScrollTop, left: 0, behavior: 'auto' });
      setIsScrolled(savedScrollTop > 20);
    });
  }, [currentRouteKey]);

  const profileInitial = useMemo(() => {
    const trimmedName = profileName.trim();
    return trimmedName ? trimmedName[0].toUpperCase() : 'S';
  }, [profileName]);

  const handleLogout = () => {
    clearToken();
    navigate('/login', { replace: true });
  };

  return (
    <main className={`text-slate-900 relative font-sans ${isDocumentViewer ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      {/* Dynamic Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden bg-slate-50/50">
        <div className="absolute top-0 right-0 h-[50rem] w-[50rem] opacity-[0.12] mix-blend-multiply blur-3xl transform translate-x-1/3 -translate-y-1/2 rounded-full bg-gradient-to-tr from-cyan-400 via-blue-400 to-sky-300 pointer-events-none animate-spin-slow" />
        <div className="absolute top-40 left-0 h-[40rem] w-[40rem] opacity-[0.12] mix-blend-multiply blur-3xl transform -translate-x-1/2 rounded-full bg-gradient-to-bl from-cyan-300 via-teal-300 to-emerald-400 pointer-events-none" />
      </div>

      <header
        className={`fixed top-0 left-0 right-0 z-[100] flex w-full items-center transition-all duration-300 ${
          isHeaderCompact
            ? 'h-16 border-b border-slate-200 bg-white shadow-lg shadow-slate-900/10'
            : 'h-20 border-b border-slate-200/80 bg-white shadow-sm shadow-slate-900/5'
        }`}
      >
        <div className="relative mx-auto flex w-full max-w-[1440px] items-center justify-between px-6 lg:px-10">

          <div className="flex items-center gap-8 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/app')}
              className="group flex items-center gap-3 outline-none"
              aria-label="Go to workspace home"
            >
              <div className="transition-all duration-200 group-hover:scale-105 group-active:scale-95">
                <SKSMark size={36} />
              </div>
              <div className="hidden sm:flex flex-col leading-none">
                <span className="text-[13px] font-black text-slate-900"
                      style={{ fontFamily: "'Inter',sans-serif", letterSpacing: '-0.03em' }}>
                  Smart Knowledge
                </span>
                <span className="mt-[3px] text-[8px] font-semibold uppercase tracking-[0.22em] text-slate-400"
                      style={{ fontFamily: "'Inter',sans-serif" }}>
                  System
                </span>
              </div>
            </button>

            <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-10 lg:flex">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `relative whitespace-nowrap py-1 text-center text-[13px] font-black tracking-wide transition-all ${
                      isActive ? 'text-slate-950' : 'text-slate-500 hover:text-slate-950'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {item.label}
                      {isActive && <div className="absolute -bottom-2.5 left-1/2 h-5 w-5 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-md" />}
                      {isActive && <span className="absolute -bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-cyan-500" />}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-3 ${isDocumentViewer ? 'ml-2' : 'ml-6'}`}>
              <div className="group relative flex items-center gap-3 cursor-pointer">
                <div className="relative flex h-9 w-9 items-center justify-center">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-500 blur-md opacity-20 group-hover:opacity-40 transition-opacity" />
                  <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-[13px] font-black text-white shadow-lg ring-1 ring-white/20 transition-transform group-hover:scale-105">
                    {profileInitial}
                  </div>
                </div>
                <div className="hidden flex-col items-start leading-tight lg:flex">
                  <span className="text-[12px] font-black text-slate-900">{profileName.split(' ')[0]}</span>
                  <div className="flex items-center gap-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,145,178,0.5)]" />
                    <span className="text-[9px] font-black uppercase tracking-wider text-cyan-600">Premium Pro</span>
                  </div>
                </div>
              </div>

              <div className="h-5 w-px bg-slate-200/50" />

              <button
                type="button"
                onClick={handleLogout}
                className="group flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-500 active:scale-95"
                title="Logout Account"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5 transition-transform group-hover:rotate-12">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {isDocumentViewer ? (
        <section className="relative w-full h-screen pt-16 overflow-hidden">
          <Outlet />
        </section>
      ) : (
        <section className="relative mx-auto w-full max-w-[1440px] px-6 pt-20 lg:px-10 lg:pt-24">
          <Outlet />
        </section>
      )}
    </main>
  );
};

export default WorkspaceShell;
