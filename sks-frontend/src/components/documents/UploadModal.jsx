import { useEffect, useMemo, useRef, useState } from "react";

const UploadModal = ({
  isOpen,
  onClose,
  onUploadSuccess,
  folders = [],
  defaultFolderId = "",
}) => {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const acceptedTypes = useMemo(
    () => [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ],
    [],
  );

  const maxFileSize = 10 * 1024 * 1024;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSelectedFolderId(defaultFolderId || "");
    setError("");
  }, [defaultFolderId, isOpen]);

  if (!isOpen) {
    return null;
  }

  const validateSelectedFile = (selectedFile) => {
    if (!selectedFile) {
      return null;
    }

    if (!acceptedTypes.includes(selectedFile.type)) {
      return "Only PDF, DOCX, or TXT files are supported.";
    }

    if (selectedFile.size > maxFileSize) {
      return "File size must be 10MB or smaller.";
    }

    return null;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) {
      return "0 Bytes";
    }

    const base = 1024;
    const units = ["Bytes", "KB", "MB", "GB"];
    const index = Math.floor(Math.log(bytes) / Math.log(base));
    return `${parseFloat((bytes / Math.pow(base, index)).toFixed(2))} ${units[index]}`;
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleFileAccepted = (selectedFile) => {
    setFile(selectedFile);
    setTitle((currentTitle) => currentTitle || selectedFile.name);
    setError("");
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    const droppedFile = event.dataTransfer.files[0];
    const validationError = validateSelectedFile(droppedFile);

    if (droppedFile && !validationError) {
      handleFileAccepted(droppedFile);
      return;
    }

    setError(validationError || "Please select a valid file.");
  };

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    const validationError = validateSelectedFile(selectedFile);

    if (selectedFile && !validationError) {
      handleFileAccepted(selectedFile);
      return;
    }

    setFile(null);
    setError(validationError || "Please select a valid file.");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!file) {
      setError("Please select a file to upload.");
      return;
    }

    setIsUploading(true);
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
    }
  };

  const clearFile = () => {
    setFile(null);
    setTitle("");
    setSelectedFolderId(defaultFolderId || "");
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/40 px-6 py-20 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[600px] rounded-[32px] border border-white/60 bg-white shadow-[0_45px_120px_-20px_rgba(15,23,42,0.35)] overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grid sm:grid-cols-[0.4fr_0.6fr]">
          {/* Left Panel: Info */}
          <div className="bg-[linear-gradient(145deg,rgba(236,254,255,0.95),rgba(248,250,252,0.98),rgba(239,246,255,0.95))] px-6 py-8 border-r border-slate-100/50">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-600/80">
              Intake
            </p>
            <h2 className="mt-3 text-2xl font-[1000] leading-tight text-slate-900 tracking-tight">
              Upload a <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">new file</span>
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-500">
              Add PDF, DOCX, or TXT content instantly.
            </p>

            <div className="mt-6 flex flex-col gap-3">
              {[
                { label: "Formats", value: "PDF / DOCX / TXT" },
                { label: "Size Limit", value: "10 MB" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-[20px] border border-white bg-white/60 px-4 py-3 shadow-[0_8px_20px_-4px_rgba(148,163,184,0.1)] backdrop-blur-sm"
                >
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-800">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Panel: Form */}
          <div className="px-6 py-8 sm:px-8">
            <div className="flex items-center justify-between mb-6">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                Upload Form
              </p>
              <button
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div
                className={`group/drop rounded-[28px] border-2 border-dashed p-6 text-center transition-all duration-300 cursor-pointer ${
                  isDragOver
                    ? "border-cyan-500 bg-cyan-50/50 shadow-[0_0_30px_-5px_rgba(6,182,212,0.2)]"
                    : file
                      ? "border-cyan-300 bg-cyan-50/30"
                      : "border-slate-200 bg-slate-50/50 hover:border-cyan-400 hover:bg-white hover:shadow-xl hover:shadow-cyan-500/5"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {file ? (
                  <div className="space-y-4">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-[10px] font-black tracking-widest shadow-lg shadow-cyan-500/20">
                      {file.name.split(".").pop()?.slice(0, 4).toUpperCase() || "FILE"}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-slate-900">{file.name}</p>
                      <p className="mt-1 text-[11px] font-bold text-slate-400">{formatFileSize(file.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); clearFile(); }}
                      className="text-[11px] font-black uppercase tracking-wider text-rose-500 hover:text-rose-600 transition-colors"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-white shadow-lg shadow-slate-200/50 transition-transform group-hover/drop:scale-110 group-hover/drop:rotate-3">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7 text-cyan-500">
                        <path d="M9.25 13.25a.75.75 0 0 0 1.5 0V4.636l2.955 3.129a.75.75 0 0 0 1.09-1.03l-4.25-4.5a.75.75 0 0 0-1.09 0l-4.25 4.5a.75.75 0 1 0 1.09 1.03L9.25 4.636v8.614Z" />
                        <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-base font-bold text-slate-800">Drop file locally</p>
                      <p className="mt-1 text-[11px] font-bold text-slate-400">or click to browse</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 ml-1">Document Title</label>
                  <input
                    type="text"
                    placeholder="Project specs..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-[18px] border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition-all focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/5 placeholder:text-slate-300"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 ml-1">Save to Folder</label>
                  <select
                    value={selectedFolderId}
                    onChange={(e) => setSelectedFolderId(e.target.value)}
                    className="w-full rounded-[18px] border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition-all focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/5"
                  >
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {`${"\u00A0".repeat(folder.depth * 4)}${folder.depth === 0 ? "Workspace" : folder.name}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {error && (
                <div className="rounded-2xl border border-rose-100 bg-rose-50/50 px-4 py-3 text-xs font-bold text-rose-600">
                  {error}
                </div>
              )}

              <button
                className="w-full rounded-[20px] bg-gradient-to-r from-cyan-500 via-cyan-600 to-blue-600 px-5 py-4 text-[16px] font-[1000] tracking-wide text-white shadow-xl shadow-cyan-600/30 transition-all hover:shadow-2xl hover:shadow-cyan-600/40 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40"
                type="submit"
                disabled={isUploading || !file}
              >
                <span className="drop-shadow-md">
                  {isUploading ? "Syncing..." : "Upload Document"}
                </span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadModal;
