const fs = require('fs');
let code = fs.readFileSync('src/components/documents/UploadModal.jsx', 'utf8');

code = code.replace(
  /onClick=\{onClose\}\n\s+className="inline-flex h-9 w-9/g,
  `onClick={onClose}\n                disabled={isUploading}\n                className={"inline-flex h-9 w-9 " + (isUploading ? "opacity-0 scale-90 pointer-events-none " : "") + "`
);

code = code.replace(
  `onClick={onClose}
    >`,
  `onClick={isUploading ? undefined : onClose}
    >`
);

code = code.replace(
  `<p className="text-[11px] font-[1000] uppercase tracking-[0.2em] text-slate-400">
                Upload Form
              </p>`,
  `<p className="text-[11px] font-[1000] uppercase tracking-[0.2em] text-slate-400 transition-all">
                {isUploading ? "Integrating Data..." : "Upload Form"}
              </p>`
);

fs.writeFileSync('src/components/documents/UploadModal.jsx', code);
console.log("Updated Close logic");
