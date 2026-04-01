import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import BrandBadge from '../BrandBadge.jsx';
import { getProfile } from '../../service/authAPI.js';
import { clearToken } from '../../utils/auth.js';

const NAV_ITEMS = [
  { to: '/', label: 'Home' },
  { to: '/app', label: 'Workspace', end: true },
  { to: '/app/favorites', label: 'Favorites' },
];

const WorkspaceShell = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [profileName, setProfileName] = useState('Workspace member');

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

  const currentQuery = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return location.pathname === '/app' ? params.get('q') || '' : '';
  }, [location.pathname, location.search]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const trimmedQuery = String(formData.get('q') || '').trim();

    if (!trimmedQuery) {
      navigate('/app');
      return;
    }

    navigate(`/app?q=${encodeURIComponent(trimmedQuery)}`);
  };

  const handleLogout = () => {
    clearToken();
    navigate('/login', { replace: true });
  };

  const profileFirstName = useMemo(() => {
    const trimmedName = profileName.trim();

    if (!trimmedName) {
      return 'there';
    }

    return trimmedName.split(/\s+/)[0];
  }, [profileName]);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7fafc_0%,#f1f5f9_100%)]">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/92 shadow-[0_10px_30px_rgba(15,23,42,0.04)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => navigate('/app')}
            className="shrink-0 text-left transition hover:opacity-80"
          >
            <BrandBadge className="h-11 w-36 sm:h-12 sm:w-40" />
          </button>

          <nav className="hidden items-center gap-2 lg:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <form
            onSubmit={handleSearchSubmit}
            className="min-w-0 flex-1 xl:flex xl:justify-center"
          >
            <div className="relative w-full xl:max-w-md">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              >
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                key={`${location.pathname}-${currentQuery}`}
                name="q"
                type="text"
                defaultValue={currentQuery}
                placeholder="Search documents"
                className="w-full rounded-3xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100 sm:text-base"
              />
            </div>
          </form>

          <div className="hidden shrink-0 items-center gap-3 rounded-3xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-[0_12px_28px_rgba(15,23,42,0.05)] xl:flex">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 text-lg leading-none">
              {'\uD83D\uDC4B'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {profileFirstName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Logout"
            aria-label="Logout"
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-4 focus:ring-rose-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path
                fillRule="evenodd"
                d="M3 4.75A1.75 1.75 0 0 1 4.75 3h5.5a.75.75 0 0 1 0 1.5h-5.5a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h5.5a.75.75 0 0 1 0 1.5h-5.5A1.75 1.75 0 0 1 3 15.25V4.75Z"
                clipRule="evenodd"
              />
              <path
                fillRule="evenodd"
                d="M13.78 6.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 1 1-1.06-1.06l1.97-1.97H8.75a.75.75 0 0 1 0-1.5h6.999l-1.97-1.97a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </section>
    </main>
  );
};

export default WorkspaceShell;
