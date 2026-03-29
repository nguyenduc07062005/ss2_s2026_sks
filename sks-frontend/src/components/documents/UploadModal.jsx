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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl overflow-hidden rounded-[36px] border border-white/80 bg-white shadow-[0_45px_140px_rgba(15,23,42,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
          <div className="bg-[linear-gradient(145deg,rgba(240,253,250,0.92),rgba(248,250,252,0.96),rgba(239,246,255,0.92))] px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-teal-700">
              Document Intake
            </p>
            <h2 className="mt-3 text-4xl font-bold leading-none text-slate-950 sm:text-5xl">
              Upload a new file
            </h2>
            <p className="mt-4 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
              Add PDF, DOCX, or TXT content to your workspace.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                { label: "Formats", value: "PDF / DOCX / TXT" },
                { label: "Max size", value: "10 MB" },
                { label: "After upload", value: "Stored + chunked" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-[24px] border border-white/80 bg-white/85 px-4 py-4 shadow-[0_16px_40px_rgba(148,163,184,0.12)]"
                >
                  <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-slate-400">
                    {item.label}
                  </p>
                  <p className="mt-2 text-base font-bold leading-6 text-slate-900">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">
                  Upload Form
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-500 transition hover:bg-slate-200"
              >
                Close
              </button>
            </div>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <div
                className={`rounded-[28px] border-2 border-dashed px-6 py-8 text-center transition ${
                  isDragOver
                    ? "border-teal-500 bg-teal-50"
                    : file
                      ? "border-teal-300 bg-teal-50/70"
                      : "border-slate-200 bg-slate-50 hover:border-teal-400 hover:bg-white"
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
                  <div className="space-y-3">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-white text-sm font-extrabold tracking-[0.24em] text-teal-700 shadow-[0_10px_30px_rgba(20,184,166,0.16)]">
                      {file.name.split(".").pop()?.slice(0, 4).toUpperCase() ||
                        "FILE"}
                    </div>
                    <div>
                      <p className="truncate text-lg font-bold text-slate-900">
                        {file.name}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        clearFile();
                      }}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-white shadow-[0_12px_30px_rgba(148,163,184,0.16)]">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-8 w-8 text-teal-600"
                      >
                        <path d="M9.25 13.25a.75.75 0 0 0 1.5 0V4.636l2.955 3.129a.75.75 0 0 0 1.09-1.03l-4.25-4.5a.75.75 0 0 0-1.09 0l-4.25 4.5a.75.75 0 1 0 1.09 1.03L9.25 4.636v8.614Z" />
                        <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-900">
                        Drag and drop your file here
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        or click to choose a file from your computer
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  Document title
                </span>
                <input
                  type="text"
                  placeholder="Example: Project proposal 2026"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  Save to folder
                </span>
                <select
                  value={selectedFolderId}
                  onChange={(event) => setSelectedFolderId(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100"
                >
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {`${"\u00A0".repeat(folder.depth * 4)}${folder.depth === 0 ? "Root" : folder.name}`}
                    </option>
                  ))}
                </select>
              </label>

              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  {error}
                </div>
              )}

              <button
                className="w-full rounded-2xl bg-teal-600 px-5 py-4 text-base font-bold text-white shadow-lg shadow-teal-500/30 transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={isUploading || !file}
              >
                {isUploading ? "Uploading document..." : "Upload document"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadModal;
