const fs = require('fs');
let code = fs.readFileSync('src/components/documents/UploadModal.jsx', 'utf8');

const replacement = `{isUploading ? (
    <div className="flex flex-col items-center justify-center py-10 animate-in fade-in zoom-in-95 duration-500 min-h-[300px]">
      <div className="relative mb-8 flex h-32 w-32 items-center justify-center">
        <div className="absolute inset-0 rounded-full border border-cyan-400/20 shadow-[0_0_20px_rgba(34,211,238,0.2)] animate-[spin_4s_linear_infinite]" />
        <div className="absolute -inset-2 rounded-full border border-dashed border-blue-500/30 animate-[spin_6s_linear_infinite_reverse]" />
        <div className="absolute -inset-4 rounded-full border border-cyan-300/10 animate-[spin_8s_linear_infinite]" />
        <div className="absolute h-20 w-20 animate-pulse rounded-full bg-cyan-400/20 blur-xl" style={{ animationDuration: '2s' }} />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-[1.2rem] bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-[0_0_30px_rgba(6,182,212,0.4)]">
          <svg className="h-7 w-7 animate-pulse" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.742 3.742 0 0115.75 19.5H6.75z" />
          </svg>
        </div>
        <div className="absolute top-0 bottom-0 left-1/2 w-20 -translate-x-1/2 overflow-hidden rounded-full">
          <div className="absolute left-0 right-0 h-1 bg-white/70 blur-[1px] animate-[bounce_2s_infinite]" />
        </div>
      </div>
      <h3 className="text-[13px] font-[1000] text-slate-900 uppercase tracking-[0.3em] mb-2 animate-pulse">
        Processing & Embedding
      </h3>
      <p className="text-[11px] font-medium text-slate-400 max-w-[220px] text-center leading-relaxed">
        Extracting structural knowledge and synchronizing with AI memory cortex...
      </p>
      <div className="mt-8 flex gap-1.5">
        <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  ) : (
    <form className="space-y-4" onSubmit={handleSubmit}>
      $1
    </form>
  )}`;

code = code.replace(
  /<form className="space-y-4" onSubmit=\{handleSubmit\}>([\s\S]*?)<\/form>/,
  replacement
);

fs.writeFileSync('src/components/documents/UploadModal.jsx', code);
console.log("Updated UploadModal.jsx");
