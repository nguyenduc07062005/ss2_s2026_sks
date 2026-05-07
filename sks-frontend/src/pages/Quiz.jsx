import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useNavigate } from "react-router-dom";
import { getDocuments } from "../service/documentAPI.js";
import {
  clearQuizChatHistory,
  generateQuiz,
  getQuizChatHistory,
  sendQuizChatMessage,
} from "../service/ragAPI.js";
import { getUserIdFromToken } from "../utils/auth.js";

const MAX_SELECTED_DOCUMENTS = 8;
const LANGUAGES = [
  { value: "en", label: "EN" },
  { value: "vi", label: "VI" },
];
const QUESTION_COUNTS = [5, 10, 15];
const DIFFICULTIES = [
  { value: "easy", label: "Easy", color: "emerald" },
  { value: "medium", label: "Medium", color: "amber" },
  { value: "hard", label: "Hard", color: "rose" },
];
const QUESTION_TYPES = [
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "true_false", label: "True / False" },
];
const DEFAULT_QUIZ_FORM = {
  language: "en",
  questionCount: 5,
  difficulty: "medium",
  questionType: "multiple_choice",
};
const QUIZ_SESSION_STORAGE_PREFIX = "sks.quiz-session";
const QUIZ_SESSION_STORAGE_VERSION = 1;
const createEmptyChatState = () => ({ loading: false, clearing: false, error: "", items: [], pendingQuestion: "" });

/* ─── SVG Icon wrapper ─── */
const Icon = ({ children, className = "h-5 w-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" className={className} aria-hidden="true">
    {children}
  </svg>
);

const SparklesIcon = (p) => <Icon {...p}><path d="m12 3 1.2 3.3L16.5 7.5l-3.3 1.2L12 12l-1.2-3.3L7.5 7.5l3.3-1.2L12 3Z"/><path d="m18 13 .8 2.2L21 16l-2.2.8L18 19l-.8-2.2L15 16l2.2-.8L18 13Z"/><path d="m5 14 .8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Z"/></Icon>;
const FileIcon = (p) => <Icon {...p}><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/><path d="M8 13h8"/><path d="M8 17h5"/></Icon>;
const CheckIcon = (p) => <Icon {...p}><path d="m20 6-11 11-5-5"/></Icon>;
const XIcon = (p) => <Icon {...p}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></Icon>;
const SendIcon = (p) => <Icon {...p}><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></Icon>;
const TrashIcon = (p) => <Icon {...p}><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></Icon>;
const ArrowRightIcon = (p) => <Icon {...p}><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></Icon>;
const CloseIcon = (p) => <Icon {...p}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></Icon>;
const SearchIcon = (p) => <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></Icon>;
const ChevronDownIcon = (p) => <Icon {...p}><path d="m6 9 6 6 6-6"/></Icon>;
const BookOpenIcon = (p) => <Icon {...p}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></Icon>;
const GlobeIcon = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 3a14.5 14.5 0 0 0 0 18 14.5 14.5 0 0 0 0-18"/><path d="M3 12h18"/></Icon>;
const LayersIcon = (p) => <Icon {...p}><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 12-8.57 3.91a2 2 0 0 1-1.66 0L3 12"/><path d="m22 17-8.57 3.91a2 2 0 0 1-1.66 0L3 17"/></Icon>;
const FlameIcon = (p) => <Icon {...p}><path d="M8.5 14.5A3.5 3.5 0 0 0 12 18a3.5 3.5 0 0 0 3.5-3.5c0-1.5-.5-2-1-3.5-.5 1.5-2 2.5-3 2.5s-2-1-2.5-2.5C8 12.5 8.5 13 8.5 14.5Z"/><path d="M12 22c-4.2 0-8-3.22-8-8 0-1.7.5-3.3 1.5-4.7C7 11 7.5 12 9 12c1.8 0 3-2 3-4 0 2.5 2.5 5 5 3.3.7 1.1 1 2.3 1 3.7 0 4.78-3.8 8-8 8z"/></Icon>;
const RefreshIcon = (p) => <Icon {...p}><path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4"/></Icon>;

/* ─── Markdown renderer ─── */
const mdComponents = {
  p: ({ children }) => <p className="mb-3 text-[14px] font-medium leading-[1.8] text-slate-700 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 list-disc space-y-2 pl-5 text-[14px] font-medium leading-[1.8] text-slate-700 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 list-decimal space-y-2 pl-5 text-[14px] font-medium leading-[1.8] text-slate-700 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="pl-1 marker:text-cyan-500">{children}</li>,
  strong: ({ children }) => <strong className="font-black text-slate-900">{children}</strong>,
  code: ({ inline, children }) => inline
    ? <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] font-semibold text-slate-800">{children}</code>
    : <code className="font-mono text-[12px] text-slate-100">{children}</code>,
  pre: ({ children }) => <pre className="mb-3 overflow-x-auto rounded-2xl bg-slate-900 px-4 py-3 text-[12px] leading-6 text-slate-100 last:mb-0">{children}</pre>,
};

