const fs = require('fs');
let code = fs.readFileSync('src/components/documents/UploadModal.jsx', 'utf8');

// 1. Add isSuccess state
if (!code.includes('const [isSuccess, setIsSuccess] = useState(false);')) {
  code = code.replace(
    'const [isUploading, setIsUploading] = useState(false);',
    'const [isUploading, setIsUploading] = useState(false);\n  const [isSuccess, setIsSuccess] = useState(false);'
  );
}

// 2. Clear isSuccess in initial clear effect
code = code.replace(
  'setSelectedFolderId(defaultFolderId || "");\n    setError("");',
  'setSelectedFolderId(defaultFolderId || "");\n    setError("");\n    setIsSuccess(false);'
);

// 3. Update handleSubmit
const oldHandleSubmit = `    setIsUploading(true);
    setError("");

    try {
      await onUploadSuccess(file, title || file.name, selectedFolderId || null);
      setFile(null);
      setTitle("");
      setSelectedFolderId(defaultFolderId || "");
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message || "Upload failed. Please try again.",
      );
    } finally {
      setIsUploading(false);
    }`;

const newHandleSubmit = `    setIsUploading(true);
    setError("");

    try {
      await onUploadSuccess(file, title || file.name, selectedFolderId || null);
      setIsUploading(false);
      setIsSuccess(true);
      setTimeout(() => {
        setFile(null);
        setTitle("");
        setSelectedFolderId(defaultFolderId || "");
        setIsSuccess(false);
        onClose();
      }, 1800);
    } catch (err) {
      setIsUploading(false);
      setError(
        err.response?.data?.message || "Upload failed. Please try again.",
      );
    }`;

code = code.replace(oldHandleSubmit, newHandleSubmit);

// 4. Update the title logic
const oldTitleLogic = `{isUploading ? "Integrating Data..." : "Upload Form"}`;
const newTitleLogic = `{isSuccess ? "Success" : isUploading ? "Integrating Data..." : "Upload Form"}`;
code = code.replace(oldTitleLogic, newTitleLogic);

// 5. Update the close button disabled logic
code = code.replace(
  'onClick={isUploading ? undefined : onClose}',
  'onClick={isUploading || isSuccess ? undefined : onClose}'
).replace(
  'disabled={isUploading}',
  'disabled={isUploading || isSuccess}'
).replace(
  'isUploading\n                    ? "opacity-0 scale-90 pointer-events-none"',
  '(isUploading || isSuccess)\n                    ? "opacity-0 scale-90 pointer-events-none"'
);

// 6. Update the right panel UI logic
const oldUI = `            {isUploading ? (
    <div className="flex flex-col items-center justify-center py-10 animate-in fade-in zoom-in-95 duration-500 min-h-[300px]">`;

const newUI = `            {isSuccess ? (
              <div className="flex flex-col items-center justify-center py-10 animate-in fade-in zoom-in-95 duration-500 min-h-[300px]">
                <div className="relative mb-8 flex h-24 w-24 items-center justify-center">
                  <div className="absolute inset-0 rounded-full border border-emerald-400 bg-emerald-50 shadow-[0_0_40px_rgba(52,211,153,0.3)] animate-in zoom-in duration-500" />
                  <svg className="relative h-12 w-12 text-emerald-500 animate-in zoom-in duration-500 delay-150" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-[14px] font-[1000] text-emerald-600 uppercase tracking-[0.2em] mb-2 animate-in slide-in-from-bottom-2">
                  Integration Complete
                </h3>
                <p className="text-[12px] font-medium text-slate-500 max-w-[240px] text-center">
                  Document successfully synchronized with the neural network.
                </p>
              </div>
            ) : isUploading ? (
    <div className="flex flex-col items-center justify-center py-10 animate-in fade-in zoom-in-95 duration-500 min-h-[300px]">`;

code = code.replace(oldUI, newUI);

fs.writeFileSync('src/components/documents/UploadModal.jsx', code);
console.log("Updated UploadModal with Success Mode!");
