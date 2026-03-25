import BrandLogo from '../BrandLogo.jsx';

const variants = {
  teal: {
    shell: 'bg-gradient-to-br from-teal-600 via-teal-500 to-emerald-500',
    glow: 'bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_60%)]',
    orb1: 'bg-white/10',
    orb2: 'bg-teal-300/20',
    accentText: 'text-teal-50',
    divider: 'from-white/40 to-transparent',
    dot: 'bg-white shadow-[0_0_0_8px_rgba(255,255,255,0.15)]',
    btnBg: 'bg-white/15 border-white/25',
    features: [
      { icon: '📄', text: 'Quản lý tài liệu thông minh' },
      { icon: '🤖', text: 'Tóm tắt & phân tích bằng AI' },
      { icon: '💬', text: 'Hỏi đáp trực tiếp với tài liệu' },
    ],
  },
  blue: {
    shell: 'bg-gradient-to-br from-indigo-600 via-blue-600 to-violet-600',
    glow: 'bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]',
    orb1: 'bg-white/10',
    orb2: 'bg-blue-300/20',
    accentText: 'text-blue-50',
    divider: 'from-white/40 to-transparent',
    dot: 'bg-white shadow-[0_0_0_8px_rgba(255,255,255,0.15)]',
    btnBg: 'bg-white/15 border-white/25',
    features: [
      { icon: '🔒', text: 'Tài khoản bảo mật cá nhân' },
      { icon: '🗂️', text: 'Không gian làm việc riêng' },
      { icon: '🚀', text: 'Bắt đầu miễn phí ngay hôm nay' },
    ],
  },
};

const AuthShowcase = ({ title, description, variant = 'teal' }) => {
  const theme = variants[variant];

  return (
    <div
      className={`relative overflow-hidden border-b border-white/10 p-12 xl:border-b-0 xl:border-r xl:p-16 ${theme.shell}`}
    >
      {/* Background effects */}
      <div className={`absolute inset-0 ${theme.glow}`} />
      <div className={`absolute -top-32 -right-32 h-96 w-96 rounded-full blur-3xl ${theme.orb1}`} />
      <div className={`absolute -bottom-24 -left-24 h-80 w-80 rounded-full blur-3xl ${theme.orb2}`} />

      {/* Content */}
      <div className="relative flex h-full flex-col justify-between gap-12">
        <div>
          {/* Logo – app icon lớn, rõ chữ */}
          <div className="mb-8 flex justify-start">
            <div className="flex h-32 w-32 items-center justify-center rounded-3xl bg-white p-2.5 shadow-2xl ring-2 ring-white/30">
              <BrandLogo className="h-full w-full" />
            </div>
          </div>

          {/* Brand name */}
          <p className="text-xs font-bold uppercase tracking-widest text-white/60">
            Smart Knowledge System
          </p>

          {/* Title – 1 dòng */}
          <h1 className="mt-4 text-3xl font-bold leading-tight text-white sm:text-4xl">
            {title}
          </h1>

          {/* Description */}
          <p className={`mt-5 text-lg leading-8 ${theme.accentText}`}>
            {description}
          </p>

          {/* Feature list */}
          <ul className="mt-10 space-y-4">
            {theme.features.map((f, i) => (
              <li key={i} className="flex items-center gap-4">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-lg ${theme.btnBg}`}>
                  {f.icon}
                </span>
                <span className="text-base font-medium text-white/90">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom divider */}
        <div className="flex items-center gap-3">
          <div className={`h-px flex-1 bg-gradient-to-r ${theme.divider}`} />
          <div className={`h-2.5 w-2.5 rounded-full ${theme.dot}`} />
        </div>
      </div>
    </div>
  );
};

export default AuthShowcase;
