import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const HERO_SLIDES = [
  { id: 1, src: 'https://cdn.elearningindustry.com/wp-content/uploads/2024/07/Shutterstock_2480344323.jpg', alt: 'AI Education' },
  { id: 2, src: 'https://vidyaenews.most.gov.lk/wp-content/uploads/2025/09/1727771640461-780x470-1.png', alt: 'Smart Knowledge System' },
  { id: 3, src: 'https://cdn.elearningindustry.com/wp-content/uploads/2019/01/5-ways-ai-is-changing-the-education-industry-1-1024x574.jpg', alt: 'AI Learning' },
];

const FEATURES = [
  {
    title: 'Smart Document Management',
    description: 'Organize your research papers, lecture notes, and project files with intelligent folder structures and quick access.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
    gradient: 'from-cyan-500 to-sky-500',
    shadowColor: 'shadow-cyan-500/20',
    delay: '0s',
  },
  {
    title: 'AI Intelligence',
    description: 'Get instant AI summaries, conceptual diagrams, and chat with your documents. Let AI extract insights for you.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
      </svg>
    ),
    gradient: 'from-blue-500 to-indigo-500',
    shadowColor: 'shadow-blue-500/20',
    delay: '0.1s',
  },
  {
    title: 'Semantic Search',
    description: 'Find exactly what you need with AI-powered semantic search. Go beyond keywords — discover relevant content by meaning.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8">
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      </svg>
    ),
    gradient: 'from-violet-500 to-purple-500',
    shadowColor: 'shadow-violet-500/20',
    delay: '0.2s',
  },
];

const AI_CAPABILITIES = [
  { icon: '✦', label: 'Summary Generation', description: 'Auto-generate comprehensive summaries in Vietnamese or English' },
  { icon: '📐', label: 'Conceptual Diagrams', description: 'Visualize document structure with AI-powered mind maps' },
  { icon: '🧠', label: 'Document Chat', description: 'Ask questions and get answers grounded in your documents' },
  { icon: '🔗', label: 'Related Documents', description: 'Discover semantic connections across your entire library' },
];

const STEPS = [
  { number: '01', title: 'Upload', description: 'Drop your documents into the workspace — PDFs, DOCX, TXT, and more.' },
  { number: '02', title: 'Analyze', description: 'AI processes and indexes your content for intelligent retrieval.' },
  { number: '03', title: 'Discover', description: 'Get summaries, ask questions, and find connections you never knew existed.' },
];

