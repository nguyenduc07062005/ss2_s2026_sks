import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  changePassword,
  getProfile,
  updateProfile,
} from '../../service/authAPI.js';
import { clearToken } from '../../utils/auth.js';
import { SKSMark } from '../BrandBadge.jsx';
import ProfileDialog from './ProfileDialog.jsx';

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
  const [profile, setProfile] = useState(null);
  const [profileName, setProfileName] = useState('Workspace member');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
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
        setProfile(profile);
        setProfileName(nextName);
      } catch {
        if (isActive) {
          setProfile(null);
          setProfileName('Workspace member');
        }
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

  const profileEmail = profile?.email || '';

  const handleLogout = () => {
    clearToken();
    navigate('/login', { replace: true });
  };

  const handleUpdateName = async (name) => {
    const updatedProfile = await updateProfile({ name });
    setProfile(updatedProfile);
    setProfileName(
      updatedProfile?.name?.trim() ||
        updatedProfile?.email?.split('@')[0] ||
        'Workspace member',
    );
  };

  const handleChangePassword = async ({ currentPassword, newPassword }) => {
    return changePassword({ currentPassword, newPassword });
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
        <div className="relative mx-auto flex w-full max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-10">

          <div className="flex min-w-0 items-center gap-4 sm:gap-8">
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
            <div className={`flex items-center gap-3 ${isDocumentViewer ? 'ml-2' : 'ml-0 sm:ml-4 lg:ml-6'}`}>
              <button
                type="button"
                onClick={() => setIsProfileOpen(true)}
                className="group relative flex items-center gap-3 rounded-full bg-white/70 p-1.5 pr-5 text-left shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] backdrop-blur-md ring-1 ring-white/50 transition-all duration-300 hover:bg-white hover:shadow-[0_8px_24px_-8px_rgba(6,182,212,0.25)] hover:ring-cyan-300/50 active:scale-[0.97]"
                aria-label="Open profile settings"
              >
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400/0 via-cyan-400/10 to-blue-500/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
                  <div className="absolute -inset-[2px] animate-[spin_4s_linear_infinite] rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 opacity-50 blur-[3px] transition-opacity duration-300 group-hover:opacity-100" />
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 shadow-inner" />
                  <div className="relative z-10 flex h-full w-full items-center justify-center rounded-full bg-white/10 text-sm font-black text-white backdrop-blur-sm ring-1 ring-white/40">
                    {profileInitial}
                  </div>
                </div>

                <div className="relative z-10 hidden min-w-0 flex-col md:flex">
                  <span className="max-w-[130px] truncate text-[13px] font-black tracking-tight text-slate-800 transition-all duration-300 group-hover:bg-gradient-to-r group-hover:from-cyan-600 group-hover:to-blue-600 group-hover:bg-clip-text group-hover:text-transparent">
                    {profileName}
                  </span>
                  <div className="mt-[2px] flex items-center gap-1.5">
                    <div className="relative flex h-1.5 w-1.5 items-center justify-center">
                      <div className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <div className="relative h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                    </div>
                    <span className="max-w-[110px] truncate text-[10px] font-bold text-slate-400 transition-colors duration-300 group-hover:text-slate-500">
                      {profileEmail || 'View profile'}
                    </span>
                  </div>
                </div>

                {/* Chevron with bounce effect */}
                <div className="relative z-10 hidden ml-2 h-6 w-6 items-center justify-center rounded-full bg-slate-50 text-slate-400 shadow-sm ring-1 ring-slate-200/50 transition-all duration-300 group-hover:bg-cyan-50 group-hover:text-cyan-600 group-hover:ring-cyan-200/50 md:flex">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 transition-transform duration-300 group-hover:translate-y-[2px]">
                    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      {!isDocumentViewer ? (
        <nav className="fixed inset-x-0 bottom-0 z-[90] border-t border-slate-200 bg-white/95 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 shadow-[0_-16px_40px_-24px_rgba(15,23,42,0.55)] backdrop-blur-xl lg:hidden">
          <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex min-h-12 flex-col items-center justify-center rounded-2xl px-2 text-center text-[10px] font-black uppercase tracking-[0.08em] transition ${
                    isActive
                      ? 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100'
                      : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'
                  }`
                }
              >
                <span className="line-clamp-1">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      ) : null}

      {isDocumentViewer ? (
        <section className="relative w-full h-screen pt-16 overflow-hidden">
          <Outlet />
        </section>
      ) : (
        <section className="relative mx-auto w-full max-w-[1440px] px-4 pb-24 pt-20 sm:px-6 lg:px-10 lg:pb-0 lg:pt-24">
          <Outlet />
        </section>
      )}

      <ProfileDialog
        isOpen={isProfileOpen}
        profile={profile}
        onClose={() => setIsProfileOpen(false)}
        onChangePassword={handleChangePassword}
        onLogout={handleLogout}
        onUpdateName={handleUpdateName}
      />
    </main>
  );
};

export default WorkspaceShell;
