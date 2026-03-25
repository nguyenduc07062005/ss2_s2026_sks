import logo from '../assets/logo.png';

const BrandBadge = ({ variant = 'teal', className = '' }) => {
  const theme =
    variant === 'blue'
      ? 'from-blue-100 via-sky-50 to-white'
      : 'from-teal-100 via-cyan-50 to-white';

  return (
    <div
      className={`relative flex items-center justify-center rounded-full border border-white/80 bg-white/55 shadow-[0_18px_45px_rgba(148,163,184,0.16)] backdrop-blur ${className}`.trim()}
    >
      <div className={`absolute inset-[10%] rounded-full bg-gradient-to-br ${theme}`} />
      <div
        className="relative h-[56%] w-[56%] rounded-full border border-white/80 bg-white bg-no-repeat shadow-[inset_0_2px_16px_rgba(148,163,184,0.16)]"
        style={{
          backgroundImage: `url(${logo})`,
          backgroundPosition: '18% center',
          backgroundSize: '170%',
        }}
      />
    </div>
  );
};

export default BrandBadge;