/* ─── Helpers ─── */
const getDocumentTitle = (doc) => doc?.documentName || doc?.title || "Untitled document";
const normalizeText = (v = "") => String(v).replace(/\s+/g, " ").trim();
const canUseStorage = () => {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
};
const getQuizSessionStorageKey = () => {
  const userId = getUserIdFromToken();
  return `${QUIZ_SESSION_STORAGE_PREFIX}:${userId || "anonymous"}`;
};
const isPlainObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const isValidQuizPayload = (value) => (
  isPlainObject(value) &&
  typeof value.quizId === "string" &&
  Array.isArray(value.documents) &&
  Array.isArray(value.questions)
);
const readStoredQuizSession = () => {
  if (!canUseStorage()) return null;

  try {
    const rawValue = window.localStorage.getItem(getQuizSessionStorageKey());
    const parsedValue = rawValue ? JSON.parse(rawValue) : null;

    if (
      !isPlainObject(parsedValue) ||
      parsedValue.version !== QUIZ_SESSION_STORAGE_VERSION ||
      !isValidQuizPayload(parsedValue.quiz)
    ) {
      return null;
    }

    return {
      quiz: parsedValue.quiz,
      answers: isPlainObject(parsedValue.answers) ? parsedValue.answers : {},
      activeQuestionIndex: Number.isInteger(parsedValue.activeQuestionIndex)
        ? Math.max(0, parsedValue.activeQuestionIndex)
        : 0,
      showResults: Boolean(parsedValue.showResults),
      selectedDocumentIds: Array.isArray(parsedValue.selectedDocumentIds)
        ? parsedValue.selectedDocumentIds.filter((id) => typeof id === "string")
        : parsedValue.quiz.documents.map((document) => document.id).filter(Boolean),
      form: {
        ...DEFAULT_QUIZ_FORM,
        ...(isPlainObject(parsedValue.form) ? parsedValue.form : {}),
      },
    };
  } catch {
    return null;
  }
};
const writeStoredQuizSession = ({ quiz, answers, activeQuestionIndex, showResults, selectedDocumentIds, form }) => {
  if (!canUseStorage() || !isValidQuizPayload(quiz)) return;

  try {
    window.localStorage.setItem(
      getQuizSessionStorageKey(),
      JSON.stringify({
        version: QUIZ_SESSION_STORAGE_VERSION,
        savedAt: new Date().toISOString(),
        quiz,
        answers,
        activeQuestionIndex,
        showResults,
        selectedDocumentIds,
        form,
      }),
    );
  } catch {
    // Ignore storage failures so the quiz UI remains usable.
  }
};
const clearStoredQuizSession = () => {
  if (!canUseStorage()) return;

  try {
    window.localStorage.removeItem(getQuizSessionStorageKey());
  } catch {
    // Ignore storage failures so the quiz UI remains usable.
  }
};
const formatTimestamp = (v) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};
const buildExplainPrompt = ({ question, selectedOption, correctOption, isCorrect }) =>
  [
    `I am taking a quiz about this document and received this question: ${question.question}`,
    `I selected: ${selectedOption?.text || "not specified"}.`,
    `The correct answer is: ${correctOption?.text || "not specified"}.`,
    `My answer was ${isCorrect ? "correct" : "incorrect"}.`,
    "Please explain why the correct answer is right and why the other choices are wrong.",
  ].join("\n");

/* ─── Small reusable components ─── */
const Badge = ({ children, color = "slate" }) => {
  const colors = {
    slate: "bg-slate-100 text-slate-500",
    cyan: "bg-cyan-50 text-cyan-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
  };
  return (
    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${colors[color] || colors.slate}`}>
      {children}
    </span>
  );
};

const SegmentedControl = ({ options, value, onChange }) => (
  <div className="grid gap-1 rounded-xl bg-slate-100 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
    {options.map((opt) => (
      <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
        className={`min-h-9 rounded-lg px-2 text-[11px] font-black transition ${value === opt.value ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>
        {opt.label}
      </button>
    ))}
  </div>
);

