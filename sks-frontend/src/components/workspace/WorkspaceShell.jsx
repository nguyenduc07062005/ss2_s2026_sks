import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { getProfile } from '../../service/authAPI.js';
import { clearToken } from '../../utils/auth.js';

const NAV_ITEMS = [
  { to: '/', label: 'Home' },
  { to: '/app', label: 'Workspace', end: true },
  { to: '/app/favorites', label: 'Favorites' },
];

const IconButton = ({ label, onClick, children }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    className="flex h-11 w-11 items-center justify-center rounded-full text-slate-700 transition-all duration-200 hover:bg-slate-100/80 hover:text-rose-600 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
  >
    {children}
  </button>
);

const WorkspaceShell = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [profileName, setProfileName] = useState('Workspace member');

  const isDocumentViewer = /^\/app\/documents\//.test(location.pathname);

  useEffect(() => {
    let isActive = true;

    const loadProfile = async () => {
      try {
        const profile = await getProfile();

        if (!isActive) {
          return;
        }

        const nextName =
          profile?.name?.trim() ||
          profile?.email?.split('@')[0] ||
          'Workspace member';

        setProfileName(nextName);
      } catch {
        if (isActive) {
          setProfileName('Workspace member');
        }
      }
    };

    void loadProfile();

    return () => {
      isActive = false;
    };
  }, []);

  const profileInitial = useMemo(() => {
    const trimmedName = profileName.trim();
    return trimmedName ? trimmedName[0].toUpperCase() : 'S';
  }, [profileName]);

  const handleLogout = () => {
    clearToken();
    navigate('/login', { replace: true });
  };

  return (
    <main className="min-h-screen text-slate-900 relative overflow-x-hidden font-sans">
      {/* Dynamic Vibrant Mesh Background */}
      <div className="fixed inset-0 -z-10 bg-slate-50/50" />
      <div className="absolute top-0 right-0 -z-10 h-[50rem] w-[50rem] opacity-[0.15] mix-blend-multiply blur-3xl transform translate-x-1/3 -translate-y-1/2 rounded-full bg-gradient-to-tr from-cyan-400 via-blue-400 to-sky-300 pointer-events-none animate-spin-slow" />
      <div className="absolute top-40 left-0 -z-10 h-[40rem] w-[40rem] opacity-[0.15] mix-blend-multiply blur-3xl transform -translate-x-1/2 rounded-full bg-gradient-to-bl from-cyan-300 via-teal-300 to-emerald-400 pointer-events-none" />

      <header className="sticky top-0 z-50 w-full border-b border-white/40 bg-white/70 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.02)]">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-6 lg:px-10">
          {/* Brand & Navigator */}
          <div className="flex items-center gap-8">
            <button
              type="button"
              onClick={() => navigate('/app')}
              className="group flex items-center gap-3 transition-all outline-none"
            >
              <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-[10px] bg-gradient-to-br from-cyan-500 via-blue-500 to-sky-400 text-white shadow-lg shadow-cyan-500/20 transition-all duration-300 group-hover:scale-105 group-hover:shadow-cyan-500/40 group-active:scale-95">
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="font-display text-[16px] font-[1000] italic tracking-tight drop-shadow-sm">S</span>
              </div>
              <div className="flex flex-col items-start leading-none">
                <div className="flex items-center gap-2">
                  <span className="text-[17px] font-[1000] tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">
                    SKS
                  </span>
                  <div className="relative flex h-1.5 w-1.5 ml-0.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" title="System Live" />
                  </div>
                </div>
              </div>
            </button>

            <div className="h-6 w-[1px] bg-gray-200" />

            <nav className="hidden items-center gap-1 md:flex">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `px-4 py-2 text-[13px] font-black tracking-tight transition-all rounded-xl ${
                      isActive
                        ? 'text-cyan-700 bg-cyan-50 shadow-sm ring-1 ring-cyan-100/50'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50/80'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Tools & User */}
          <div className="flex items-center gap-4">
            <div className="h-4 w-px bg-gray-200" />

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="group flex items-center gap-2.5 rounded-full border border-slate-200/50 bg-white/60 backdrop-blur-sm px-2 py-1 pr-4 shadow-sm transition-all hover:bg-white hover:shadow hover:border-slate-300/60 active:scale-[0.98]"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-cyan-500 via-blue-500 to-sky-400 text-[11px] font-black text-white shadow-lg shadow-cyan-500/20 ring-1 ring-white/50">
                  {profileInitial}
                </div>
                <span className="text-[12px] font-bold text-slate-600 group-hover:text-slate-900">
                  {profileName.split(' ')[0]}
                </span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 border border-transparent text-slate-400 transition-all hover:bg-rose-50 hover:border-rose-100 hover:text-rose-600 hover:shadow-sm hover:-rotate-6 active:scale-95"
                title="Logout Account"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
                  <path fillRule="evenodd" d="M3 4.25A1.25 1.25 0 014.25 3h5a.75.75 0 010 1.5h-5a.25.25 0 00-.25.25v10.5c0 .138.112.25.25.25h5a.75.75 0 010 1.5h-5A1.25 1.25 0 013 15.25V4.25z" clipRule="evenodd" />
                  <path fillRule="evenodd" d="M13.22 6.22a.75.75 0 011.06 0l3.25 3.25a.75.75 0 010 1.06l-3.25 3.25a.75.75 0 01-1.06-1.06l1.97-1.97H8a.75.75 0 010-1.5h7.19l-1.97-1.97a.75.75 0 010-1.06z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {isDocumentViewer ? (
        <section className="relative z-10 pt-4">
          <Outlet />
        </section>
      ) : (
        <section className="relative z-10 mx-auto w-full max-w-[1440px] px-6 pb-24 pt-6 lg:px-10">
          <Outlet />
        </section>
      )}
    </main>
  );
};

export default WorkspaceShell;
