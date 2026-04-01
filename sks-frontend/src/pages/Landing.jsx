import { Link } from 'react-router-dom';
import BrandBadge from '../components/BrandBadge.jsx';
import { isAuthenticated } from '../utils/auth.js';

const features = [
  {
    title: 'Folder-first workspace',
    description: 'Organize course documents into a clear workspace before adding advanced AI features.',
  },
  {
    title: 'Focused document flow',
    description: 'Search appears directly inside the workspace while favorites and reading stay clear and focused.',
  },
  {
    title: 'Ready for RAG',
    description: 'The structure is being prepared for grounded question answering over your uploaded learning materials.',
  },
];

const Landing = () => {
  const workspaceHref = isAuthenticated() ? '/app' : '/login';

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl flex-col justify-between rounded-[40px] border border-white/70 bg-white/75 p-8 shadow-[0_30px_100px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-10 lg:p-14">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <BrandBadge className="h-12 w-40 sm:h-14 sm:w-48" />
          <div className="flex flex-wrap gap-3">
            <Link
              to="/login"
              className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Create account
            </Link>
          </div>
        </header>

        <div className="grid gap-10 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-teal-600">
              Smart Knowledge System
            </p>
            <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
              A cleaner document workspace now, a polished academic platform next.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              SKS helps users organize learning documents, manage favorites, search with clarity,
              and prepare the product for a professional RAG-powered study assistant.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={workspaceHref}
                className="inline-flex items-center justify-center rounded-full bg-teal-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-teal-500/25 transition hover:bg-teal-500"
              >
                Open workspace
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3.5 text-base font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Start with an account
              </Link>
            </div>
          </div>

          <div className="grid gap-4 rounded-[32px] bg-slate-950 p-5 text-white shadow-[0_35px_70px_rgba(15,23,42,0.2)] sm:p-6">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="rounded-[28px] border border-white/10 bg-white/5 p-5"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-teal-300">
                  Feature
                </p>
                <h2 className="mt-3 text-2xl font-semibold">{feature.title}</h2>
                <p className="mt-3 text-base leading-7 text-slate-300">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>

        <footer className="border-t border-slate-200 pt-6 text-sm text-slate-500">
          Week 2 focuses on clean routing, dedicated pages, stable responsive behavior, and a stronger base for future landing page work.
        </footer>
      </section>
    </main>
  );
};

export default Landing;