/* ─── Empty State ─── */
const EmptyQuiz = ({ documentsCount, onOpenConfig, onGoWorkspace }) => (
  <div className="grid min-h-[calc(100vh-160px)] place-items-center px-6">
    <div className="w-full max-w-[460px] py-16 text-center">
      <div className="relative mb-10">
        <div className="absolute -inset-8 animate-pulse rounded-full bg-cyan-100/40" />
        <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-2xl shadow-cyan-500/30">
          <BookOpenIcon className="h-8 w-8" />
        </div>
      </div>
      <p className="text-[13px] font-[1000] uppercase tracking-[0.24em] text-slate-900">SKS Quiz</p>
      <h1 className="mt-4 text-3xl font-[1000] leading-tight text-slate-950">Test your knowledge</h1>
      <p className="mx-auto mt-4 max-w-[320px] text-[12px] font-medium leading-6 text-slate-400">
        {documentsCount > 0 ? `${documentsCount} documents ready.` : "Upload documents first."}
      </p>
      <button type="button" onClick={documentsCount > 0 ? onOpenConfig : onGoWorkspace}
        className="group relative mt-10 flex h-14 w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 px-8 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-cyan-500/20 transition-all hover:scale-[1.02] active:scale-95">
        <span>{documentsCount > 0 ? "Create Quiz" : "Open Workspace"}</span>
        <SparklesIcon className="h-4 w-4 transition-transform group-hover:rotate-12" />
      </button>
    </div>
  </div>
);

/* ─── Loading State ─── */
const QuizLoading = () => (
  <div className="grid min-h-[calc(100vh-160px)] place-items-center px-6">
    <div className="flex flex-col items-center py-16 text-center">
      <div className="relative mb-10 flex h-36 w-36 items-center justify-center">
        <div className="absolute inset-0 rounded-full border border-slate-200/80" />
        <div className="absolute inset-5 rounded-full border border-slate-200/50" />
        <div className="absolute inset-0 animate-[spin_4s_linear_infinite]">
          <span className="absolute left-1/2 top-0 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.85)]" />
        </div>
        <div className="absolute inset-5 animate-[spin_3s_linear_infinite_reverse]">
          <span className="absolute bottom-0 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-blue-500 shadow-[0_0_14px_rgba(59,130,246,0.75)]" />
        </div>
        <div className="relative flex h-20 w-20 items-center justify-center rounded-[1.8rem] bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-2xl shadow-cyan-500/20">
          <BookOpenIcon className="h-8 w-8" />
        </div>
      </div>
      <h2 className="text-[13px] font-[1000] uppercase tracking-[0.3em] text-slate-900">Generating Quiz</h2>
      <p className="mt-3 max-w-[320px] text-[12px] font-medium leading-6 text-slate-400">AI is analyzing documents and creating questions...</p>
      <div className="mt-8 flex gap-2">
        <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-cyan-400 [animation-delay:0ms]" />
        <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-cyan-500 [animation-delay:150ms]" />
        <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-blue-500 [animation-delay:300ms]" />
      </div>
    </div>
  </div>
);

