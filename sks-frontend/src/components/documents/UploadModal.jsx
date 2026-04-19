import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

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
      toast.success("Document uploaded & processed successfully!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Upload failed. Please try again.");
      setError(err.response?.data?.message || "Upload failed. Please try again.");
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
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/60 px-6 py-10 pt-28 backdrop-blur-xl"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[640px] overflow-hidden rounded-[32px] border border-white/20 bg-white shadow-[0_45px_120px_-20px_rgba(15,23,42,0.5)] animate-in fade-in zoom-in duration-300"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grid sm:grid-cols-[0.38fr_0.62fr]">
          {/* Left panel */}
          <div className="relative flex flex-col justify-between overflow-hidden border-r border-slate-100 bg-gradient-to-br from-cyan-50 via-slate-50 to-blue-50 px-7 py-6">
            <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-cyan-400/20 blur-2xl" />
            <div className="absolute -right-10 top-1/2 h-32 w-32 rounded-full bg-blue-400/10 blur-2xl" />

            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-600/80">
                Intake
              </p>
              <h2 className="mt-2 text-2xl font-[1000] leading-tight tracking-tight text-slate-900">
                Upload a <br />
                <span className="bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">
                  new file
                </span>
              </h2>
              <p className="ml-0.5 mt-3 text-[13px] font-medium leading-relaxed text-slate-500/90">
                Add PDF, DOCX, or TXT content instantly for AI analysis.
              </p>
            </div>

            <div className="relative z-10 mt-8 flex flex-col gap-2">
              {[
                { label: "Formats", value: "PDF / DOCX / TXT" },
                { label: "Size Limit", value: "10 MB" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-white bg-white/70 px-4 py-2.5 shadow-[0_8px_30px_-5px_rgba(148,163,184,0.15)] backdrop-blur-md"
                >
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400/80">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xs font-[1000] text-slate-800">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right panel */}
          <div className="px-7 py-6 sm:px-8">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-[11px] font-[1000] uppercase tracking-[0.2em] text-slate-400 transition-all">
                {isUploading ? "Integrating Data..." : "Upload Form"}
              </p>
              <button
                onClick={isUploading ? undefined : onClose}
                disabled={isUploading}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                  isUploading
                    ? "pointer-events-none scale-90 opacity-0"
                    : "bg-slate-100/80 text-slate-500 hover:rotate-90 hover:bg-rose-50 hover:text-rose-600 active:scale-90"
                }`}
                aria-label="Close"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-5.5 w-5.5"
                >
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>

            {isUploading ? (
              <div className="min-h-[300px] animate-in fade-in zoom-in-95 duration-500 flex flex-col items-center justify-center py-10">
                <div className="relative mb-8 flex h-32 w-32 items-center justify-center">
                  <div className="absolute inset-0 animate-[spin_4s_linear_infinite] rounded-full border border-cyan-400/20 shadow-[0_0_20px_rgba(34,211,238,0.2)]" />
                  <div className="absolute -inset-2 animate-[spin_6s_linear_infinite_reverse] rounded-full border border-dashed border-blue-500/30" />
                  <div className="absolute -inset-4 animate-[spin_8s_linear_infinite] rounded-full border border-cyan-300/10" />
                  <div
                    className="absolute h-20 w-20 animate-pulse rounded-full bg-cyan-400/20 blur-xl"
                    style={{ animationDuration: "2s" }}
                  />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-[1.2rem] bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-[0_0_30px_rgba(6,182,212,0.4)]">
                    <svg
                      className="h-7 w-7 animate-pulse"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.742 3.742 0 0115.75 19.5H6.75z"
                      />
                    </svg>
                  </div>
                  <div className="absolute bottom-0 top-0 left-1/2 w-20 -translate-x-1/2 overflow-hidden rounded-full">
                    <div className="absolute left-0 right-0 h-1 animate-[bounce_2s_infinite] bg-white/70 blur-[1px]" />
                  </div>
                </div>

                <h3 className="mb-2 animate-pulse text-[13px] font-[1000] uppercase tracking-[0.3em] text-slate-900">
                  Processing & Embedding
                </h3>
                <p className="max-w-[220px] text-center text-[11px] font-medium leading-relaxed text-slate-400">
                  Extracting structural knowledge and synchronizing with AI
                  memory cortex...
                </p>
                <div className="mt-8 flex gap-1.5">
                  <div
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-400"
                    style={{ animationDelay: "0ms" }}
                  />
                  <div
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-500"
                    style={{ animationDelay: "150ms" }}
                  />
                  <div
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div
                  className={`group/drop relative cursor-pointer overflow-hidden rounded-[24px] border-2 border-dashed p-6 text-center transition-all duration-500 ${
                    isDragOver
                      ? "border-cyan-500 bg-cyan-50/50 shadow-[0_0_40px_-10px_rgba(6,182,212,0.3)]"
                      : file
                        ? "border-cyan-400 bg-cyan-50/20"
                        : "border-slate-200 bg-slate-50/50 hover:border-cyan-400 hover:bg-white hover:shadow-2xl hover:shadow-cyan-500/5"
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
                    <div className="relative z-10 space-y-3">
                      <div className="mx-auto flex h-12 w-12 animate-in zoom-in duration-300 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-[9px] font-black tracking-widest text-white shadow-xl shadow-cyan-500/25 ring-4 ring-cyan-50">
                        {file.name.split(".").pop()?.slice(0, 4).toUpperCase() ||
                          "FILE"}
                      </div>
                      <div>
                        <p className="truncate text-sm font-[1000] text-slate-900">
                          {file.name}
                        </p>
                        <p className="mt-0.5 text-[11px] font-bold text-slate-400">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          clearFile();
                        }}
                        className="rounded-xl bg-rose-50 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-rose-500 transition-all hover:bg-rose-100 hover:text-rose-600 active:scale-95"
                      >
                        Remove and switch
                      </button>
                    </div>
                  ) : (
                    <div className="relative z-10 space-y-3">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0_10px_30px_-5px_rgba(0,0,0,0.1)] transition-all duration-500 group-hover/drop:scale-110 group-hover/drop:rotate-6 group-hover/drop:shadow-cyan-500/20">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-50 text-cyan-600">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="h-6 w-6"
                          >
                            <path d="M9.25 13.25a.75.75 0 0 0 1.5 0V4.636l2.955 3.129a.75.75 0 0 0 1.09-1.03l-4.25-4.5a.75.75 0 0 0-1.09 0l-4.25 4.5a.75.75 0 1 0 1.09 1.03L9.25 4.636v8.614Z" />
                            <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
                          </svg>
                        </div>
                      </div>
                      <div>
                        <p className="text-[16px] font-[1000] text-slate-800">
                          Drop file locally
                        </p>
                        <p className="mt-0.5 text-xs font-medium text-slate-400">
                          or click to browse your library
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="ml-1.5 flex items-center gap-2 text-[11px] font-[1000] uppercase tracking-wider text-slate-400">
                      Document Title
                    </label>
                    <input
                      type="text"
                      placeholder="Project specs..."
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-5 py-3.5 text-sm font-bold text-slate-900 shadow-inner outline-none transition-all focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/5"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="ml-1.5 flex items-center gap-2 text-[11px] font-[1000] uppercase tracking-wider text-slate-400">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-3.5 w-3.5"
                      >
                        <path d="M3.75 3A1.75 1.75 0 0 0 2 4.75v10.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0 0 18 15.25v-8.5A1.75 1.75 0 0 0 16.25 5h-4.836a.25.25 0 0 1-.177-.073L9.823 3.513A1.75 1.75 0 0 0 8.586 3H3.75Z" />
                      </svg>
                      Save to Folder
                    </label>
                    <div className="relative">
                      <select
                        value={selectedFolderId}
                        onChange={(event) =>
                          setSelectedFolderId(event.target.value)
                        }
                        className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50/50 px-5 py-3.5 text-sm font-bold text-slate-900 shadow-inner outline-none transition-all focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/5"
                      >
                        {folders.map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {`${"\u00A0".repeat(folder.depth * 4)}${
                              folder.depth === 0 ? "Workspace" : folder.name
                            }`}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="h-5 w-5"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="animate-in slide-in-from-top-2 duration-300 flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50/50 px-4 py-3 text-xs font-bold text-rose-600">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-4 w-4 shrink-0"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isUploading || !file}
                  className="group relative mt-2 w-full overflow-hidden rounded-[20px] bg-slate-900 p-px shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:scale-100 disabled:opacity-50"
                >
                  <div className="absolute inset-0 animate-gradient bg-[length:200%_100%] bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-500 opacity-0 transition-opacity group-hover:opacity-100" />
                  <div
                    className={`relative flex h-[52px] items-center justify-center rounded-[19px] px-5 text-sm font-[1000] tracking-wide text-white transition-all ${
                      isUploading
                        ? "bg-transparent"
                        : "bg-gradient-to-r from-cyan-600 to-blue-600"
                    }`}
                  >
                    <span className="flex items-center gap-2 drop-shadow-md">
                      {isUploading ? (
                        <>
                          <svg
                            className="h-4 w-4 animate-spin text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          Transmitting...
                        </>
                      ) : (
                        <>
                          Upload Document
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="h-4 w-4 transition-transform group-hover:translate-x-1"
                          >
                            <path
                              fillRule="evenodd"
                              d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </>
                      )}
                    </span>
                  </div>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadModal;
