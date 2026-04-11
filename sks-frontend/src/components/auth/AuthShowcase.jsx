import BrandLogo from "../BrandLogo.jsx";

const variants = {
  teal: {
    shell: "bg-gradient-to-br from-cyan-600 via-sky-500 to-blue-600",
    glow: "bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_60%)]",
    orb1: "bg-white/10",
    orb2: "bg-cyan-300/20",
    accentText: "text-sky-50",
    divider: "from-white/40 to-transparent",
    dot: "bg-white shadow-[0_0_0_8px_rgba(255,255,255,0.15)]",
    btnBg: "bg-white/15 border-white/25",
    features: [
      { icon: "📄", text: "Smart Document Management" },
      { icon: "🤖", text: "AI-Powered Summaries" },
      { icon: "💬", text: "Chat with your Documents" },
    ],
  },
  blue: {
    shell: "bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-600",
    glow: "bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]",
    orb1: "bg-white/10",
    orb2: "bg-sky-300/20",
    accentText: "text-sky-50",
    divider: "from-white/40 to-transparent",
    dot: "bg-white shadow-[0_0_0_8px_rgba(255,255,255,0.15)]",
    btnBg: "bg-white/15 border-white/25",
    features: [
      { icon: "🔒", text: "Secure Personal Account" },
      { icon: "🗂️", text: "Private Workspace" },
      { icon: "✨", text: "AI-Powered Intelligence" },
    ],
  },
};

const AuthShowcase = ({ title, description, variant = "teal" }) => {
  const theme = variants[variant];

  return (
    <div
      className={`relative overflow-hidden border-b border-white/10 p-6 xl:border-b-0 xl:border-r xl:p-8 ${theme.shell}`}
    >
      <div className={`absolute inset-0 ${theme.glow}`} />
      <div
        className={`absolute -top-32 -right-32 h-96 w-96 rounded-full blur-3xl ${theme.orb1}`}
      />
      <div
        className={`absolute -bottom-24 -left-24 h-80 w-80 rounded-full blur-3xl ${theme.orb2}`}
      />

      {/* Animated grid dots overlay */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative flex h-full flex-col justify-between gap-12">
        <div>
          <div className="mb-4 flex justify-start">
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white p-2 shadow-2xl ring-4 ring-white/20">
              <BrandLogo className="h-full w-full" />
            </div>
          </div>

          <p className="text-xs font-bold uppercase tracking-widest text-white/60">
            Smart Knowledge System
          </p>

          <h1 className="mt-2 text-2xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-3xl lg:text-4xl">
            {title}
          </h1>

          <p className={`mt-2 text-[13px] leading-5 ${theme.accentText}`}>
            {description}
          </p>

          <ul className="mt-10 space-y-4">
            {theme.features.map((feature, index) => (
              <li key={index} className="flex items-center gap-4">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-lg ${theme.btnBg}`}
                >
                  {feature.icon}
                </span>
                <span className="text-base font-medium text-white/90">
                  {feature.text}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-3">
          <div className={`h-px flex-1 bg-gradient-to-r ${theme.divider}`} />
          <div className={`h-2.5 w-2.5 rounded-full ${theme.dot}`} />
        </div>
      </div>
    </div>
  );
};

export default AuthShowcase;
