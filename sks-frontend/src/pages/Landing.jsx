import { Link } from 'react-router-dom';
import BrandBadge from '../components/BrandBadge.jsx';
import { isAuthenticated } from '../utils/auth.js';

const featureCards = [
  {
    title: 'Folder-led structure',
    body: 'Keep courses, references, drafts, and project material in a workspace that feels deliberate instead of chaotic.',
  },
  {
    title: 'Focused reading flow',
    body: 'Open documents on a dedicated page, return to favorites quickly, and keep search grounded inside the workspace.',
  },
  {
    title: 'AI-ready foundation',
    body: 'The interface is being shaped for contextual summaries, document chat, and retrieval-backed study support.',
  },
];

const workflowSteps = [
  'Upload course files and place them in folders that match your subjects or projects.',
  'Search directly inside the workspace and keep the strongest materials in favorites.',
  'Open a dedicated viewer for deep reading, then expand into future AI study actions.',
];

const Landing = () => {
  const workspaceHref = isAuthenticated() ? '/app' : '/login';

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <section className="sks-card mx-auto max-w-7xl overflow-hidden px-8 py-8 sm:px-10 lg:px-12 animate-fade-in shadow-sks-medium">
        <header className="flex flex-col gap-6 border-b border-sks-slate-100 pb-8 lg:flex-row lg:items-center lg:justify-between">
          <BrandBadge className="h-16 w-48 sm:h-20 sm:w-56" />

          <nav className="flex flex-wrap items-center gap-4">
            <Link to="/login" className="sks-button-secondary py-3 px-8 text-[14px]">
              Sign in
            </Link>
            <Link to="/register" className="sks-button-primary py-3 px-8 text-[14px]">
              Get Started
            </Link>
          </nav>
        </header>

        <div className="grid gap-12 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-20">
          <div className="animate-fade-up">
            <p className="sks-kicker mb-6">Knowledge Infrastructure</p>
            <h1 className="sks-heading max-w-4xl text-6xl font-black tracking-tight text-sks-slate-950 sm:text-7xl lg:text-8xl">
              Knowledge management <span className="text-sks-primary">reimagined.</span>
            </h1>
            <p className="sks-copy mt-8 max-w-2xl text-xl leading-relaxed text-sks-slate-500">
              SKS is a specialized workspace designed for researchers and students. 
              Organize assets, discover semantic connections, and prepare your database 
              for document-grounded AI intelligence.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link to={workspaceHref} className="sks-button-primary px-10 py-4 text-base shadow-sks-soft">
                Explore Workspace
              </Link>
              <Link to="/register" className="sks-button-secondary px-10 py-4 text-base">
                Create Account
              </Link>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {[
                ['Architecture', 'Hierarchy First'],
                ['Research', 'Deep Analysis'],
                ['AI Synthesis', 'Grounded Truth'],
              ].map(([label, value], i) => (
                <div key={label} className="sks-card-soft p-6 animate-fade-up" style={{ animationDelay: `${0.1 * i}s` }}>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-sks-slate-400">
                    {label}
                  </p>
                  <p className="mt-3 text-lg font-black text-sks-slate-900 tracking-tight">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="rounded-[2.5rem] border border-sks-primary/10 bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-800 p-8 text-white shadow-sks-medium overflow-hidden relative group">
              <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-64 h-64 bg-sks-primary rounded-full blur-[80px] opacity-20 group-hover:opacity-30 transition-opacity" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-300 mb-4">
                Design Philosophy
              </p>
              <h2 className="font-display text-4xl font-extrabold tracking-tight leading-none">
                Scholarly <br />Precision.
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-indigo-100/80 font-medium">
                A focused interface with high typographic hierarchy and grounded actions, 
                built to support high-stakes academic and professional research.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-1">
              {featureCards.map((feature, i) => (
                <article key={feature.title} className="sks-card-soft p-6 animate-fade-up" style={{ animationDelay: `${0.3 + i * 0.1}s` }}>
                  <p className="sks-kicker text-sks-primary">{feature.title}</p>
                  <p className="mt-4 text-[15px] leading-relaxed text-sks-slate-500 font-medium">
                    {feature.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-8 border-t border-sks-slate-100 py-12 lg:grid-cols-[1fr_0.8fr]">
          <div className="sks-card-soft p-8">
            <p className="sks-kicker mb-6">Workflow Integration</p>
            <div className="space-y-6">
              {workflowSteps.map((step, index) => (
                <div key={step} className="flex gap-5 group items-start">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sks-primary-light text-sks-primary font-black text-lg shadow-sm transition-all group-hover:scale-110 group-hover:rotate-3">
                    {index + 1}
                  </div>
                  <p className="pt-2 text-[15px] leading-relaxed text-sks-slate-600 font-medium group-hover:text-sks-slate-900 transition-colors">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="sks-card-soft p-8 bg-gradient-to-br from-indigo-50/50 to-white overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-sks-primary/40" />
            <p className="sks-kicker mb-4">Core Roadshow</p>
            <h3 className="text-3xl font-black text-sks-slate-900 tracking-tight leading-snug">
              Document-grounded <br /><span className="text-sks-primary">AI intelligence.</span>
            </h3>
            <p className="mt-6 text-[15px] leading-relaxed text-sks-slate-500 font-medium">
              We reserve contextual areas for asset-level synthesis, conceptual mapping, 
              and retrieval-backed answers. Your library isn't just a archive—it's a 
              dynamic base for discovery.
            </p>
            <div className="mt-8 flex h-1.5 w-full bg-sks-slate-100 rounded-full overflow-hidden">
               <div className="h-full bg-sks-primary w-2/3 shadow-[0_0_12px_rgba(79,70,229,0.4)]" />
            </div>
            <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-sks-slate-400">System Ready for Deployment</p>
          </div>
        </div>
      </section>
      
      <footer className="mt-12 text-center pb-12">
        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-sks-slate-300">
          SKS · Smart Knowledge System · 2026
        </p>
      </footer>
    </main>
  );
};

export default Landing;
