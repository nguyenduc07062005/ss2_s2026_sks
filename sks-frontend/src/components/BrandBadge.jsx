import logo from '../assets/logo.png';

const BrandBadge = ({ className = '' }) => {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-[24px] bg-transparent ${className}`.trim()}
    >
      <div className="absolute inset-0 rounded-[24px] bg-white/72 shadow-[0_18px_40px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/70 backdrop-blur-sm" />
      <img
        src={logo}
        alt="Smart Knowledge System"
        className="relative h-[98%] w-[99%] object-contain"
      />
    </div>
  );
};

export default BrandBadge;
