/**
 * SKSMark — abstract "knowledge layers" logomark.
 * Three rounded bars of decreasing width stacked vertically.
 */
const SKSMark = ({ size = 36 }) => {
  const radius = Math.round(size * 0.26);

  return (
    <div
      style={{ width: size, height: size, borderRadius: radius }}
      className="relative flex shrink-0 items-center justify-center overflow-hidden
                 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400
                 shadow-lg shadow-blue-500/35"
    >
      <div
        style={{ borderRadius: radius }}
        className="pointer-events-none absolute inset-0
                   bg-[radial-gradient(ellipse_at_30%_20%,rgba(255,255,255,0.28),transparent_65%)]"
      />
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '62%', height: '62%' }}
        className="relative z-10"
        aria-hidden="true"
      >
        <rect x="4" y="6" width="24" height="5.5" rx="2.75" fill="white" />
        <rect x="7" y="13.25" width="18" height="5.5" rx="2.75" fill="white" fillOpacity="0.72" />
        <rect x="11" y="20.5" width="10" height="5.5" rx="2.75" fill="white" fillOpacity="0.44" />
      </svg>
    </div>
  );
};

/**
 * BrandBadge — icon + wordmark lockup.
 * `dark` prop switches text to white for use on gradient/dark backgrounds.
 */
const BrandBadge = ({ className = '', size = 36, dark = false }) => (
  <div className={`inline-flex items-center gap-3 select-none ${className}`.trim()}>
    <SKSMark size={size} />
    <div className="flex flex-col leading-none">
      <span
        className={`text-[13px] font-black ${dark ? 'text-white' : 'text-slate-900'}`}
        style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '-0.03em' }}
      >
        Smart Knowledge
      </span>
      <span
        className={`mt-[3px] text-[8px] font-semibold uppercase tracking-[0.22em] ${dark ? 'text-white/55' : 'text-slate-400'}`}
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        System
      </span>
    </div>
  </div>
);

export { SKSMark };
export default BrandBadge;
