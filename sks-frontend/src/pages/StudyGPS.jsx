import { createElement, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useNavigate } from "react-router-dom";
import { getDocuments } from "../service/documentAPI.js";
import {
  clearStudyGpsDayChatHistory,
  clearStudyGpsPlan,
  generateStudyGpsPlan,
  getStudyGpsDayChatHistory,
  getStudyGpsPlan,
  sendStudyGpsDayChat,
  startStudyGpsDayChat,
} from "../service/ragAPI.js";

const Icon = ({ children, className = "h-5 w-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
);

const askMarkdownComponents = {
  p: ({ children }) => (
    <p className="mb-3 text-[14px] font-medium leading-[1.8] text-slate-700 last:mb-0">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-2 pl-5 text-[14px] font-medium leading-[1.8] text-slate-700 last:mb-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-2 pl-5 text-[14px] font-medium leading-[1.8] text-slate-700 last:mb-0">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1 marker:text-cyan-500">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-black text-slate-900">{children}</strong>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-bold text-cyan-600 underline decoration-cyan-200 underline-offset-4 transition-colors hover:text-cyan-700"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-3 rounded-2xl border-l-4 border-cyan-400 bg-cyan-50/60 px-4 py-3 text-[14px] font-medium leading-[1.8] text-slate-700 last:mb-0">
      {children}
    </blockquote>
  ),
  code: ({ inline, children }) =>
    inline ? (
      <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] font-semibold text-slate-800">
        {children}
      </code>
    ) : (
      <code className="font-mono text-[12px] text-slate-100">{children}</code>
    ),
  pre: ({ children }) => (
    <pre className="mb-3 overflow-x-auto rounded-2xl bg-slate-900 px-4 py-3 text-[12px] leading-6 text-slate-100 last:mb-0">
      {children}
    </pre>
  ),
  h1: ({ children }) => (
    <h1 className="mb-3 text-[18px] font-black leading-tight text-slate-950 last:mb-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-3 text-[16px] font-black leading-tight text-slate-950 last:mb-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-3 text-[15px] font-black leading-tight text-slate-900 last:mb-0">
      {children}
    </h3>
  ),
};

const CompassIcon = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2.3 4.7-4.7 2.3 2.3-4.7 4.7-2.3Z" />
  </Icon>
);

const TargetIcon = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </Icon>
);

const PresentationIcon = (props) => (
  <Icon {...props}>
    <path d="M4 4h16v11H4z" />
    <path d="M12 15v5M8 20h8M8 9h3M8 12h7M15 8l2 2 2-4" />
  </Icon>
);

const BrainIcon = (props) => (
  <Icon {...props}>
    <path d="M8.5 14.5A3.5 3.5 0 0 1 5 11V9.8A3.8 3.8 0 0 1 8.8 6h.7A3.5 3.5 0 0 1 16 7.8" />
    <path d="M15.5 14.5A3.5 3.5 0 0 0 19 11V9.8A3.8 3.8 0 0 0 15.2 6h-.7" />
    <path d="M12 6v14M8 10h2M14 10h2M8.5 14.5h7" />
  </Icon>
);

const SparklesIcon = (props) => (
  <Icon {...props}>
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z" />
    <path d="M5 16l.7 2.1L8 19l-2.3.9L5 22l-.7-2.1L2 19l2.3-.9L5 16ZM19 14l.5 1.5L21 16l-1.5.5L19 18l-.5-1.5L17 16l1.5-.5L19 14Z" />
  </Icon>
);

const ClockIcon = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v5l3 2" />
  </Icon>
);

const CalendarIcon = (props) => (
  <Icon {...props}>
    <path d="M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
  </Icon>
);

const FileIcon = (props) => (
  <Icon {...props}>
    <path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </Icon>
);

const CheckIcon = (props) => (
  <Icon {...props}>
    <path d="m5 12 4 4L19 6" />
  </Icon>
);

const TrashIcon = (props) => (
  <Icon {...props}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" />
  </Icon>
);

const CloseIcon = (props) => (
  <Icon {...props}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Icon>
);

const RefreshIcon = (props) => (
  <Icon {...props}>
    <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4" />
  </Icon>
);

const ChevronDownIcon = (props) => (
  <Icon {...props}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

const SearchIcon = (props) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </Icon>
);

const GOALS = [
  {
    value: "exam",
    label: "Exam",
    helper: "Recall, review, high-yield concepts",
    Icon: TargetIcon,
  },
  {
    value: "presentation",
    label: "Presentation",
    helper: "Storyline, evidence, speaking prep",
    Icon: PresentationIcon,
  },
  {
    value: "understand_lesson",
    label: "Understand Lesson",
    helper: "Foundations, definitions, checkpoints",
    Icon: BrainIcon,
  },
];

const LEVELS = [
  { value: "weak", label: "Weak" },
  { value: "average", label: "Average" },
  { value: "good", label: "Good" },
];

const LANGUAGES = [
  { value: "en", label: "EN" },
  { value: "vi", label: "VI" },
];

