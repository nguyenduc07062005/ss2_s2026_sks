import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BrandBadge from '../components/BrandBadge.jsx';
import { getProfile } from '../service/authAPI.js';
import { clearToken, getRoleFromToken, getUserIdFromToken } from '../utils/auth.js';

const Dashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const role = getRoleFromToken();
  const userId = getUserIdFromToken();

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await getProfile();
        setProfile(data);
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            'Could not load your profile. Please log in again.',
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadProfile();
  }, []);

  const handleLogout = () => {
    clearToken();
    navigate('/login', { replace: true });
  };

  return (
    <main className="px-4 py-10">
      <section className="mx-auto max-w-6xl space-y-6">
        <div className="overflow-hidden rounded-[36px] border border-white/80 bg-white/90 shadow-[0_35px_100px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="grid gap-6 p-8 lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
            <div>
              <div className="mb-6">
                <BrandBadge className="h-20 w-20" />
              </div>
              <h1 className="mt-3 text-4xl font-semibold text-slate-900">
                Welcome to your workspace
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
                Your account is active and ready to use. This space will become
                the foundation for managing documents and working with knowledge
                more effectively.
              </p>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                    Workspace
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    A clean home base for documents, summaries, and conversations.
                  </p>
                </article>
                <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                    Access
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    Your session is active so the app can securely load your data.
                  </p>
                </article>
                <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                    Ready
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    Your profile has been verified and the account is ready to continue.
                  </p>
                </article>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-[28px] border border-teal-100 bg-[linear-gradient(180deg,#f0fdfa_0%,#eff6ff_100%)] p-6">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-teal-700">
                  Account
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-slate-900">
                  Session active
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  You are signed in successfully. You can return later and continue
                  working from the same account.
                </p>
              </div>

              <button
                className="mt-8 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                onClick={handleLogout}
                type="button"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-[36px] border border-white/80 bg-white/90 p-8 shadow-[0_35px_100px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-teal-700">
                Account Details
              </p>
              <h2 className="mt-2 text-3xl font-semibold text-slate-900">
                Your profile
              </h2>
              <p className="mt-3 max-w-xl text-sm text-slate-600">
                Basic account information associated with the current session.
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50/90 p-6">
            {isLoading ? (
              <p className="text-sm text-slate-500">Loading profile...</p>
            ) : error ? (
              <div className="space-y-4">
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  {error}
                </p>
                <button
                  className="rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950"
                  onClick={handleLogout}
                  type="button"
                >
                  Back to login
                </button>
              </div>
            ) : (
              <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Name
                  </dt>
                  <dd className="mt-2 text-lg font-medium text-slate-900">
                    {profile?.name || '-'}
                  </dd>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Email
                  </dt>
                  <dd className="mt-2 text-lg font-medium text-slate-900">
                    {profile?.email || '-'}
                  </dd>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Role
                  </dt>
                  <dd className="mt-2 text-lg font-medium capitalize text-slate-900">
                    {profile?.role || role || '-'}
                  </dd>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Status
                  </dt>
                  <dd className="mt-2 text-lg font-medium text-slate-900">
                    {profile?.isActive ? 'Active' : 'Inactive'}
                  </dd>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Account ID
                  </dt>
                  <dd className="mt-2 break-all text-lg font-medium text-slate-900">
                    {userId || '-'}
                  </dd>
                </div>
              </dl>
            )}
          </div>
        </div>
      </section>
    </main>
  );
};

export default Dashboard;