const Home = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [typingIndex, setTypingIndex] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const slideTimer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 10000); // 10s/ảnh
    const typingTimer = setInterval(() => {
      setTypingIndex((prev) => (prev + 1) % 4);
    }, 6000); // 6s/chữ
    return () => {
      clearInterval(slideTimer);
      clearInterval(typingTimer);
    };
  }, []);

  return (
    <div className="mx-auto max-w-[1440px]">
      {/* ═══ HERO SECTION ═══ */}
      <section className="relative grid gap-8 pt-4 pb-12 lg:grid-cols-2 lg:items-center lg:gap-16 lg:pt-6 lg:pb-20">
        {/* Left — Text */}
        <div className="animate-slide-up relative z-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-4 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
            </span>
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-700">AI-Powered Platform</span>
          </div>

          <h1 className="font-display text-5xl font-[1000] leading-[1.08] tracking-tight text-slate-900 sm:text-6xl lg:text-7xl">
            <span className="block mb-1 sm:mb-2">Your Smart</span>
            <span className="inline-grid text-left">
              {['Knowledge Base', 'Research Hub', 'AI Assistant', 'Data System'].map((phrase, i) => (
                <span
                  key={phrase}
                  className={`col-start-1 row-start-1 pb-2 transition-all duration-[4000ms] ease-in-out text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 ${
                    i === typingIndex ? 'opacity-100 translate-y-0 filter-none' : 'opacity-0 translate-y-4 blur-[6px] pointer-events-none'
                  }`}
                >
                  {phrase}
                </span>
              ))}
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-500 font-medium">
            Upload documents, get AI-powered summaries, chat with your files, 
            and discover semantic connections — all in one intelligent workspace.
          </p>

          {/* Feature Checkmarks */}
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            {['Smart Summary', 'Document Chat', 'Auto Mindmap'].map((feature) => (
              <div key={feature} className="flex items-center gap-2 text-[13px] font-bold text-slate-500">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-100 text-cyan-600">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                  </svg>
                </div>
                {feature}
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              to="/app"
              className="group inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-8 py-4 text-[14px] font-[1000] tracking-wide text-white shadow-xl shadow-cyan-600/25 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-cyan-600/35 active:scale-[0.98]"
            >
              Open Workspace
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1">
                <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638l-3.96-3.697a.75.75 0 0 1 1.024-1.096l5.25 4.9a.75.75 0 0 1 0 1.097l-5.25 4.9a.75.75 0 0 1-1.024-1.097l3.96-3.697H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
              </svg>
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-8 py-4 text-[14px] font-bold text-slate-700 shadow-sm transition-all duration-300 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md"
            >
              Learn More
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
            </a>
          </div>

        </div>


        {/* Right — Hero Illustration */}
        <div 
          className="relative flex items-center justify-center animate-scale-in [animation-delay:0.2s] [animation-fill-mode:both]"
          onMouseMove={(e) => {
            const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
            setMousePos({
              x: (e.clientX - left - width / 2) / (width / 2),
              y: (e.clientY - top - height / 2) / (height / 2),
            });
          }}
          onMouseLeave={() => setMousePos({ x: 0, y: 0 })}
          style={{
            transform: `perspective(1000px) rotateX(${-mousePos.y * 6}deg) rotateY(${mousePos.x * 6}deg)`,
            transition: mousePos.x === 0 && mousePos.y === 0 ? 'transform 0.5s ease-out' : 'transform 0.1s ease-out'
          }}
        >
          {/* Background glow */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-200/40 via-blue-200/30 to-indigo-200/20 blur-3xl opacity-60" />
          
          <div className="relative z-10 w-full max-w-xl lg:max-w-2xl mx-auto md:mr-0 md:ml-auto lg:mx-auto">
            {/* Image Frame with Glass Bezel */}
            <div className="relative w-full p-2.5 sm:p-4 rounded-[2.5rem] bg-white/40 border border-white/60 shadow-[0_20px_50px_-12px_rgba(8,145,178,0.25)] backdrop-blur-xl animate-float-slow">
              <div className="relative w-full aspect-[16/10] rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden shadow-inner ring-1 ring-black/5 bg-slate-100">
                {HERO_SLIDES.map((slide, index) => (
                  <img
                    key={slide.id}
                    src={slide.src}
                    alt={slide.alt}
                    className={`absolute inset-0 w-full h-full object-cover transition-all duration-[4000ms] ease-in-out ${
                      index === currentSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'
                    }`}
                  />
                ))}
                <div className="absolute inset-0 bg-gradient-to-tr from-slate-900/10 via-transparent to-white/20 pointer-events-none mix-blend-overlay" />
                
                {/* Carousel Indicators Overlay */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-2 rounded-full bg-black/20 backdrop-blur-md ring-1 ring-white/20 shadow-lg">
                  {HERO_SLIDES.map((slide, index) => (
                    <button
                      key={slide.id}
                      onClick={() => setCurrentSlide(index)}
                      className={`h-1.5 rounded-full transition-all duration-500 flex-shrink-0 ${
                        index === currentSlide ? 'w-6 bg-white' : 'w-2 bg-white/40 hover:bg-white/70'
                      }`}
                      aria-label={`Go to slide ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Badges separated completely from the image */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 hidden md:flex animate-slide-up [animation-delay:0.3s]">
              {/* UI Widget 1: Supported Formats */}
              <div className="relative flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/60 px-4 py-2.5 shadow-sm backdrop-blur-md transition-transform hover:-translate-y-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-100 shadow-inner">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Supported Formats</span>
                  <span className="text-[11px] font-[1000] tracking-tight text-slate-800">PDF, DOCX, TXT</span>
                </div>
              </div>

              {/* UI Widget 2: AI Engine */}
              <div className="relative flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/60 px-4 py-2.5 shadow-sm backdrop-blur-md transition-transform hover:-translate-y-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shadow-inner">
                   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                     <path d="M10 2.75 12.163 7.133l4.836.703-3.5 3.412.826 4.817L10 13.79l-4.325 2.275.826-4.817-3.5-3.412 4.836-.703L10 2.75Z" />
                   </svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">AI Engine</span>
                  <span className="text-[11px] font-[1000] tracking-tight text-slate-800">Powered by Gemini</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ═══ FEATURES SECTION ═══ */}
      <section id="features" className="py-16 lg:py-24">
        <div className="mb-12 text-center animate-slide-up [animation-delay:0.1s] [animation-fill-mode:both]">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-cyan-600">Core Capabilities</p>
          <h2 className="mt-3 font-display text-4xl font-[1000] tracking-tight text-slate-900 sm:text-5xl">
            Everything you need to{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-blue-600">
              master knowledge
            </span>
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="group relative overflow-hidden rounded-[28px] border border-white/60 bg-white/70 backdrop-blur-xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-500 hover:-translate-y-2 hover:bg-white hover:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.1)] animate-slide-up [animation-fill-mode:both]"
              style={{ animationDelay: feature.delay }}
            >
              {/* Glow effect on hover */}
              <div className={`absolute -top-20 -right-20 h-40 w-40 rounded-full bg-gradient-to-br ${feature.gradient} opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-20`} />

              <div className={`relative z-10 mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.gradient} text-white shadow-lg ${feature.shadowColor} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                {feature.icon}
              </div>

              <h3 className="relative z-10 text-xl font-[1000] tracking-tight text-slate-900">
                {feature.title}
              </h3>
              <p className="relative z-10 mt-3 text-[15px] leading-relaxed text-slate-500 font-medium">
                {feature.description}
              </p>

              {/* Bottom accent line */}
              <div className={`absolute bottom-0 left-0 h-1 w-0 bg-gradient-to-r ${feature.gradient} transition-all duration-500 group-hover:w-full`} />
            </article>
          ))}
        </div>
      </section>

      {/* ═══ AI SHOWCASE SECTION ═══ */}
      <section className="py-8 lg:py-12">
        <div
          className="relative overflow-hidden rounded-[32px] shadow-2xl animate-slide-up [animation-delay:0.15s] [animation-fill-mode:both]"
        >
          {/* Background image */}
          <img
            src="/ai-showcase-bg.png"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            aria-hidden="true"
          />
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900/90 via-slate-900/85 to-indigo-950/90" />

          <div className="relative z-10 px-8 py-14 sm:px-14 sm:py-20">
            <div className="flex items-center gap-3 mb-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                </svg>
              </div>
              <span className="text-[11px] font-black uppercase tracking-[0.3em] text-cyan-400">Powered by AI Intelligence</span>
            </div>

            <h2 className="max-w-2xl font-display text-4xl font-[1000] leading-tight tracking-tight text-white sm:text-5xl">
              Unlock the full power of your{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">documents</span>
            </h2>

            <p className="mt-5 max-w-xl text-lg text-slate-400 font-medium leading-relaxed">
              Open any document in the viewer to access AI-powered analysis tools. 
              Let artificial intelligence do the heavy lifting.
            </p>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {AI_CAPABILITIES.map((cap) => (
                <div
                  key={cap.label}
                  className="group rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 transition-all duration-300 hover:bg-white/10 hover:border-white/20 hover:-translate-y-1"
                >
                  <span className="text-2xl mb-3 block">{cap.icon}</span>
                  <h3 className="text-sm font-[1000] text-white tracking-tight">{cap.label}</h3>
                  <p className="mt-2 text-[13px] text-slate-400 leading-relaxed font-medium">{cap.description}</p>
                </div>
              ))}
            </div>

            <div className="mt-12">
              <Link
                to="/app"
                className="inline-flex items-center gap-3 rounded-2xl bg-white px-8 py-4 text-[13px] font-[1000] tracking-wide text-slate-900 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl active:scale-[0.98]"
              >
                Try AI Intelligence
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638l-3.96-3.697a.75.75 0 0 1 1.024-1.096l5.25 4.9a.75.75 0 0 1 0 1.097l-5.25 4.9a.75.75 0 0 1-1.024-1.097l3.96-3.697H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="py-16 lg:py-24">
        <div className="mb-12 text-center animate-slide-up [animation-delay:0.1s] [animation-fill-mode:both]">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-cyan-600">Simple Workflow</p>
          <h2 className="mt-3 font-display text-4xl font-[1000] tracking-tight text-slate-900 sm:text-5xl">
            Three steps to{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-blue-600">genius</span>
          </h2>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <div
              key={step.number}
              className="group relative animate-slide-up [animation-fill-mode:both]"
              style={{ animationDelay: `${0.15 + i * 0.1}s` }}
            >
              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div className="absolute top-8 left-[calc(50%+48px)] hidden h-px w-[calc(100%-48px)] bg-gradient-to-r from-cyan-200 to-transparent md:block" />
              )}

              <div className="flex flex-col items-center text-center">
                <div className="relative mb-6">
                  <div className="absolute -inset-3 rounded-full bg-gradient-to-br from-cyan-100 to-blue-100 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-cyan-600 to-blue-600 text-xl font-[1000] text-white shadow-xl shadow-cyan-600/20 transition-transform duration-300 group-hover:scale-110">
                    {step.number}
                  </div>
                </div>
                <h3 className="text-xl font-[1000] tracking-tight text-slate-900">{step.title}</h3>
                <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-slate-500 font-medium">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ FINAL CTA SECTION ═══ */}
      <section className="py-12 lg:py-20">
        <div className="relative overflow-hidden rounded-[40px] bg-slate-900 px-8 py-16 text-center shadow-2xl sm:px-16 sm:py-24">
          {/* Animated background background */}
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.15),transparent_50%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.15),transparent_50%)]" />
          
          <h2 className="mx-auto max-w-3xl font-display text-4xl font-[1000] leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            Ready to transform your{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">learning experience?</span>
          </h2>
          
          <p className="mx-auto mt-8 max-w-2xl text-lg text-slate-400 font-medium leading-relaxed">
            Join SKS today and unlock the power of AI-driven knowledge management. 
            Built for students, researchers, and lifelong learners.
          </p>
          
          <div className="mt-12 flex flex-col items-center justify-center gap-6 sm:flex-row">
            <Link
              to="/app"
              className="group inline-flex items-center gap-3 rounded-2xl bg-white px-10 py-5 text-[15px] font-[1000] tracking-wide text-slate-900 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(255,255,255,0.1)] active:scale-[0.98]"
            >
              Get Started for Free
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 transition-transform group-hover:translate-x-1">
                <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638l-3.96-3.697a.75.75 0 0 1 1.024-1.096l5.25 4.9a.75.75 0 0 1 0 1.097l-5.25 4.9a.75.75 0 0 1-1.024-1.097l3.96-3.697H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ ACADEMIC FOOTER ═══ */}
      <footer className="relative mt-20 bg-slate-50/50 pb-10 pt-20">
        {/* Subtle top accent line */}
        <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
        
        <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8 border-b border-slate-200/50 pb-16">
            {/* Col 1: Brand */}
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xl transition-transform hover:scale-105">
                  <span className="font-display text-[16px] font-black italic text-cyan-400">S</span>
                </div>
                <span className="text-xl font-black tracking-tight text-slate-900">SKS</span>
              </div>
              <p className="max-w-xs text-[14px] leading-relaxed text-slate-500 font-medium">
                SKS is an intelligent knowledge ecosystem leveraging Gemini AI to transform how researchers and students organize information.
              </p>
              <div className="flex items-center gap-3">
                <a href="#" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-all hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300">
                  <svg className="h-4.5 w-4.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
                </a>
              </div>
            </div>

            {/* Col 2: Platform */}
            <div className="flex flex-col gap-7">
              <h4 className="text-[11px] font-[1000] uppercase tracking-[0.25em] text-slate-800">Platform</h4>
              <ul className="flex flex-col gap-3.5">
                {['Workspace', 'Favorites', 'Smart Search', 'AI Summaries'].map(item => (
                  <li key={item}>
                    <a href="#" className="text-[14px] font-bold text-slate-500 transition-colors hover:text-cyan-600">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 3: Tech Stack */}
            <div className="flex flex-col gap-7">
              <h4 className="text-[11px] font-[1000] uppercase tracking-[0.25em] text-slate-800">Technical</h4>
              <ul className="flex flex-col gap-4">
                {[
                  { name: 'Google Gemini Pro', desc: 'AI Intelligence' },
                  { name: 'React & Tailwind', desc: 'Modern UX Stack' },
                  { name: 'Node.js Hub', desc: 'Secure Backend' }
                ].map(tech => (
                  <li key={tech.name} className="flex gap-3">
                    <div className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-500" />
                    <div className="flex flex-col">
                      <span className="text-[14px] font-bold text-slate-700 leading-none">{tech.name}</span>
                      <span className="mt-1 text-[11px] font-medium text-slate-400">{tech.desc}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 4: About */}
            <div className="flex flex-col gap-7">
              <h4 className="text-[11px] font-[1000] uppercase tracking-[0.25em] text-slate-800">Development</h4>
              <div className="group relative rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:border-cyan-300 hover:shadow-lg hover:shadow-cyan-500/5">
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Academic Project</span>
                <p className="text-[15px] font-[1000] text-slate-900 leading-relaxed uppercase tracking-tight">
                  SS2-Group 10
                </p>
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Institution</span>
                  <p className="text-[13px] font-bold text-indigo-600 italic">Smart Knowledge Academy</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-8 flex flex-col items-center justify-between gap-6 pt-2 sm:flex-row">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <p className="text-[12px] font-black uppercase tracking-widest text-slate-400">
                © 2026 SKS System
              </p>
            </div>
            <div className="flex gap-10">
              <a href="#" className="text-[11px] font-black uppercase tracking-widest text-slate-400 transition-colors hover:text-slate-900">Terms</a>
              <a href="#" className="text-[11px] font-black uppercase tracking-widest text-slate-400 transition-colors hover:text-slate-900">Privacy</a>
              <a href="#" className="text-[11px] font-black uppercase tracking-widest text-slate-400 transition-colors hover:text-slate-900">Academic Use</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