const cleanLoosePunctuation = (value) =>
  String(value || "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([.!?])\s*[,;:]+/g, "$1")
    .replace(/[,;:]+\s*([.!?])/g, "$1")
    .replace(/([,;:])\s*([,;:])+/g, "$1")
    .replace(/(^|\s)[,;:]+(?=\s|$)/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s+/g, " ")
    .trim();

const cleanDisplayText = (value) =>
  cleanLoosePunctuation(
    String(value || "")
      .replace(/\b(document|doc)\s*id\s*:?\s*[\w-]+/gi, "")
      .replace(
        /\b(?:study\s+)?(?:part|section|excerpt|reference)?\s*\d+\s+(?:trong|in|from)\s+['"][^'"]+\.(?:pdf|docx?|pptx?|txt)['"]\s*(?:để\s*)?/gi,
        "",
      )
      .replace(
        /\b(?:trong|theo|in|from)\s+(?:tài\s+liệu\s+của\s+)?['"][^'"]+\.(?:pdf|docx?|pptx?|txt)['"]\s*(?:để\s*)?/gi,
        "",
      )
      .replace(
        /\b(?:tài\s+liệu\s+của|file|document)\s+['"][^'"]+\.(?:pdf|docx?|pptx?|txt)['"]/gi,
        "tài liệu",
      )
      .replace(
        /\s+(?:in|from|inside|within|trong|theo)\s+['"]?\bStudy\s+parts?\s*\d+\b['"]?/gi,
        "",
      )
      .replace(/['"]?\bStudy\s+parts?\s*\d+\b['"]?/gi, "tài liệu")
      .replace(/\bStudy\s+parts?\b/gi, "tài liệu")
      .replace(/\bselected\s+sections?\b/gi, "tài liệu")
      .replace(/\b(?:excerpt|reference)\s*#?\d+\b/gi, "tài liệu")
      .replace(/\bsource\s+chunks?\s*#?\d*\b/gi, "tài liệu")
      .replace(/\bchunks?\s*#?\d+\b/gi, "tài liệu")
      .replace(/\brelevant\s+parts?\b/gi, "tài liệu")
      .replace(/\bchunks?\b/gi, "tài liệu")
      .replace(/\bembeddings?\b/gi, "")
      .replace(/\bvectors?\b/gi, "")
      .replace(/\braw\s+context\b/gi, "tài liệu")
      .replace(/\btài liệu\s+và\s+tài liệu\b/gi, "tài liệu")
      .replace(/\btài liệu\s*,\s*tài liệu\b/gi, "tài liệu")
      .replace(/^Đọc\s+(?:kỹ\s+)?tài liệu\s+và\s+/i, "")
      .replace(/^Đọc\s+tài liệu\s+để\s+/i, "")
      .replace(/^Nghiên cứu\s+tài liệu\s+(?:để\s+)?/i, "")
      .replace(/^Phân tích\s+tài liệu\s+về\s+/i, "Phân tích ")
      .replace(/^và\s+/i, "")
      .replace(/^and\s+/i, ""),
  );

const safeArray = (value) => (Array.isArray(value) ? value : []);

const isGenericStudyTask = (value) => {
  const normalizedValue = cleanDisplayText(value).toLowerCase();

  if (!normalizedValue) return true;

  return [
    /đọc\s+kỹ\s+tài\s+liệu/i,
    /doc\s+ky\s+tai\s+lieu/i,
    /tóm\s+tắt.*sổ\s+tay/i,
    /tom\s+tat.*so\s+tay/i,
    /tự\s+đặt\s+câu\s+hỏi/i,
    /tu\s+dat\s+cau\s+hoi/i,
    /kiểm\s+tra\s+sự\s+hiểu\s+biết/i,
    /kiem\s+tra\s+su\s+hieu\s+biet/i,
    /read\s+carefully/i,
    /summari[sz]e.*notebook/i,
    /ask\s+yourself/i,
    /check\s+your\s+understanding/i,
    /spend\s+\d*\s*hours?/i,
  ].some((pattern) => pattern.test(normalizedValue));
};

const getDayChecklist = (day) =>
  safeArray(day?.tasks)
    .map(cleanDisplayText)
    .filter((task) => task && !isGenericStudyTask(task))
    .slice(0, 4);

const getDocumentTitle = (document) =>
  document?.title || document?.metadata?.topic || "Untitled document";

const STUDY_GOAL_LABELS = {
  exam: "Exam",
  presentation: "Presentation",
  understand_lesson: "Understand",
};

const getCompletedDaysStorageKey = (planId, generatedAt) =>
  `sks-study-gps-completed:${planId || "draft"}:${generatedAt || "active"}`;

const readCompletedDaysFromStorage = (storageKey) => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(storageKey);
    const parsedValue = storedValue ? JSON.parse(storedValue) : [];

    return Array.isArray(parsedValue)
      ? parsedValue.map(Number).filter((day) => Number.isFinite(day))
      : [];
  } catch {
    return [];
  }
};

const PageShell = ({ children }) => (
  <div className="w-full animate-fade-in pb-12">{children}</div>
);

const InlineAlert = ({ children }) => (
  <div className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-100 text-[11px]">
      !
    </span>
    <span>{children}</span>
  </div>
);

const StudyGpsLoading = ({ label = "Charting Study Route" }) => (
  <PageShell>
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
          <div className="absolute inset-2 animate-[spin_6s_linear_infinite]">
            <span className="absolute left-0 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
          </div>
          <div className="relative flex h-20 w-20 items-center justify-center rounded-[1.8rem] bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-2xl shadow-cyan-500/20">
            <CompassIcon className="h-8 w-8" />
          </div>
        </div>

        <h2 className="text-[13px] font-[1000] uppercase tracking-[0.3em] text-slate-900">
          {label}
        </h2>
        <p className="mt-3 max-w-[320px] text-[12px] font-medium leading-6 text-slate-400">
          AI is ordering your materials into a focused learning path.
        </p>
        <div className="mt-8 flex gap-2">
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-cyan-400 [animation-delay:0ms]" />
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-cyan-500 [animation-delay:150ms]" />
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-blue-500 [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  </PageShell>
);

const EmptyStudyGps = ({ documentsCount, onOpenConfig, onGoWorkspace }) => (
  <PageShell>
    <div className="grid min-h-[calc(100vh-160px)] place-items-center px-6">
      <div className="w-full max-w-[460px] py-16 text-center">
        <div className="relative mb-10">
          <div className="absolute -inset-8 rounded-full bg-cyan-100/40 animate-pulse" />
          <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-2xl shadow-cyan-500/30">
            <CompassIcon className="h-8 w-8" />
          </div>
        </div>

        <p className="text-[13px] font-[1000] uppercase tracking-[0.24em] text-slate-900">
          SKS Study GPS
        </p>
        <h1 className="mt-4 text-3xl font-[1000] leading-tight text-slate-950">
          Build your first study route
        </h1>
        <p className="mx-auto mt-4 max-w-[320px] text-[12px] font-medium leading-6 text-slate-400">
          {documentsCount > 0
            ? `${documentsCount} uploaded documents are ready.`
            : "Upload documents in Workspace first."}
        </p>

        <button
          type="button"
          onClick={documentsCount > 0 ? onOpenConfig : onGoWorkspace}
          className="group relative mt-10 flex h-14 w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 px-8 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-cyan-500/20 transition-all hover:scale-[1.02] active:scale-95"
        >
          <span>
            {documentsCount > 0 ? "Generate Study GPS" : "Open Workspace"}
          </span>
          <SparklesIcon className="h-4 w-4 transition-transform group-hover:rotate-12" />
        </button>
      </div>
    </div>
  </PageShell>
);

const FormSectionTitle = ({ icon: TitleIcon, children, right }) => (
  <div className="mb-2 flex items-center justify-between gap-3">
    <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
      {TitleIcon ? <TitleIcon className="h-3.5 w-3.5" /> : null}
      {children}
    </p>
    {right}
  </div>
);

const ConfigModal = ({
  open,
  documents,
  form,
  selectedDocumentIds,
  generating,
  onClose,
  onSubmit,
  onFormChange,
  onToggleDocument,
  onGoWorkspace,
}) => {
  const [documentDropdownOpen, setDocumentDropdownOpen] = useState(false);
  const [documentQuery, setDocumentQuery] = useState("");

  if (!open) return null;

  const selectedCount = selectedDocumentIds.length;
  const daysValue = Number(form.daysLeft);
  const hoursValue = Number(form.hoursPerDay);
  const hasTimeBudget =
    Number.isFinite(daysValue) &&
    daysValue > 0 &&
    Number.isFinite(hoursValue) &&
    hoursValue > 0;
  const selectedDocuments = documents.filter((document) =>
    selectedDocumentIds.includes(document.id),
  );
  const normalizedDocumentQuery = documentQuery.trim().toLowerCase();
  const visibleDocuments = normalizedDocumentQuery
    ? documents.filter((document) =>
        getDocumentTitle(document)
          .toLowerCase()
          .includes(normalizedDocumentQuery),
      )
    : documents;
  const selectedPreview =
    selectedDocuments.length > 0
      ? selectedDocuments.slice(0, 2).map(getDocumentTitle).join(", ")
      : "Choose documents";

  const handleModalClose = () => {
    setDocumentDropdownOpen(false);
    setDocumentQuery("");
    onClose();
  };

  const handleModalSubmit = (event) => {
    setDocumentDropdownOpen(false);
    setDocumentQuery("");
    onSubmit(event);
  };

  return (
    <div className="fixed inset-0 z-[170] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-md animate-fade-in">
      <form
        onSubmit={handleModalSubmit}
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-[32px] border border-white/20 bg-white shadow-2xl"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 bg-white/90 px-5 backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
              <CompassIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-[12px] font-black uppercase tracking-[0.28em] text-slate-900">
                Study GPS
              </h2>
              <div className="mt-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-600">
                <FileIcon className="h-3 w-3" />
                {selectedCount}/8
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleModalClose}
            disabled={generating}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
            title="Close"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 scrollbar-thin">
          <div className="space-y-5">
            <section>
              <FormSectionTitle icon={TargetIcon}>Goal</FormSectionTitle>
              <div className="grid grid-cols-3 gap-2">
                {GOALS.map((goal) => {
                  const GoalIcon = goal.Icon;
                  const selected = form.goal === goal.value;

                  return (
                    <button
                      key={goal.value}
                      type="button"
                      title={goal.helper}
                      onClick={() => onFormChange({ goal: goal.value })}
                      className={`flex min-h-[86px] flex-col items-center justify-center gap-2 rounded-2xl border px-2 text-center transition hover:-translate-y-0.5 ${
                        selected
                          ? "border-cyan-300 bg-cyan-50 text-cyan-700 shadow-lg shadow-cyan-500/10"
                          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <GoalIcon className="h-5 w-5" />
                      <span className="text-xs font-black leading-tight">
                        {goal.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <FormSectionTitle icon={CalendarIcon}>Days</FormSectionTitle>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={form.daysLeft}
                    placeholder=""
                    onChange={(event) =>
                      onFormChange({ daysLeft: event.target.value })
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-950 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                  />
                </label>
                <label>
                  <FormSectionTitle icon={ClockIcon}>Hours</FormSectionTitle>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={form.hoursPerDay}
                    placeholder=""
                    onChange={(event) =>
                      onFormChange({ hoursPerDay: event.target.value })
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-950 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
                <div>
                  <FormSectionTitle icon={BrainIcon}>
                    Current Understanding
                  </FormSectionTitle>
                  <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1">
                    {LEVELS.map((level) => (
                      <button
                        key={level.value}
                        type="button"
                        onClick={() => onFormChange({ level: level.value })}
                        className={`min-h-10 rounded-xl px-3 text-[11px] font-black transition ${
                          form.level === level.value
                            ? "bg-white text-slate-950 shadow-sm"
                            : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        {level.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <FormSectionTitle icon={PresentationIcon}>
                    Lang
                  </FormSectionTitle>
                  <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
                    {LANGUAGES.map((language) => (
                      <button
                        key={language.value}
                        type="button"
                        onClick={() =>
                          onFormChange({ language: language.value })
                        }
                        className={`min-h-10 rounded-xl px-2 text-xs font-black transition ${
                          form.language === language.value
                            ? "bg-white text-slate-950 shadow-sm"
                            : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        {language.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="relative min-w-0">
              <FormSectionTitle
                icon={FileIcon}
                right={
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-600">
                    {selectedCount}/8
                  </span>
                }
              >
                Docs
              </FormSectionTitle>

              {documents.length === 0 ? (
                <button
                  type="button"
                  onClick={onGoWorkspace}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-xs font-black uppercase tracking-[0.18em] text-slate-500 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700"
                >
                  <FileIcon className="h-4 w-4" />
                  Workspace
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setDocumentDropdownOpen((current) => !current)
                    }
                    className={`flex h-14 w-full items-center gap-3 rounded-2xl border px-4 text-left transition hover:border-cyan-300 hover:bg-cyan-50 ${
                      selectedCount > 0
                        ? "border-cyan-200 bg-cyan-50/70"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-cyan-600 shadow-sm">
                      <FileIcon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-slate-950">
                        {selectedCount > 0
                          ? `${selectedCount} selected`
                          : "Choose documents"}
                      </span>
                      <span className="block truncate text-xs font-semibold text-slate-400">
                        {selectedPreview}
                        {selectedDocuments.length > 2
                          ? ` +${selectedDocuments.length - 2}`
                          : ""}
                      </span>
                    </span>
                    <ChevronDownIcon
                      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                        documentDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {documentDropdownOpen ? (
                    <div className="mt-2 overflow-hidden rounded-3xl border border-slate-200 bg-white p-2 shadow-lg shadow-slate-900/5">
                      <label className="flex h-10 items-center gap-2 rounded-2xl bg-slate-50 px-3 text-slate-400">
                        <SearchIcon className="h-4 w-4 shrink-0" />
                        <input
                          type="text"
                          value={documentQuery}
                          onChange={(event) =>
                            setDocumentQuery(event.target.value)
                          }
                          placeholder="Search"
                          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
                        />
                      </label>

                      <div className="mt-2 max-h-[220px] space-y-1 overflow-y-auto pr-1 scrollbar-thin">
                        {visibleDocuments.length === 0 ? (
                          <div className="rounded-2xl px-3 py-5 text-center text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                            No match
                          </div>
                        ) : (
                          visibleDocuments.map((document) => {
                            const selected = selectedDocumentIds.includes(
                              document.id,
                            );
                            const disabled =
                              !selected && selectedDocumentIds.length >= 8;

                            return (
                              <button
                                key={document.id}
                                type="button"
                                disabled={disabled}
                                onClick={() => onToggleDocument(document.id)}
                                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                                  selected
                                    ? "bg-cyan-50 text-slate-950"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                                }`}
                              >
                                <span
                                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${
                                    selected
                                      ? "border-cyan-500 bg-cyan-500 text-white"
                                      : "border-slate-300 bg-white text-transparent"
                                  }`}
                                >
                                  {selected ? (
                                    <CheckIcon className="h-4 w-4" />
                                  ) : null}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-black">
                                    {getDocumentTitle(document)}
                                  </span>
                                  <span className="block truncate text-[11px] font-semibold text-slate-400">
                                    {document.folderName || "Workspace"} /{" "}
                                    {document.formattedFileSize || "File"}
                                  </span>
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : null}

                  {selectedDocuments.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedDocuments.slice(0, 4).map((document) => (
                        <span
                          key={document.id}
                          className="max-w-full truncate rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700"
                        >
                          {getDocumentTitle(document)}
                        </span>
                      ))}
                      {selectedDocuments.length > 4 ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
                          +{selectedDocuments.length - 4}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </section>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-4">
          <div
            className={`flex h-10 items-center gap-2 rounded-2xl px-3 text-xs font-black ${
              selectedCount > 0
                ? "bg-cyan-50 text-cyan-700"
                : "bg-slate-100 text-slate-400"
            }`}
            title={
              selectedCount > 0 ? "Documents selected" : "Choose documents"
            }
          >
            <FileIcon className="h-4 w-4" />
            {selectedCount}/8
          </div>
          <button
            type="submit"
            disabled={
              generating ||
              selectedCount === 0 ||
              documents.length === 0 ||
              !hasTimeBudget
            }
            className="sks-ai-glow-btn inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 px-5 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-xl shadow-cyan-500/20 transition hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            {generating ? (
              <CompassIcon className="h-4 w-4 animate-spin" />
            ) : (
              <SparklesIcon className="h-4 w-4" />
            )}
            {generating ? "Generating" : "Generate"}
          </button>
        </div>
      </form>
    </div>
  );
};

const StudyDayChatModal = ({
  open,
  day,
  activePlan,
  messages,
  input,
  loading,
  clearing,
  pendingQuestion,
  error,
  onInputChange,
  onSend,
  onClear,
  onClose,
}) => {
  const threadRef = useRef(null);

  useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages, loading, pendingQuestion]);

  if (!open) return null;

  const dayNumber = Number(day?.day) || 1;
  const title = cleanDisplayText(day?.goal || `Day ${dayNumber}`);
  const documentCount = activePlan?.documents?.length || 0;
  const hasMessages = safeArray(messages).length > 0;

  const handleInputKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend?.(event);
    }
  };

  return (
    <div className="fixed inset-0 z-[175] flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-md animate-fade-in sm:p-5">
      <div className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[32px] border border-white/20 bg-white shadow-2xl">
        <div className="flex min-h-20 shrink-0 items-center justify-between border-b border-slate-100 bg-white/90 px-5 py-4 backdrop-blur-xl sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 ring-1 ring-cyan-100">
              <BrainIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-600">
                Day {dayNumber} Ask AI
              </p>
              <h2 className="mt-1 truncate text-xl font-black leading-tight text-slate-950">
                {title || "Study session"}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasMessages ? (
              <button
                type="button"
                onClick={onClear}
                disabled={clearing || loading}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
                title="Clear history"
              >
                {clearing ? (
                  <CompassIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <TrashIcon className="h-4 w-4" />
                )}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
              title="Close"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto]">
          <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-8 items-center gap-2 rounded-2xl bg-white px-3 text-[11px] font-black text-slate-600 ring-1 ring-slate-100">
                <ClockIcon className="h-3.5 w-3.5 text-blue-500" />
                {activePlan?.hoursPerDay || 0}h
              </span>
              <span className="inline-flex h-8 items-center gap-2 rounded-2xl bg-white px-3 text-[11px] font-black text-slate-600 ring-1 ring-slate-100">
                <FileIcon className="h-3.5 w-3.5 text-cyan-500" />
                {documentCount}
              </span>
            </div>

          </div>

          <div
            ref={threadRef}
            className="min-h-0 overflow-y-auto px-5 py-5 scrollbar-thin sm:px-7"
          >
            <div className="space-y-4">
              {safeArray(messages).map((message) => {
                const isUser = message.role === "user";

                return (
                  <div
                    key={message.id}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[86%] rounded-[1.5rem] px-4 py-3 text-sm font-semibold leading-7 shadow-sm ${
                        isUser
                          ? "bg-cyan-600 text-white"
                          : "border border-slate-100 bg-slate-50 text-slate-700"
                      }`}
                    >
                      {isUser ? (
                        <div className="whitespace-pre-wrap break-words">
                          {message.content}
                        </div>
                      ) : (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={askMarkdownComponents}
                        >
                          {message.content || ""}
                        </ReactMarkdown>
                      )}
                    </div>
                  </div>
                );
              })}

              {loading && pendingQuestion ? (
                <div className="flex justify-end">
                  <div className="max-w-[86%] rounded-[1.5rem] bg-cyan-600 px-4 py-3 text-sm font-semibold leading-7 text-white shadow-sm">
                    {pendingQuestion}
                  </div>
                </div>
              ) : null}

              {loading ? (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 rounded-[1.5rem] border border-slate-100 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    <CompassIcon className="h-4 w-4 animate-spin text-cyan-500" />
                    {pendingQuestion ? "AI is thinking" : "AI is drafting"}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <form
            onSubmit={onSend}
            className="border-t border-slate-100 bg-white px-5 py-4 sm:px-7"
          >
            {error ? <InlineAlert>{error}</InlineAlert> : null}
            <div className="flex items-end gap-3">
              <textarea
                value={input}
                onChange={(event) => onInputChange?.(event.target.value)}
                onKeyDown={handleInputKeyDown}
                rows={2}
                placeholder="Ask what you want to study today..."
                className="min-h-[52px] flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
              />
              <button
                type="submit"
                disabled={loading || !String(input || "").trim()}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-600 text-white shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                title="Send"
              >
                {loading ? (
                  <CompassIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <SparklesIcon className="h-4 w-4" />
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const ResultCard = ({ icon, label, children, className = "" }) => (
  <section
    className={`rounded-[2rem] border border-slate-200 bg-white p-5 shadow-lg shadow-slate-900/5 ${className}`}
  >
    <div className="mb-4 flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 ring-1 ring-cyan-100">
        {createElement(icon, { className: "h-4 w-4" })}
      </span>
      <h2 className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
        {label}
      </h2>
    </div>
    {children}
  </section>
);

const DailyRoute = ({
  days,
  completedDays,
  onToggleDayCompleted,
  onOpenDay,
}) => {
  const completedCount = days.filter((day) =>
    completedDays.has(day.day),
  ).length;
  const progressPercent =
    days.length > 0 ? Math.round((completedCount / days.length) * 100) : 0;

  return (
    <ResultCard icon={CalendarIcon} label="Roadmap" className="p-5 md:p-6">
      <div className="mb-5 rounded-[1.75rem] border border-cyan-100 bg-gradient-to-r from-cyan-50 via-white to-emerald-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-600">
              Progress
            </p>
            <p className="mt-1 text-sm font-bold text-slate-600">
              {completedCount}/{days.length} days completed
            </p>
          </div>
          <span className="rounded-2xl bg-white px-4 py-2 text-lg font-black text-slate-950 shadow-sm ring-1 ring-slate-100">
            {progressPercent}%
          </span>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-white shadow-inner ring-1 ring-cyan-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {days.map((day) => {
          const completed = completedDays.has(day.day);
          const checklist = getDayChecklist(day);

          return (
            <article
              key={day.day}
              role="button"
              tabIndex={0}
              onClick={() => onOpenDay?.(day)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenDay?.(day);
                }
              }}
              className={`group flex min-h-[250px] cursor-pointer flex-col rounded-[1.75rem] border p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${
                completed
                  ? "border-emerald-200 bg-emerald-50/80 hover:shadow-emerald-500/10"
                  : "border-slate-200 bg-white hover:border-cyan-200 hover:shadow-cyan-500/10"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleDayCompleted?.(day.day);
                  }}
                  className={`inline-flex h-11 items-center gap-2 rounded-2xl px-3 text-xs font-black transition ${
                    completed
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                      : "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100 hover:bg-cyan-100"
                  }`}
                  title={completed ? "Mark as not done" : "Mark as done"}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-lg border ${
                      completed
                        ? "border-white bg-white text-emerald-600"
                        : "border-cyan-300 bg-white text-transparent"
                    }`}
                  >
                    <CheckIcon className="h-3.5 w-3.5" />
                  </span>
                  Day {day.day}
                </button>

                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-cyan-500 shadow-sm ring-1 ring-slate-100">
                  <CalendarIcon className="h-4 w-4" />
                </span>
              </div>

              <div className="mt-4 flex flex-1 flex-col text-left">
                <h3
                  className={`text-lg font-black leading-snug ${
                    completed ? "text-emerald-950" : "text-slate-950"
                  }`}
                >
                  {cleanDisplayText(day.goal)}
                </h3>

                {checklist.length > 0 ? (
                  <div className="mt-4 flex-1 space-y-2.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                      Checklist
                    </p>
                    {checklist.map((task, index) => (
                      <div
                        key={`${day.day}-checklist-${index}`}
                        className="flex items-start gap-2.5 text-sm font-semibold leading-6 text-slate-600"
                      >
                        <span
                          className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-md border ${
                            completed
                              ? "border-emerald-400 bg-emerald-400 text-white"
                              : "border-cyan-200 bg-cyan-50 text-cyan-500"
                          }`}
                        >
                          <CheckIcon className="h-3 w-3" />
                        </span>
                        <span>{task}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1" />
                )}

                <div
                  className={`mt-5 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] ${
                    completed ? "text-emerald-700" : "text-cyan-600"
                  }`}
                >
                  <BrainIcon className="h-4 w-4" />
                  Ask AI
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </ResultCard>
  );
};

const PlanView = ({
  activePlan,
  generating,
  clearing,
  onOpenConfig,
  onOpenDay,
  onClear,
}) => {
  const plan = activePlan?.plan || {};
  const dailyRoute = safeArray(plan.dailyRoute);
  const goalLabel = STUDY_GOAL_LABELS[activePlan.goal] || "Study";
  const completedDaysStorageKey = getCompletedDaysStorageKey(
    activePlan.id,
    activePlan.generatedAt,
  );
  const [completedDays, setCompletedDays] = useState(() =>
    readCompletedDaysFromStorage(completedDaysStorageKey),
  );
  const completedDaySet = useMemo(
    () => new Set(completedDays),
    [completedDays],
  );

  const handleToggleDayCompleted = (dayNumber) => {
    setCompletedDays((currentDays) => {
      const nextDays = currentDays.includes(dayNumber)
        ? currentDays.filter((day) => day !== dayNumber)
        : [...currentDays, dayNumber].sort((left, right) => left - right);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          completedDaysStorageKey,
          JSON.stringify(nextDays),
        );
      }

      return nextDays;
    });
  };

  return (
    <PageShell>
      <div className="relative px-4 sm:px-6">
        {generating ? (
          <div className="absolute inset-0 z-20 grid place-items-center rounded-[2rem] bg-white/65 backdrop-blur-sm">
            <div className="rounded-[2rem] border border-white/70 bg-white px-8 py-7 text-center shadow-2xl">
              <CompassIcon className="mx-auto h-8 w-8 animate-spin text-cyan-500" />
              <p className="mt-4 text-[12px] font-black uppercase tracking-[0.26em] text-slate-900">
                Updating Route
              </p>
            </div>
          </div>
        ) : null}

        <section className="w-full">
          <div className="flex flex-col gap-4 py-2 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-cyan-600 shadow-sm ring-1 ring-cyan-100">
                <CompassIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">
                  Study GPS
                </p>
                <h1 className="truncate text-2xl font-black leading-tight text-slate-950">
                  {goalLabel}
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <span className="inline-flex h-10 items-center gap-2 rounded-2xl bg-white px-3 text-xs font-black text-slate-600 shadow-sm ring-1 ring-slate-100">
                <FileIcon className="h-4 w-4 text-cyan-500" />
                {activePlan.documents?.length || 0}
              </span>
              <span className="inline-flex h-10 items-center gap-2 rounded-2xl bg-white px-3 text-xs font-black text-slate-600 shadow-sm ring-1 ring-slate-100">
                <CalendarIcon className="h-4 w-4 text-emerald-500" />
                {activePlan.daysLeft}d
              </span>
              <span className="inline-flex h-10 items-center gap-2 rounded-2xl bg-white px-3 text-xs font-black text-slate-600 shadow-sm ring-1 ring-slate-100">
                <ClockIcon className="h-4 w-4 text-blue-500" />
                {activePlan.hoursPerDay}h
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onOpenConfig}
                  disabled={generating}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-4 text-[11px] font-black uppercase tracking-[0.16em] text-white shadow-lg shadow-cyan-500/15 transition hover:bg-cyan-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshIcon className="h-4 w-4" />
                  Regenerate
                </button>
                <button
                  type="button"
                  onClick={onClear}
                  disabled={clearing || generating}
                  title="Clear Study GPS"
                  className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-100 transition hover:bg-rose-50 hover:text-rose-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6">
            {dailyRoute.length > 0 ? (
              <DailyRoute
                days={dailyRoute}
                completedDays={completedDaySet}
                onToggleDayCompleted={handleToggleDayCompleted}
                onOpenDay={onOpenDay}
              />
            ) : null}
          </div>
        </section>
      </div>
    </PageShell>
  );
};

const StudyGPS = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([]);
  const [form, setForm] = useState({
    goal: "exam",
    level: "average",
    daysLeft: "",
    hoursPerDay: "",
    language: "en",
  });
  const [activePlan, setActivePlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [error, setError] = useState("");
  const [dayChatOpen, setDayChatOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayChatMessages, setDayChatMessages] = useState([]);
  const [dayChatInput, setDayChatInput] = useState("");
  const [dayChatLoading, setDayChatLoading] = useState(false);
  const [dayChatClearing, setDayChatClearing] = useState(false);
  const [dayChatPendingQuestion, setDayChatPendingQuestion] = useState("");
  const [dayChatError, setDayChatError] = useState("");

  useEffect(() => {
    let active = true;

    const loadPageData = async () => {
      try {
        setLoading(true);
        const [documentResult, planResult] = await Promise.all([
          getDocuments(1, 100),
          getStudyGpsPlan(),
        ]);

        if (!active) return;

        const nextDocuments = documentResult.documents || [];
        const nextPlan = planResult.plan || null;
        setDocuments(nextDocuments);
        setActivePlan(nextPlan);

        if (nextPlan) {
          setSelectedDocumentIds(
            (nextPlan.documents || []).map((document) => document.id),
          );
          setForm({
            goal: nextPlan.goal || "exam",
            level: nextPlan.level || "average",
            daysLeft: nextPlan.daysLeft || "",
            hoursPerDay: nextPlan.hoursPerDay || "",
            language: nextPlan.language || "en",
          });
        }
      } catch (err) {
        if (active) {
          setError(
            err.response?.data?.message ||
              "Unable to load documents or Study GPS plan.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadPageData();

    return () => {
      active = false;
    };
  }, []);

  const availableSelectedDocuments = useMemo(() => {
    const documentIdSet = new Set(documents.map((document) => document.id));
    return selectedDocumentIds.filter((documentId) =>
      documentIdSet.has(documentId),
    );
  }, [documents, selectedDocumentIds]);

  const handleFormChange = (patch) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const handleToggleDocument = (documentId) => {
    const alreadySelected = selectedDocumentIds.includes(documentId);

    if (!alreadySelected && selectedDocumentIds.length >= 8) {
      setError("Study GPS supports up to 8 documents per route.");
      return;
    }

    setError("");
    setSelectedDocumentIds((current) =>
      current.includes(documentId)
        ? current.filter((id) => id !== documentId)
        : [...current, documentId],
    );
  };

  const handleGenerate = async (event) => {
    event.preventDefault();

    if (availableSelectedDocuments.length === 0) {
      setError("Select at least one uploaded document.");
      return;
    }

    const daysLeft = Number(form.daysLeft);
    const hoursPerDay = Number(form.hoursPerDay);

    if (
      !Number.isFinite(daysLeft) ||
      daysLeft <= 0 ||
      !Number.isFinite(hoursPerDay) ||
      hoursPerDay <= 0
    ) {
      setError("Set days and hours before generating.");
      return;
    }

    try {
      setGenerating(true);
      setConfigOpen(false);
      setDayChatOpen(false);
      setSelectedDay(null);
      setDayChatMessages([]);
      setDayChatInput("");
      setDayChatPendingQuestion("");
      setDayChatError("");
      setError("");
      const result = await generateStudyGpsPlan({
        documentIds: availableSelectedDocuments,
        goal: form.goal,
        level: form.level,
        daysLeft,
        hoursPerDay,
        language: form.language,
      });
      setActivePlan(result.plan || null);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Study GPS could not generate a route for these documents.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenDayChat = async (day) => {
    if (!activePlan || !day) return;

    const dayNumber = Number(day.day);

    setSelectedDay(day);
    setDayChatOpen(true);
    setDayChatInput("");
    setDayChatError("");
    setDayChatMessages([]);
    setDayChatPendingQuestion("");

    try {
      setDayChatLoading(true);
      const historyResult = await getStudyGpsDayChatHistory(dayNumber);
      const historyItems = safeArray(historyResult.items);

      if (historyItems.length > 0) {
        setDayChatMessages(historyItems);
      } else {
        const startResult = await startStudyGpsDayChat(dayNumber);
        setDayChatMessages(safeArray(startResult.items));
      }
    } catch (err) {
      setDayChatError(
        err.response?.data?.message ||
          "Unable to start Study GPS chat for this day.",
      );
    } finally {
      setDayChatLoading(false);
    }
  };

  const handleSendDayChat = async (event) => {
    event?.preventDefault();

    if (!activePlan || !selectedDay || dayChatLoading) return;

    const message = dayChatInput.trim();

    if (!message) return;

    setDayChatInput("");
    setDayChatPendingQuestion(message);
    setDayChatError("");

    try {
      setDayChatLoading(true);
      const result = await sendStudyGpsDayChat({
        day: Number(selectedDay.day),
        message,
      });

      setDayChatMessages((currentMessages) => [
        ...currentMessages,
        ...safeArray(result.items),
      ]);
    } catch (err) {
      setDayChatError(
        err.response?.data?.message ||
          "Unable to answer this Study GPS chat message.",
      );
    } finally {
      setDayChatLoading(false);
      setDayChatPendingQuestion("");
    }
  };

  const handleClearDayChat = async () => {
    if (!selectedDay || dayChatClearing || dayChatLoading) return;

    const dayNumber = Number(selectedDay.day);

    try {
      setDayChatClearing(true);
      setDayChatError("");
      await clearStudyGpsDayChatHistory(dayNumber);
      setDayChatMessages([]);
      setDayChatPendingQuestion("");
      setDayChatLoading(true);
      const result = await startStudyGpsDayChat(dayNumber);
      setDayChatMessages(safeArray(result.items));
    } catch (err) {
      setDayChatError(
        err.response?.data?.message ||
          "Unable to clear Study GPS chat history.",
      );
    } finally {
      setDayChatLoading(false);
      setDayChatClearing(false);
    }
  };

  const handleCloseDayChat = () => {
    setDayChatOpen(false);
    setSelectedDay(null);
    setDayChatMessages([]);
    setDayChatInput("");
    setDayChatPendingQuestion("");
    setDayChatError("");
  };

  const handleClear = async () => {
    try {
      setClearing(true);
      setError("");
      setDayChatOpen(false);
      setSelectedDay(null);
      setDayChatMessages([]);
      setDayChatInput("");
      setDayChatPendingQuestion("");
      setDayChatError("");
      const completedDaysStorageKey = activePlan
        ? getCompletedDaysStorageKey(activePlan.id, activePlan.generatedAt)
        : "";
      await clearStudyGpsPlan();
      if (completedDaysStorageKey && typeof window !== "undefined") {
        window.localStorage.removeItem(completedDaysStorageKey);
      }
      setActivePlan(null);
      setSelectedDocumentIds([]);
      setForm({
        goal: "exam",
        level: "average",
        daysLeft: "",
        hoursPerDay: "",
        language: "en",
      });
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to clear Study GPS plan.",
      );
    } finally {
      setClearing(false);
    }
  };

  const handleGoWorkspace = () => {
    setConfigOpen(false);
    navigate("/app");
  };

  if (loading && !activePlan) {
    return <StudyGpsLoading label="Loading Study GPS" />;
  }

  if (generating && !activePlan) {
    return <StudyGpsLoading />;
  }

  return (
    <>
      {error ? (
        <div className="mx-auto max-w-[1180px] animate-fade-in">
          <InlineAlert>{error}</InlineAlert>
        </div>
      ) : null}

      {activePlan ? (
        <PlanView
          key={`${activePlan.id}-${activePlan.generatedAt}`}
          activePlan={activePlan}
          generating={generating}
          clearing={clearing}
          onOpenConfig={() => setConfigOpen(true)}
          onOpenDay={handleOpenDayChat}
          onClear={handleClear}
        />
      ) : (
        <EmptyStudyGps
          documentsCount={documents.length}
          onOpenConfig={() => setConfigOpen(true)}
          onGoWorkspace={handleGoWorkspace}
        />
      )}

      <ConfigModal
        open={configOpen}
        documents={documents}
        form={form}
        selectedDocumentIds={selectedDocumentIds}
        generating={generating}
        onClose={() => setConfigOpen(false)}
        onSubmit={handleGenerate}
        onFormChange={handleFormChange}
        onToggleDocument={handleToggleDocument}
        onGoWorkspace={handleGoWorkspace}
      />

      <StudyDayChatModal
        open={dayChatOpen}
        day={selectedDay}
        activePlan={activePlan}
        messages={dayChatMessages}
        input={dayChatInput}
        loading={dayChatLoading}
        clearing={dayChatClearing}
        pendingQuestion={dayChatPendingQuestion}
        error={dayChatError}
        onInputChange={setDayChatInput}
        onSend={handleSendDayChat}
        onClear={handleClearDayChat}
        onClose={handleCloseDayChat}
      />
    </>
  );
};

export default StudyGPS;
