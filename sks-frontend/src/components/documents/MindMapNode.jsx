import { Handle, Position } from '@xyflow/react';

const EyeIcon = ({ className = 'h-3.5 w-3.5' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M1.75 10s2.85-5 8.25-5 8.25 5 8.25 5-2.85 5-8.25 5-8.25-5-8.25-5Z"
    />
    <circle cx="10" cy="10" r="2.5" />
  </svg>
);

const EyeOffIcon = ({ className = 'h-3.5 w-3.5' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.5 2.5 17.5 17.5M8.9 5.18A9.37 9.37 0 0 1 10 5c5.4 0 8.25 5 8.25 5a14.25 14.25 0 0 1-3.1 3.66M11.92 11.93A2.5 2.5 0 0 1 8.07 8.08M6.35 6.36A14.47 14.47 0 0 0 1.75 10s2.85 5 8.25 5c1.29 0 2.42-.29 3.42-.74"
    />
  </svg>
);

const STYLE_BY_KIND = {
  root: 'bg-violet-100 text-slate-900 border-violet-200 shadow-[0_20px_50px_-26px_rgba(124,58,237,0.38)]',
  overview: 'bg-sky-100 text-slate-900 border-sky-200 shadow-[0_18px_44px_-24px_rgba(14,165,233,0.32)]',
  cluster: 'bg-sky-100 text-slate-900 border-sky-200 shadow-[0_18px_44px_-24px_rgba(14,165,233,0.28)]',
  insight: 'bg-sky-50 text-slate-900 border-sky-200 shadow-[0_18px_44px_-24px_rgba(14,165,233,0.2)]',
  detail: 'bg-slate-50 text-slate-900 border-slate-200 shadow-[0_18px_40px_-24px_rgba(100,116,139,0.18)]',
  takeaway: 'bg-emerald-100 text-slate-900 border-emerald-200 shadow-[0_18px_44px_-24px_rgba(16,185,129,0.24)]',
};

const HANDLE_CLASS =
  '!h-0 !w-0 !border-0 !bg-transparent !opacity-0';

function MindMapNode({ data }) {
  const styleClass = STYLE_BY_KIND[data.kind] ?? STYLE_BY_KIND.insight;
  const selectedClass = data.isSelected
    ? 'ring-4 ring-sky-200/90 scale-[1.01]'
    : 'ring-0';
  const canToggle = Boolean(data.showToggle);

  const handleToggle = (event) => {
    event.stopPropagation();
    data.onSelect?.(data.id);
    data.onToggle?.(data.id);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={`nopan group relative flex min-h-[76px] min-w-[180px] max-w-[310px] cursor-pointer items-center justify-between gap-3 rounded-[18px] border px-5 py-4 transition-all duration-200 hover:-translate-y-0.5 ${styleClass} ${selectedClass}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold leading-snug tracking-tight">
          {data.label}
        </p>
      </div>

      {canToggle && (
        <button
          type="button"
          onClick={handleToggle}
          className="nodrag nopan flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/88 text-slate-700 shadow-sm transition-all hover:scale-105 hover:bg-white"
          title={data.isExpanded ? 'Hide child nodes' : 'Reveal child nodes'}
        >
          {data.isExpanded ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      )}

      <Handle type="target" position={Position.Left} className={HANDLE_CLASS} />
      <Handle type="source" position={Position.Right} className={HANDLE_CLASS} />
    </div>
  );
}

export default MindMapNode;