/* ─── Config Modal ─── */
const QuizConfigModal = ({ open, documents, form, selectedDocumentIds, generating, error, onClose, onSubmit, onFormChange, onToggleDocument, onGoWorkspace }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [docQuery, setDocQuery] = useState("");

  if (!open) return null;

  const selectedCount = selectedDocumentIds.length;
  const normalizedQuery = docQuery.trim().toLowerCase();
  const visibleDocs = normalizedQuery
    ? documents.filter((d) => getDocumentTitle(d).toLowerCase().includes(normalizedQuery))
    : documents;
  const selectedDocs = documents.filter((d) => selectedDocumentIds.includes(d.id));
  const previewLabel = selectedDocs.length > 0 ? `${selectedDocs.length} selected` : "Choose documents";

  const handleClose = () => { setDropdownOpen(false); setDocQuery(""); onClose(); };
  const handleSubmit = (e) => { setDropdownOpen(false); setDocQuery(""); onSubmit(e); };

  return (
    <div className="fixed inset-0 z-[170] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-md">
      <form onSubmit={handleSubmit} className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[32px] border border-white/20 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
              <BookOpenIcon className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-[12px] font-black uppercase tracking-[0.28em] text-slate-900">Quiz Setup</h2>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-600">{selectedCount}/8 documents</p>
            </div>
          </div>
          <button type="button" onClick={handleClose} disabled={generating}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-40">
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>
          )}

          {/* Documents */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                <FileIcon className="h-3.5 w-3.5" />Documents
              </p>
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-600">{selectedCount}/8</span>
            </div>
            {documents.length === 0 ? (
              <button type="button" onClick={onGoWorkspace}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-xs font-black uppercase tracking-[0.18em] text-slate-500 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700">
                <FileIcon className="h-4 w-4" />Workspace
              </button>
            ) : (
              <>
                <button type="button" onClick={() => setDropdownOpen((v) => !v)}
                  className={`flex h-14 w-full items-center gap-3 rounded-2xl border px-4 text-left transition hover:border-cyan-300 hover:bg-cyan-50 ${selectedCount > 0 ? "border-cyan-200 bg-cyan-50/70" : "border-slate-200 bg-slate-50"}`}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-cyan-600 shadow-sm">
                    <FileIcon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-slate-950">{previewLabel}</span>
                    <span className="block truncate text-xs font-semibold text-slate-400">
                      {selectedDocs.slice(0, 2).map(getDocumentTitle).join(", ")}
                      {selectedDocs.length > 2 ? ` +${selectedDocs.length - 2}` : ""}
                    </span>
                  </span>
                  <ChevronDownIcon className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
                </button>
                {dropdownOpen && (
                  <div className="mt-2 overflow-hidden rounded-3xl border border-slate-200 bg-white p-2 shadow-lg">
                    <label className="flex h-10 items-center gap-2 rounded-2xl bg-slate-50 px-3 text-slate-400">
                      <SearchIcon className="h-4 w-4 shrink-0" />
                      <input type="text" value={docQuery} onChange={(e) => setDocQuery(e.target.value)} placeholder="Search documents"
                        className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400" />
                    </label>
                    <div className="mt-2 max-h-[200px] space-y-1 overflow-y-auto pr-1">
                      {visibleDocs.length === 0 ? (
                        <div className="px-3 py-5 text-center text-xs font-black uppercase tracking-[0.18em] text-slate-400">No documents found</div>
                      ) : visibleDocs.map((doc) => {
                        const sel = selectedDocumentIds.includes(doc.id);
                        const dis = !sel && selectedDocumentIds.length >= MAX_SELECTED_DOCUMENTS;
                        return (
                          <button key={doc.id} type="button" disabled={dis} onClick={() => onToggleDocument(doc.id)}
                            className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${sel ? "bg-cyan-50 text-slate-950" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}>
                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${sel ? "border-cyan-500 bg-cyan-500 text-white" : "border-slate-300 bg-white text-transparent"}`}>
                              {sel ? <CheckIcon className="h-4 w-4" /> : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-black">{getDocumentTitle(doc)}</span>
                              <span className="block truncate text-[11px] font-semibold text-slate-400">{doc.folderName || "Workspace"} / {doc.formattedFileSize || "File"}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {selectedDocs.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedDocs.slice(0, 4).map((doc) => (
                      <span key={doc.id} className="max-w-full truncate rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700">
                        {getDocumentTitle(doc)}
                      </span>
                    ))}
                    {selectedDocs.length > 4 && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">+{selectedDocs.length - 4}</span>}
                  </div>
                )}
              </>
            )}
          </section>

          {/* Questions count */}
          <section>
            <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              <LayersIcon className="h-3.5 w-3.5" />Questions
            </p>
            <SegmentedControl options={QUESTION_COUNTS.map((c) => ({ value: c, label: String(c) }))} value={form.questionCount} onChange={(questionCount) => onFormChange({ questionCount })} />
          </section>

          {/* Difficulty */}
          <section>
            <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              <FlameIcon className="h-3.5 w-3.5" />Difficulty
            </p>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTIES.map((d) => {
                const sel = form.difficulty === d.value;
                const colorMap = { easy: "border-emerald-300 bg-emerald-50 text-emerald-700 shadow-emerald-100", medium: "border-amber-300 bg-amber-50 text-amber-700 shadow-amber-100", hard: "border-rose-300 bg-rose-50 text-rose-700 shadow-rose-100" };
                return (
                  <button key={d.value} type="button" onClick={() => onFormChange({ difficulty: d.value })}
                    className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl border px-2 text-center transition hover:-translate-y-0.5 ${sel ? colorMap[d.value] + " shadow-lg" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"}`}>
                    <FlameIcon className="h-4 w-4" />
                    <span className="text-xs font-black">{d.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Type */}
          <section>
            <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              <CheckIcon className="h-3.5 w-3.5" />Question Type
            </p>
            <SegmentedControl options={QUESTION_TYPES} value={form.questionType} onChange={(questionType) => onFormChange({ questionType })} />
          </section>

          {/* Language */}
          <section>
            <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              <GlobeIcon className="h-3.5 w-3.5" />Language
            </p>
            <SegmentedControl options={LANGUAGES} value={form.language} onChange={(language) => onFormChange({ language })} />
          </section>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-4">
          <div className={`flex h-10 items-center gap-2 rounded-2xl px-3 text-xs font-black ${selectedCount > 0 ? "bg-cyan-50 text-cyan-700" : "bg-slate-100 text-slate-400"}`}>
            <FileIcon className="h-4 w-4" />{selectedCount}/8
          </div>
          <button type="submit" disabled={generating || selectedCount === 0}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 px-5 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-xl shadow-cyan-500/20 transition hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100">
            {generating ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <SparklesIcon className="h-4 w-4" />}
            {generating ? "Generating..." : "Create Quiz"}
          </button>
        </div>
      </form>
    </div>
  );
};

/* ─── Quiz Panel ─── */
const QuizPanel = ({ quizState, questions, activeQuestion, activeAnswer, activeQuestionIndex, answers, isFinished, isLastQuestion, chatLoading, chatOpen, onToggleChat, onSelectAnswer, onNextQuestion, onRestartQuiz, onNewQuiz, onExplain }) => {
  if (!quizState.data || questions.length === 0) return null;

  const correctCount = questions.filter((q) => answers[q.id]?.isCorrect).length;

  if (isFinished) {
    const pct = Math.round((correctCount / questions.length) * 100);
    const color = pct >= 80 ? "emerald" : pct >= 50 ? "amber" : "rose";
    const colorMap = { emerald: "text-emerald-600 bg-emerald-50 border-emerald-200", amber: "text-amber-600 bg-amber-50 border-amber-200", rose: "text-rose-600 bg-rose-50 border-rose-200" };
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className={`mb-6 rounded-2xl border px-6 py-8 text-center ${colorMap[color]}`}>
          <p className={`text-[60px] font-[1000] leading-none ${color === "emerald" ? "text-emerald-600" : color === "amber" ? "text-amber-600" : "text-rose-600"}`}>{pct}%</p>
          <p className="mt-2 text-sm font-black text-slate-700">{correctCount}/{questions.length} correct</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={onRestartQuiz} className="rounded-xl border border-slate-200 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-600 transition hover:bg-slate-50">
            <RefreshIcon className="mx-auto mb-1 h-4 w-4" />Retry
          </button>
          <button type="button" onClick={onNewQuiz} className="rounded-xl bg-slate-900 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-white transition hover:bg-slate-800">
            <BookOpenIcon className="mx-auto mb-1 h-4 w-4" />New Quiz
          </button>
        </div>
      </div>
    );
  }

  const correctOption = activeQuestion.options.find((o) => o.id === activeQuestion.correctOptionId);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Progress header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-600">
            Question {activeQuestionIndex + 1} / {questions.length}
          </p>
          <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all"
              style={{ width: `${((activeQuestionIndex + 1) / questions.length) * 100}%` }} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge color={quizState.data.difficulty === "easy" ? "emerald" : quizState.data.difficulty === "hard" ? "rose" : "amber"}>
            {quizState.data.difficulty}
          </Badge>
          <Badge>{quizState.data.questionType.replace("_", " ")}</Badge>
          <button type="button" onClick={onToggleChat}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] transition ${chatOpen ? "bg-cyan-500 text-white shadow-sm shadow-cyan-200" : "bg-cyan-50 text-cyan-600 hover:bg-cyan-100"}`}
            title={chatOpen ? "Close AI Chat" : "Open AI Chat"}>
            <SparklesIcon className="h-3.5 w-3.5" />Chat ai
          </button>
        </div>
      </div>

      <div className="p-5">
        <h2 className="text-xl font-black leading-tight tracking-tight text-slate-950">{activeQuestion.question}</h2>

        <div className="mt-5 space-y-3">
          {activeQuestion.options.map((option) => {
            const selected = activeAnswer?.selectedOptionId === option.id;
            const correct = activeQuestion.correctOptionId === option.id;
            const showResult = Boolean(activeAnswer);
            const tone = !showResult
              ? "border-slate-200 bg-white text-slate-700 hover:border-cyan-200 hover:bg-cyan-50"
              : correct ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : selected ? "border-rose-300 bg-rose-50 text-rose-800"
              : "border-slate-200 bg-slate-50 text-slate-400";
            return (
              <button key={option.id} type="button" onClick={() => onSelectAnswer(option)} disabled={Boolean(activeAnswer)}
                className={`flex w-full items-center gap-4 rounded-xl border px-4 py-4 text-left transition ${tone}`}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80 text-sm font-black">{option.id}</span>
                <span className="min-w-0 flex-1 text-sm font-bold leading-6">{option.text}</span>
                {showResult && correct ? <CheckIcon className="h-5 w-5 shrink-0 text-emerald-500" /> : null}
                {showResult && selected && !correct ? <XIcon className="h-5 w-5 shrink-0 text-rose-500" /> : null}
              </button>
            );
          })}
        </div>

        {activeAnswer ? (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className={`text-sm font-black ${activeAnswer.isCorrect ? "text-emerald-700" : "text-rose-700"}`}>
              {activeAnswer.isCorrect ? "✓ Correct!" : "✗ Not quite"}
            </p>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{activeQuestion.explanation}</p>
            {activeQuestion.sourceSnippet ? (
              <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-semibold leading-5 text-slate-500 italic">"{activeQuestion.sourceSnippet}"</p>
            ) : null}
            {!activeAnswer.isCorrect && correctOption ? (
              <p className="mt-3 text-sm font-bold text-slate-700">Correct answer: {correctOption.text}</p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={onExplain} disabled={!activeAnswer || chatLoading}
            className="flex items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-cyan-700 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-40">
            <SparklesIcon className="h-3.5 w-3.5" />Explain
          </button>
          <button type="button" onClick={onNextQuestion} disabled={!activeAnswer}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
            {isLastQuestion ? "View Results" : "Next"}
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Main Quiz Component ─── */
const Quiz = () => {
  const navigate = useNavigate();
  const chatThreadRef = useRef(null);
  const chatResetVersionRef = useRef(0);
  const quizPanelRef = useRef(null);
  const restoredQuizSessionRef = useRef(readStoredQuizSession());
  const restoredQuizSession = restoredQuizSessionRef.current;
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState(() => restoredQuizSession?.selectedDocumentIds || []);
  const [configOpen, setConfigOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [form, setForm] = useState(() => restoredQuizSession?.form || DEFAULT_QUIZ_FORM);
  const [quizState, setQuizState] = useState(() => ({ loading: false, error: "", data: restoredQuizSession?.quiz || null }));
  const [answers, setAnswers] = useState(() => restoredQuizSession?.answers || {});
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(() => restoredQuizSession?.activeQuestionIndex || 0);
  const [showResults, setShowResults] = useState(() => Boolean(restoredQuizSession?.showResults));
  const [chatInput, setChatInput] = useState("");
  const [chatState, setChatState] = useState(createEmptyChatState);
  const [quizPanelHeight, setQuizPanelHeight] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setDocumentsLoading(true);
        const [docResult, historyResult] = await Promise.all([getDocuments(1, 100), getQuizChatHistory()]);
        if (!active) return;
        const nextDocs = docResult.documents || [];
        setDocuments(nextDocs);
        setSelectedDocumentIds((ids) => ids.length > 0 ? ids.filter((id) => nextDocs.some((d) => d.id === id)) : nextDocs.slice(0, 1).map((d) => d.id));
        setChatState((s) => ({ ...s, items: historyResult.items || [], error: "" }));
      } catch (err) {
        if (!active) return;
        setQuizState((s) => ({ ...s, error: err.response?.data?.message || "Could not load data." }));
      } finally {
        if (active) setDocumentsLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!chatThreadRef.current) return;
    chatThreadRef.current.scrollTop = chatThreadRef.current.scrollHeight;
  }, [chatState.items.length, chatState.pendingQuestion, chatState.loading]);

  useEffect(() => {
    const panel = quizPanelRef.current;

    if (!panel || typeof ResizeObserver === "undefined") return undefined;

    const updateHeight = () => {
      const nextHeight = Math.ceil(panel.getBoundingClientRect().height);
      setQuizPanelHeight(nextHeight > 0 ? nextHeight : null);
    };
    const observer = new ResizeObserver(updateHeight);

    updateHeight();
    observer.observe(panel);

    return () => observer.disconnect();
  }, [chatOpen, quizState.data, activeQuestionIndex, showResults, answers]);

  const questions = quizState.data?.questions || [];
  const activeQuestion = questions[activeQuestionIndex] || null;
  const activeAnswer = activeQuestion ? answers[activeQuestion.id] : null;
  const answeredCount = Object.keys(answers).length;
  const isFinished = showResults && questions.length > 0 && answeredCount === questions.length;
  const isLastQuestion = questions.length > 0 && activeQuestionIndex === questions.length - 1;
  const activeDocumentIds = quizState.data?.documents?.map((d) => d.id) || selectedDocumentIds;

  useEffect(() => {
    if (!quizState.data) return;

    writeStoredQuizSession({
      quiz: quizState.data,
      answers,
      activeQuestionIndex,
      showResults,
      selectedDocumentIds: quizState.data.documents.map((document) => document.id).filter(Boolean),
      form,
    });
  }, [quizState.data, answers, activeQuestionIndex, showResults, form]);

  useEffect(() => {
    if (questions.length > 0 && activeQuestionIndex >= questions.length) {
      setActiveQuestionIndex(questions.length - 1);
    }
  }, [activeQuestionIndex, questions.length]);

  const updateForm = (patch) => setForm((f) => ({ ...f, ...patch }));

  const toggleDocument = (id) => {
    setSelectedDocumentIds((ids) => {
      if (ids.includes(id)) return ids.filter((x) => x !== id);
      if (ids.length >= MAX_SELECTED_DOCUMENTS) {
        setQuizState((s) => ({ ...s, error: `Select up to ${MAX_SELECTED_DOCUMENTS} documents.` }));
        return ids;
      }
      return [...ids, id];
    });
  };

  const handleGenerateQuiz = async ({ regenerate = false } = {}) => {
    if (quizState.loading) return;
    if (selectedDocumentIds.length === 0) {
      setQuizState((s) => ({ ...s, error: "Please select at least one document." }));
      return;
    }
    try {
      setConfigOpen(false);
      setQuizState((s) => ({ ...s, loading: true, error: "" }));
      const result = await generateQuiz({ documentIds: selectedDocumentIds, language: form.language, questionCount: Number(form.questionCount), difficulty: form.difficulty, questionType: form.questionType, forceRefresh: regenerate });
      await clearQuizChatForNewQuiz();
      writeStoredQuizSession({
        quiz: result,
        answers: {},
        activeQuestionIndex: 0,
        showResults: false,
        selectedDocumentIds,
        form,
      });
      setQuizState({ loading: false, error: "", data: result });
      setAnswers({});
      setActiveQuestionIndex(0);
      setShowResults(false);
      setChatOpen(false);
    } catch (err) {
      setQuizState((s) => ({ ...s, loading: false, error: err.response?.data?.message || "Could not create quiz." }));
      setConfigOpen(true);
    }
  };

  const handleSelectAnswer = (option) => {
    if (!activeQuestion || activeAnswer) return;
    setAnswers((a) => ({ ...a, [activeQuestion.id]: { selectedOptionId: option.id, isCorrect: option.id === activeQuestion.correctOptionId } }));
  };

  const handleNextQuestion = () => {
    if (isLastQuestion) { setShowResults(true); return; }
    setActiveQuestionIndex((i) => Math.min(i + 1, questions.length - 1));
  };

  const resetQuizChatState = () => {
    chatResetVersionRef.current += 1;
    setChatInput("");
    setChatState(createEmptyChatState());
  };

  const clearQuizChatForNewQuiz = async () => {
    resetQuizChatState();
    try {
      await clearQuizChatHistory();
    } catch (err) {
      setChatState((s) => ({ ...s, error: err.response?.data?.message || "Could not clear old chat history." }));
    }
  };

  const handleRestartQuiz = () => { setAnswers({}); setActiveQuestionIndex(0); setShowResults(false); };
  const handleNewQuiz = () => { clearStoredQuizSession(); setQuizState({ loading: false, error: "", data: null }); setAnswers({}); setActiveQuestionIndex(0); setShowResults(false); setChatOpen(false); void clearQuizChatForNewQuiz(); };

  const handleSendChat = async (question) => {
    const q = normalizeText(question);
    if (!q || chatState.loading) return;
    if (activeDocumentIds.length === 0) { setChatState((s) => ({ ...s, error: "Select documents before asking." })); return; }
    const requestVersion = chatResetVersionRef.current;
    try {
      setChatState((s) => ({ ...s, loading: true, error: "", pendingQuestion: q }));
      const result = await sendQuizChatMessage({ documentIds: activeDocumentIds, question: q });
      if (requestVersion !== chatResetVersionRef.current) return;
      setChatState((s) => ({ ...s, loading: false, items: [...s.items, result.historyItem].slice(-20), pendingQuestion: "" }));
      setChatInput("");
    } catch (err) {
      if (requestVersion !== chatResetVersionRef.current) return;
      setChatState((s) => ({ ...s, loading: false, pendingQuestion: "", error: err.response?.data?.message || "AI could not answer." }));
    }
  };

  const handleExplain = () => {
    if (!activeQuestion || !activeAnswer) return;
    const selectedOption = activeQuestion.options.find((o) => o.id === activeAnswer.selectedOptionId);
    const correctOption = activeQuestion.options.find((o) => o.id === activeQuestion.correctOptionId);
    setChatOpen(true);
    void handleSendChat(buildExplainPrompt({ question: activeQuestion, selectedOption, correctOption, isCorrect: activeAnswer.isCorrect }));
  };

  const handleClearChat = async () => {
    if (chatState.clearing || chatState.loading) return;
    try {
      setChatState((s) => ({ ...s, clearing: true, error: "" }));
      await clearQuizChatHistory();
      resetQuizChatState();
    } catch (err) {
      setChatState((s) => ({ ...s, clearing: false, error: err.response?.data?.message || "Could not clear history." }));
    }
  };

  const quizPanelProps = { quizState, questions, activeQuestion, activeAnswer, activeQuestionIndex, answers, isFinished, isLastQuestion, chatLoading: chatState.loading, chatOpen, onToggleChat: () => setChatOpen((open) => !open), onSelectAnswer: handleSelectAnswer, onNextQuestion: handleNextQuestion, onRestartQuiz: handleRestartQuiz, onNewQuiz: handleNewQuiz, onExplain: handleExplain };

  /* ── Empty / Loading states ── */
  if (documentsLoading) return <QuizLoading />;
  if (quizState.loading) return <QuizLoading />;

  if (!quizState.data) {
    return (
      <>
        <EmptyQuiz documentsCount={documents.length} onOpenConfig={() => setConfigOpen(true)} onGoWorkspace={() => navigate("/app")} />
        <QuizConfigModal
          open={configOpen}
          documents={documents}
          form={form}
          selectedDocumentIds={selectedDocumentIds}
          generating={quizState.loading}
          error={quizState.error}
          onClose={() => { setConfigOpen(false); setQuizState((s) => ({ ...s, error: "" })); }}
          onSubmit={(e) => { e.preventDefault(); void handleGenerateQuiz(); }}
          onFormChange={updateForm}
          onToggleDocument={toggleDocument}
          onGoWorkspace={() => navigate("/app")}
        />
      </>
    );
  }

  /* ── Active layout: two columns ── */
  return (
    <div className="pb-10">
      {/* Mini top bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white">
            <BookOpenIcon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-600">SKS Quiz</p>
            <p className="text-xs font-bold text-slate-500 truncate max-w-[260px]">
              {quizState.data.documents.map((d) => d.title).join(", ")}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setConfigOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 transition hover:bg-slate-50">
            <RefreshIcon className="h-3.5 w-3.5" />New
          </button>
        </div>
      </div>

      <div className={`grid gap-5 ${chatOpen ? "lg:grid-cols-[minmax(340px,400px)_minmax(0,1fr)]" : "lg:grid-cols-1"}`}>
        {chatOpen ? (
        <section
          className="flex min-h-0 self-stretch flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          style={quizPanelHeight ? { height: `${quizPanelHeight}px` } : undefined}
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-100 px-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-600">Chat ai</p>
              <p className="text-[11px] font-semibold text-slate-400">Ask about your quiz</p>
            </div>
            <div className="flex items-center gap-1">
              {chatState.items.length > 0 && (
                <button type="button" onClick={() => void handleClearChat()} disabled={chatState.clearing || chatState.loading}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-40" title="Clear history">
                  {chatState.clearing ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <TrashIcon className="h-4 w-4" />}
                </button>
              )}
              <button type="button" onClick={() => setChatOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-50 hover:text-slate-700" title="Close AI Chat">
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div ref={chatThreadRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {chatState.error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{chatState.error}</div>}
            {chatState.items.length === 0 && !chatState.pendingQuestion ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                <SparklesIcon className="mx-auto h-7 w-7 text-slate-300" />
                <p className="mt-3 text-sm font-black text-slate-600">Ask AI about the answer</p>
                <p className="mt-1 text-xs font-medium leading-5 text-slate-400">Use the "Explain" button or type a question below.</p>
              </div>
            ) : null}
            {chatState.items.map((item) => (
              <div key={item.id} className="space-y-3">
                <div className="ml-auto max-w-[88%] rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold leading-6 text-white">{item.question}</div>
                <div className="max-w-[92%] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{item.answer || ""}</ReactMarkdown>
                  <p className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{formatTimestamp(item.createdAt)}</p>
                </div>
              </div>
            ))}
            {chatState.pendingQuestion ? (
              <div className="space-y-3">
                <div className="ml-auto max-w-[88%] rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold leading-6 text-white">{chatState.pendingQuestion}</div>
                <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-500" />Thinking...
                </div>
              </div>
            ) : null}
          </div>
          <form className="flex shrink-0 gap-2 border-t border-slate-100 p-3"
            onSubmit={(e) => { e.preventDefault(); void handleSendChat(chatInput); }}>
            <textarea value={chatInput} onChange={(e) => setChatInput(e.target.value)} rows={2}
              placeholder="Ask about the correct or incorrect answer..."
              className="min-h-[48px] flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold leading-6 text-slate-900 outline-none transition focus:border-cyan-300 focus:bg-white focus:ring-4 focus:ring-cyan-100"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSendChat(chatInput); } }}
            />
            <button type="submit" disabled={chatState.loading || !chatInput.trim()}
              className="flex w-11 items-center justify-center rounded-xl bg-cyan-500 text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-40">
              <SendIcon className="h-4 w-4" />
            </button>
          </form>
        </section>
        ) : null}

        <main className="min-w-0 space-y-0">
          <div ref={quizPanelRef}>
            <QuizPanel {...quizPanelProps} />
          </div>
        </main>
      </div>

      {/* Config modal for creating a new quiz after one already exists */}
      <QuizConfigModal
        open={configOpen}
        documents={documents}
        form={form}
        selectedDocumentIds={selectedDocumentIds}
        generating={quizState.loading}
        error={quizState.error}
        onClose={() => { setConfigOpen(false); setQuizState((s) => ({ ...s, error: "" })); }}
        onSubmit={(e) => { e.preventDefault(); void handleGenerateQuiz(); }}
        onFormChange={updateForm}
        onToggleDocument={toggleDocument}
        onGoWorkspace={() => navigate("/app")}
      />
    </div>
  );
};

export default Quiz;
