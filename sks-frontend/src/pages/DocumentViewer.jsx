import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useNavigate, useParams } from "react-router-dom";
import { useDocViewer } from "../context/DocViewerContext.jsx";
import { getFilePresentation } from "../components/workspace/DocumentLibraryPanel.jsx";
import {
  downloadDocumentFile,
  deleteDocumentNote,
  fetchDocumentFile,
  getDocumentDetails,
  getDocumentNote,
  getRelatedDocuments,
  openDocumentFile,
  saveDocumentNote,
  toggleFavorite,
} from "../service/documentAPI.js";
import { rememberRecentDocument } from "../utils/recentDocuments.js";
import {
  askDocument,
  clearDocumentAskHistory,
  getDocumentAskHistory,
  getDocumentMindMap,
  getDocumentSummary,
} from "../service/ragAPI.js";

const MindMapCanvas = lazy(() => import("../components/documents/MindMapCanvas.jsx"));

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

const createMarkdownComponents = ({
  paragraphClass,
  listClass = paragraphClass,
  strongClass = "font-black text-slate-900",
  linkClass = "font-bold text-cyan-600 underline decoration-cyan-200 underline-offset-4 transition-colors hover:text-cyan-700",
  inlineCodeClass = "rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] font-semibold text-slate-800",
  preClass = "mb-3 overflow-x-auto rounded-2xl bg-slate-900 px-4 py-3 text-[12px] leading-6 text-slate-100 last:mb-0",
  blockquoteClass,
} = {}) => ({
  p: ({ children }) => (
    <p className={`mb-3 ${paragraphClass} last:mb-0`}>{children}</p>
  ),
  ul: ({ children }) => (
    <ul className={`mb-3 list-disc space-y-2 pl-5 ${listClass} last:mb-0`}>
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className={`mb-3 list-decimal space-y-2 pl-5 ${listClass} last:mb-0`}>
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1 marker:text-cyan-500">{children}</li>,
  strong: ({ children }) => (
    <strong className={strongClass}>{children}</strong>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={linkClass}
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote
      className={
        blockquoteClass ||
        `mb-3 rounded-2xl border-l-4 border-cyan-400 bg-cyan-50/60 px-4 py-3 ${paragraphClass} last:mb-0`
      }
    >
      {children}
    </blockquote>
  ),
  code: ({ inline, children }) =>
    inline ? (
      <code className={inlineCodeClass}>{children}</code>
    ) : (
      <code className="font-mono text-[12px] text-inherit">{children}</code>
    ),
  pre: ({ children }) => <pre className={preClass}>{children}</pre>,
});

const summaryNarrativeMarkdownComponents = createMarkdownComponents({
  paragraphClass: "text-[16px] font-medium leading-[1.95] text-slate-700",
  listClass: "text-[16px] font-medium leading-[1.95] text-slate-700",
});

const summaryOverviewMarkdownComponents = createMarkdownComponents({
  paragraphClass: "text-[16px] font-medium leading-[1.8] text-slate-600",
  listClass: "text-[16px] font-medium leading-[1.8] text-slate-600",
});

const summaryKeyPointMarkdownComponents = createMarkdownComponents({
  paragraphClass: "text-[15px] font-bold leading-relaxed text-slate-800",
  listClass: "text-[15px] font-bold leading-relaxed text-slate-800",
  strongClass: "font-black text-slate-950",
});

const summaryConclusionMarkdownComponents = createMarkdownComponents({
  paragraphClass: "text-xl font-bold italic leading-relaxed tracking-tight text-slate-50",
  listClass: "text-xl font-bold italic leading-relaxed tracking-tight text-slate-50",
  strongClass: "font-black text-white",
  linkClass:
    "font-bold text-cyan-300 underline decoration-cyan-300/60 underline-offset-4 transition-colors hover:text-cyan-200",
  inlineCodeClass:
    "rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[12px] font-semibold text-white",
  preClass:
    "mb-3 overflow-x-auto rounded-2xl bg-slate-950/70 px-4 py-3 text-[12px] leading-6 text-slate-100 last:mb-0",
  blockquoteClass:
    "mb-3 rounded-2xl border-l-4 border-cyan-300/80 bg-white/10 px-4 py-3 text-xl font-bold italic leading-relaxed tracking-tight text-slate-50 last:mb-0",
});

const summaryModalNarrativeMarkdownComponents = createMarkdownComponents({
  paragraphClass: "text-[18px] font-medium leading-[1.95] text-slate-700",
  listClass: "text-[18px] font-medium leading-[1.95] text-slate-700",
});

const summaryModalOverviewMarkdownComponents = createMarkdownComponents({
  paragraphClass: "text-[18px] font-medium leading-relaxed text-slate-600",
  listClass: "text-[18px] font-medium leading-relaxed text-slate-600",
});

const summaryModalKeyPointMarkdownComponents = createMarkdownComponents({
  paragraphClass: "text-[17px] font-bold leading-snug text-slate-800",
  listClass: "text-[17px] font-bold leading-snug text-slate-800",
  strongClass: "font-black text-slate-950",
});

/* Icons */
const ArrowLeftIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className="h-5 w-5 font-bold"
  >
    <path
      fillRule="evenodd"
      d="M12.78 15.53a.75.75 0 0 1-1.06 0l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 1 1 1.06 1.06L9.06 10l3.72 3.72a.75.75 0 0 1 0 1.06Z"
      clipRule="evenodd"
    />
  </svg>
);

const DownloadIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className="h-5 w-5"
  >
    <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v7.19L7.03 7.72a.75.75 0 0 0-1.06 1.06l3.5 3.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 1 0-1.06-1.06l-2.22 2.22V2.75Z" />
    <path d="M3.5 13.25a.75.75 0 0 0-1.5 0v1A2.75 2.75 0 0 0 4.75 17h10.5A2.75 2.75 0 0 0 18 14.25v-1a.75.75 0 0 0-1.5 0v1c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-1Z" />
  </svg>
);

const ExternalLinkIcon = ({ className = "h-5 w-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className={className}
  >
    <path
      fillRule="evenodd"
      d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Z"
      clipRule="evenodd"
    />
    <path
      fillRule="evenodd"
      d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06Z"
      clipRule="evenodd"
    />
  </svg>
);

const StarIcon = ({ filled }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="1.5"
    className="h-5 w-5"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m9.049 2.927.951 1.927.951-1.927a1 1 0 0 1 1.793 0l1.28 2.594 2.863.416a1 1 0 0 1 .554 1.706l-2.072 2.02.49 2.852a1 1 0 0 1-1.451 1.054L10 12.347l-2.559 1.346A1 1 0 0 1 6 12.639l.49-2.852-2.072-2.02a1 1 0 0 1 .554-1.706l2.863-.416 1.28-2.594a1 1 0 0 1 1.793 0Z"
    />
  </svg>
);

const SparklesIcon = ({ className = "h-5 w-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className={className}
  >
    <path d="M10 1a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 1ZM5.05 3.05a.75.75 0 0 1 1.06 0l1.062 1.06a.75.75 0 1 1-1.06 1.06L5.05 4.11a.75.75 0 0 1 0-1.06ZM14.95 3.05a.75.75 0 0 1 0 1.06l-1.06 1.062a.75.75 0 0 1-1.062-1.06l1.06-1.062a.75.75 0 0 1 1.062 0ZM3 10a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 3 10ZM14 10a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 14 10ZM5.05 16.95a.75.75 0 0 1 0-1.06l1.06-1.062a.75.75 0 0 1 1.06 1.06l-1.06 1.06a.75.75 0 0 1-1.06 0ZM14.95 16.95a.75.75 0 0 1-1.06 0l-1.062-1.06a.75.75 0 0 1 1.06-1.06l1.062 1.06a.75.75 0 0 1 0 1.06ZM10 17a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 17Z" />
  </svg>
);

const SendIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className="h-5 w-5"
  >
    <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288Z" />
  </svg>
);
const ExpandIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className="h-4 w-4"
  >
    <path d="M13.28 7.78l3.22-3.22V7a.75.75 0 001.5 0V3.25a.75.75 0 00-.75-.75H13a.75.75 0 000 1.5h2.44l-3.22 3.22a.75.75 0 101.06 1.06zM6.72 12.22l-3.22 3.22V13a.75.75 0 00-1.5 0v3.75c0 .414.336.75.75.75H6.5a.75.75 0 000-1.5H4.06l3.22-3.22a.75.75 0 10-1.06-1.06z" />
  </svg>
);

const MindMapIcon = ({ className = "h-5 w-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={className}
  >
    <circle cx="5" cy="5" r="2" />
    <circle cx="5" cy="15" r="2" />
    <circle cx="15" cy="10" r="2.5" />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6.8 6.2 12.6 8.9M6.8 13.8 12.6 11.1"
    />
  </svg>
);

const ChatBubbleIcon = ({ className = "h-5 w-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M5.5 4.5h9A2.5 2.5 0 0 1 17 7v4.5A2.5 2.5 0 0 1 14.5 14H9l-3.5 2v-2H5.5A2.5 2.5 0 0 1 3 11.5V7a2.5 2.5 0 0 1 2.5-2.5Z"
    />
    <path strokeLinecap="round" d="M7 8.5h6M7 11h4" />
  </svg>
);

const HistoryIcon = ({ className = "h-5 w-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10 5.5v4l2.5 1.5M3.5 10a6.5 6.5 0 1 0 2.2-4.87M3.5 3.5v3.25h3.25"
    />
  </svg>
);

const NoteIcon = ({ className = "h-5 w-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M5.25 3.5h7.5A2.25 2.25 0 0 1 15 5.75v8.5a2.25 2.25 0 0 1-2.25 2.25h-7.5A2.25 2.25 0 0 1 3 14.25v-8.5A2.25 2.25 0 0 1 5.25 3.5Z"
    />
    <path strokeLinecap="round" d="M6.5 7h5.5M6.5 10h6.5M6.5 13h4" />
  </svg>
);

const ClockIcon = ({ className = "h-4 w-4" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={className}
  >
    <circle cx="10" cy="10" r="6.75" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6.5v4l2.75 1.5" />
  </svg>
);

const RestoreIcon = ({ className = "h-4 w-4" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6 7.5H3v-3M3.5 7a6.5 6.5 0 1 1-1 3"
    />
  </svg>
);

const CheckCircleIcon = ({ className = "h-4 w-4" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={className}
  >
    <circle cx="10" cy="10" r="6.75" />
    <path strokeLinecap="round" strokeLinejoin="round" d="m7.5 10 1.7 1.7 3.3-3.4" />
  </svg>
);

const SummaryCardIcon = ({ className = "h-4 w-4" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={className}
  >
    <rect x="4" y="3.5" width="12" height="13" rx="2.25" />
    <path strokeLinecap="round" d="M7 7h6M7 10h6M7 13h4" />
  </svg>
);

const AI_TABS = [
  { id: "summary", label: "Summary", Icon: SparklesIcon },
  { id: "mindmap", label: "Mind Map", Icon: MindMapIcon },
  { id: "ask", label: "Ask AI", Icon: ChatBubbleIcon },
  { id: "note", label: "SKS Note", Icon: NoteIcon },
  { id: "related", label: "Related", Icon: ExternalLinkIcon },
];

const getSummaryVersions = (summaryData) =>
  Array.isArray(summaryData?.versions) ? summaryData.versions : [];

const resolveSummaryVersion = (summaryData, preferredSlot) => {
  const versions = getSummaryVersions(summaryData);

  if (preferredSlot) {
    const preferredVersion = versions.find((item) => item.slot === preferredSlot);

    if (preferredVersion) {
      return preferredVersion;
    }
  }

  const selectedVersion = versions.find((item) => item.slot === summaryData?.slot);

  if (selectedVersion) {
    return selectedVersion;
  }

  const activeVersion = versions.find(
    (item) => item.slot === summaryData?.activeSlot,
  );

  if (activeVersion) {
    return activeVersion;
  }

  return versions[0] || summaryData || null;
};

const getMindMapVersions = (mindMapData) =>
  Array.isArray(mindMapData?.versions) ? mindMapData.versions : [];

const normalizeMindMapVersionForView = (version) => {
  if (!version) return null;

  return {
    ...version,
    mindMap: version.mindMap || version.root || null,
    language: version.language || version.summaryLanguage,
    generatedAt: version.generatedAt || "",
  };
};

const resolveMindMapVersion = (mindMapData, preferredSlot) => {
  const versions = getMindMapVersions(mindMapData).map(
    normalizeMindMapVersionForView,
  );

  if (preferredSlot) {
    const preferredVersion = versions.find((item) => item?.slot === preferredSlot);

    if (preferredVersion) {
      return preferredVersion;
    }
  }

  const selectedVersion = versions.find((item) => item?.slot === mindMapData?.slot);

  if (selectedVersion) {
    return selectedVersion;
  }

  const activeVersion = versions.find(
    (item) => item?.slot === mindMapData?.activeSlot,
  );

  if (activeVersion) {
    return activeVersion;
  }

  return normalizeMindMapVersionForView(mindMapData);
};

const getNarrativeSummaryBody = (summaryVersion) => {
  if (
    summaryVersion?.format === "narrative" &&
    typeof summaryVersion?.body === "string" &&
    summaryVersion.body.trim()
  ) {
    return summaryVersion.body.trim();
  }

  return "";
};

const formatSummaryHistoryTimestamp = (value) => {
  if (!value) {
    return "";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const createClientNoteId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `note-${crypto.randomUUID()}`;
  }

  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const normalizeDocumentNotePayload = (note = {}) => {
  const rawNotes = Array.isArray(note.notes) ? note.notes : [];
  const notes = rawNotes
    .map((item, index) => {
      const id =
        typeof item?.id === "string" && item.id.trim()
          ? item.id.trim()
          : index === 0
            ? "default"
            : `note-${index + 1}`;
      const title =
        typeof item?.title === "string" && item.title.trim()
          ? item.title.trim()
          : index === 0
            ? "Study Note"
            : `Study Note ${index + 1}`;
      const content = typeof item?.content === "string" ? item.content : "";

      return {
        id,
        title,
        content,
        createdAt: item?.createdAt || null,
        updatedAt: item?.updatedAt || null,
      };
    })
    .filter((item) => item.id);

  if (notes.length === 0) {
    notes.push({
      id: "default",
      title: typeof note.title === "string" && note.title.trim() ? note.title.trim() : "Study Note",
      content: typeof note.content === "string" ? note.content : "",
      createdAt: note.createdAt || note.updatedAt || null,
      updatedAt: note.updatedAt || null,
    });
  }

  const activeNoteId =
    typeof note.activeNoteId === "string" && note.activeNoteId.trim()
      ? note.activeNoteId.trim()
      : typeof note.id === "string" && note.id.trim()
        ? note.id.trim()
        : notes[0].id;
  const activeNote = notes.find((item) => item.id === activeNoteId) || notes[0];

  return {
    notes,
    activeNoteId: activeNote.id,
    title: activeNote.title,
    savedTitle: activeNote.title,
    content: activeNote.content,
    savedContent: activeNote.content,
    updatedAt: activeNote.updatedAt || null,
  };
};

const findMindMapNodeById = (node, targetId) => {
  if (!node || !targetId) {
    return null;
  }

  if (node.id === targetId) {
    return node;
  }

  for (const child of node.children || []) {
    const match = findMindMapNodeById(child, targetId);

    if (match) {
      return match;
    }
  }

  return null;
};

const findMindMapNodePathById = (node, targetId, path = []) => {
  if (!node || !targetId) {
    return [];
  }

  const nextPath = [...path, node];

  if (node.id === targetId) {
    return nextPath;
  }

  for (const child of node.children || []) {
    const match = findMindMapNodePathById(child, targetId, nextPath);

    if (match.length > 0) {
      return match;
    }
  }

  return [];
};

const escapeRegExp = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const stripMindMapSummaryLeadIn = (summary, label) => {
  let text = String(summary || "").replace(/\s+/g, " ").trim();
  const cleanLabel = String(label || "").replace(/\s+/g, " ").trim();

  if (!text) {
    return "";
  }

  const labelPattern = cleanLabel ? escapeRegExp(cleanLabel) : ".+?";
  const leadInPatterns = [
    new RegExp(
      `^Nội dung này tập trung vào\\s+${labelPattern}\\s*:?\\s*`,
      "i",
    ),
    new RegExp(
      `^Nút này giải thích\\s+${labelPattern}\\.?\\s*Trong tài liệu, ý này được đặt trong mạch:\\s*`,
      "i",
    ),
    new RegExp(
      `^Ý này nhấn mạnh\\s+${labelPattern}\\.?\\s*Trong tài liệu, nội dung này được đặt trong bối cảnh:\\s*`,
      "i",
    ),
    new RegExp(
      `^This node focuses on\\s+${labelPattern}\\s*:?\\s*`,
      "i",
    ),
    new RegExp(
      `^This node explains\\s+${labelPattern}\\.?\\s*In the document, it appears in this context:\\s*`,
      "i",
    ),
    new RegExp(
      `^This node highlights\\s+${labelPattern}\\.?\\s*In the document, it appears in this context:\\s*`,
      "i",
    ),
  ];

  for (const pattern of leadInPatterns) {
    text = text.replace(pattern, "").trim();
  }

  return text;
};

const lowercaseFirstLetter = (value) => {
  const text = String(value || "").trim();

  if (!text) {
    return "";
  }

  return `${text.charAt(0).toLocaleLowerCase("vi-VN")}${text.slice(1)}`;
};

const ensureSentence = (value) => {
  const text = String(value || "").trim();

  if (!text) {
    return "";
  }

  return /[.!?。]$/.test(text) ? text : `${text}.`;
};

const isMindMapNodeVisible = (
  node,
  targetId,
  expandedNodeIds = new Set(),
  showAllNodes = false,
  rootId = node?.id,
) => {
  if (!node || !targetId) {
    return false;
  }

  if (node.id === targetId) {
    return true;
  }

  const shouldVisitChildren =
    showAllNodes || node.id === rootId || expandedNodeIds.has(node.id);

  if (!shouldVisitChildren) {
    return false;
  }

  return (node.children || []).some((child) =>
    isMindMapNodeVisible(
      child,
      targetId,
      expandedNodeIds,
      showAllNodes,
      rootId,
    ),
  );
};

const collectMindMapExpandedIds = (node, maxExpandableDepth = 1) => {
  if (!node) {
    return [];
  }

  const expandedIds = new Set();

  const visit = (currentNode, depth) => {
    if (!currentNode || depth > maxExpandableDepth) {
      return;
    }

    if (depth === 0 || (currentNode.children || []).length > 0) {
      expandedIds.add(currentNode.id);
    }

    if (depth === maxExpandableDepth) {
      return;
    }

    (currentNode.children || []).forEach((child) => visit(child, depth + 1));
  };

  visit(node, 0);

  return Array.from(expandedIds);
};

const CloseIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className="h-5 w-5"
  >
    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
  </svg>
);

/* Reusable Components */
const Skeleton = ({ className = "" }) => (
  <div className={`animate-pulse rounded-2xl bg-sks-slate-100 ${className}`} />
);

const InlineAlert = ({ children, tone = "info" }) => {
  const tones = {
    info: "border-sks-primary/10 bg-sks-primary-light/50 text-sks-primary",
    error: "border-rose-200 bg-rose-50 text-rose-700",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
  };
  return (
    <div
      className={`rounded-2xl border px-5 py-4 text-[14px] font-medium leading-relaxed ${tones[tone]} animate-fade-up`}
    >
      {children}
    </div>
  );
};

const RelatedCard = ({ document, onOpen }) => {
  const file = getFilePresentation(document);
  const docFileTypeTone = file.accent
    .replace("bg-teal-50", "bg-sks-primary-light")
    .replace("text-teal-700", "text-sks-primary");

  return (
    <button
      type="button"
      onClick={() => onOpen(document.id)}
      className="group flex w-full items-start gap-4 rounded-2xl border border-sks-slate-100 bg-white p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-sks-primary/20 hover:shadow-sks-soft active:scale-[0.98] animate-fade-up"
    >
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm ${docFileTypeTone}`}
      >
        {file.label}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-black tracking-tight text-sks-slate-900 transition-colors group-hover:text-sks-primary">
          {document.title}
        </p>
        <p className="mt-1 text-[11px] font-bold text-sks-slate-400">
          {document.folderName || "General Workspace"} |{" "}
          {document.formattedFileSize || "-"}
        </p>
      </div>
    </button>
  );
};

/* Main Component */
const DocumentViewer = () => {
  const navigate = useNavigate();
  const { documentId } = useParams();
  const { clearDocViewer } = useDocViewer();

  /* Core state */
  const [documentData, setDocumentData] = useState(null);
  const [relatedDocuments, setRelatedDocuments] = useState([]);
  const [fileUrl, setFileUrl] = useState("");
  const [contentType, setContentType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* AI Rail state */
  const [activeTab, setActiveTab] = useState("summary");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(580);

  const [summaryState, setSummaryState] = useState({
    loading: false,
    error: "",
    data: null,
  });
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isSummaryHistoryOpen, setIsSummaryHistoryOpen] = useState(false);
  const [isSummaryRefreshConfirmOpen, setIsSummaryRefreshConfirmOpen] =
    useState(false);
  const [summaryInstructionDraft, setSummaryInstructionDraft] = useState("");
  const [summaryInstructionError, setSummaryInstructionError] = useState("");
  const [selectedSummarySlot, setSelectedSummarySlot] = useState(null);
  const [isMindMapModalOpen, setIsMindMapModalOpen] = useState(false);
  const [isMindMapHistoryOpen, setIsMindMapHistoryOpen] = useState(false);
  const [isMindMapRefreshConfirmOpen, setIsMindMapRefreshConfirmOpen] =
    useState(false);
  const [mindMapInstructionDraft, setMindMapInstructionDraft] = useState("");
  const [mindMapInstructionError, setMindMapInstructionError] = useState("");
  const [selectedMindMapSlot, setSelectedMindMapSlot] = useState(null);
  const [mindMapState, setMindMapState] = useState({
    loading: false,
    error: "",
    data: null,
  });
  const [selectedMindMapNodeId, setSelectedMindMapNodeId] = useState(null);
  const [mindMapViewMode, setMindMapViewMode] = useState("explore");
  const [expandedMindMapNodeIds, setExpandedMindMapNodeIds] = useState([]);
  const [askQuestion, setAskQuestion] = useState("");
  const [askHistoryState, setAskHistoryState] = useState({
    loading: false,
    error: "",
    items: [],
    loaded: false,
    clearing: false,
  });
  const [askState, setAskState] = useState({
    loading: false,
    error: "",
    pendingQuestion: "",
  });
  const [noteState, setNoteState] = useState({
    loading: false,
    saving: false,
    error: "",
    notes: [],
    activeNoteId: null,
    title: "Study Note",
    savedTitle: "Study Note",
    content: "",
    savedContent: "",
    updatedAt: null,
    loaded: false,
  });
  const [isNoteHistoryOpen, setIsNoteHistoryOpen] = useState(false);
  const [isNoteTitleModalOpen, setIsNoteTitleModalOpen] = useState(false);
  const [noteTitleDraft, setNoteTitleDraft] = useState("");

  const chatInputRef = useRef(null);
  const askThreadRef = useRef(null);
  const isResizing = useRef(false);
  const containerRef = useRef(null);

  /* Resize Handler */
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (moveEvent) => {
      if (!isResizing.current || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = containerRect.right - moveEvent.clientX;
      setSidebarWidth(
        Math.max(320, Math.min(newWidth, containerRect.width * 0.65)),
      );
    };

    const onMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  /* Data Persistence */
  useEffect(() => {
    if (documentData?.id) rememberRecentDocument(documentData.id);
  }, [documentData?.id]);

  /* Data Loading */
  useEffect(() => {
    if (!documentId) return undefined;
    let isActive = true;
    let objectUrl = "";

    const load = async () => {
      try {
        if (isActive) setLoading(true);
        const docResult = await getDocumentDetails(documentId);
        const [relResult, fileResult] = await Promise.allSettled([
          getRelatedDocuments(documentId, 4),
          fetchDocumentFile(documentId),
        ]);

        if (fileResult.status === "fulfilled") {
          objectUrl = URL.createObjectURL(fileResult.value.blob);
        }
        if (!isActive) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        setDocumentData(docResult.document);
        setRelatedDocuments(
          relResult.status === "fulfilled"
            ? relResult.value.documents || []
            : [],
        );
        setFileUrl(objectUrl);
        setContentType(
          fileResult.status === "fulfilled"
            ? fileResult.value.contentType || fileResult.value.blob.type || ""
            : "",
        );

        const partials = [];
        if (relResult.status === "rejected")
          partials.push("Related documents are unavailable.");
        if (fileResult.status === "rejected")
          partials.push("Preview file could not be loaded.");
        setError(partials.join(" "));
      } catch (err) {
        if (isActive) {
          setDocumentData(null);
          setError(
            err.response?.data?.message ||
              "Failed to load the document viewer.",
          );
        }
      } finally {
        if (isActive) setLoading(false);
      }
    };

    void load();
    return () => {
      isActive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId]);

  /* Tabs Cleanup */
  useEffect(() => {
    setActiveTab("summary");
    setSummaryState({ loading: false, error: "", data: null });
    setIsSummaryModalOpen(false);
    setIsSummaryHistoryOpen(false);
    setIsSummaryRefreshConfirmOpen(false);
    setSummaryInstructionDraft("");
    setSummaryInstructionError("");
    setSelectedSummarySlot(null);
    setIsMindMapModalOpen(false);
    setIsMindMapHistoryOpen(false);
    setIsMindMapRefreshConfirmOpen(false);
    setMindMapInstructionDraft("");
    setMindMapInstructionError("");
    setSelectedMindMapSlot(null);
    setMindMapState({ loading: false, error: "", data: null });
    setSelectedMindMapNodeId(null);
    setMindMapViewMode("explore");
    setExpandedMindMapNodeIds([]);
    setAskQuestion("");
    setAskHistoryState({
      loading: false,
      error: "",
      items: [],
      loaded: false,
      clearing: false,
    });
    setAskState({ loading: false, error: "", pendingQuestion: "" });
    setNoteState({
      loading: false,
      saving: false,
      error: "",
      notes: [],
      activeNoteId: null,
      title: "Study Note",
      savedTitle: "Study Note",
      content: "",
      savedContent: "",
      updatedAt: null,
      loaded: false,
    });
    setIsNoteHistoryOpen(false);
    setIsNoteTitleModalOpen(false);
    setNoteTitleDraft("");
  }, [documentId]);

  /* AI Logic */
  const loadSummary = useCallback(
    async (language = selectedLanguage, options = {}) => {
      if (!documentId || summaryState.loading) return false;
      try {
        const targetLanguage = language || selectedLanguage;
        const forceRefresh = Boolean(options.forceRefresh);
        const targetSlot = options.slot || undefined;
        const instruction =
          typeof options.instruction === "string" ? options.instruction : undefined;
        setSelectedLanguage(targetLanguage);
        setSummaryState((s) => ({ ...s, loading: true, error: "" }));
        const result = await getDocumentSummary(documentId, targetLanguage, {
          forceRefresh,
          slot: targetSlot,
          instruction,
        });
        setSummaryState({
          loading: false,
          error: "",
          data: result,
        });
        setSelectedSummarySlot(
          result.slot || result.activeSlot || targetSlot || null,
        );
        setSummaryInstructionError("");
        if (forceRefresh) {
          setSummaryInstructionDraft("");
        }
        return true;
      } catch (err) {
        const errorMessage =
          err.response?.data?.message || "AI could not summarize this.";
        setSummaryState((current) => ({
          loading: false,
          error: current.data && options.forceRefresh ? "" : errorMessage,
          data: current.data,
        }));
        if (options.forceRefresh) {
          setSummaryInstructionError(
            err.response?.data?.message || "AI could not create a custom summary.",
          );
        }
        return false;
      }
    },
    [documentId, selectedLanguage, summaryState.loading],
  );

  const summaryVersions = useMemo(
    () => getSummaryVersions(summaryState.data),
    [summaryState.data],
  );
  const activeSummaryVersion = useMemo(
    () => resolveSummaryVersion(summaryState.data, selectedSummarySlot),
    [selectedSummarySlot, summaryState.data],
  );
  const defaultSummaryVersion = useMemo(
    () => summaryVersions.find((item) => item.slot === "default") || null,
    [summaryVersions],
  );
  const summaryHistoryVersions = useMemo(
    () => summaryVersions.filter((item) => item.slot === "custom"),
    [summaryVersions],
  );

  const loadMindMap = useCallback(
    async (language = selectedLanguage, options = {}) => {
      if (!documentId || mindMapState.loading) return false;
      try {
        const targetLanguage = language || selectedLanguage;
        const forceRefresh = Boolean(options.forceRefresh);
        const targetSlot = options.slot || undefined;
        const instruction =
          typeof options.instruction === "string" ? options.instruction : undefined;
        setSelectedLanguage(targetLanguage);
        setMindMapState((s) => ({ ...s, loading: true, error: "" }));
        const result = await getDocumentMindMap(documentId, targetLanguage, {
          forceRefresh,
          slot: targetSlot,
          instruction,
        });
        setMindMapState({
          loading: false,
          error: "",
          data: result,
        });
        setSelectedMindMapSlot(
          result.slot || result.activeSlot || targetSlot || null,
        );
        setMindMapInstructionError("");
        if (forceRefresh) {
          setMindMapInstructionDraft("");
        }
        const rootId = result.mindMap?.id || "root";
        const defaultExpandedIds = collectMindMapExpandedIds(
          result.mindMap,
          1,
        );
        setSelectedMindMapNodeId(rootId);
        setMindMapViewMode("explore");
        setExpandedMindMapNodeIds(
          defaultExpandedIds.length > 0
            ? defaultExpandedIds
            : rootId
              ? [rootId]
              : [],
        );
        return true;
      } catch (err) {
        const errorMessage =
          err.response?.data?.message || "AI could not build this mind map.";
        setMindMapState((current) => ({
          loading: false,
          error: current.data && options.forceRefresh ? "" : errorMessage,
          data: current.data,
        }));
        if (options.forceRefresh) {
          setMindMapInstructionError(errorMessage);
        } else {
          setSelectedMindMapNodeId(null);
          setExpandedMindMapNodeIds([]);
        }
        return false;
      }
    },
    [documentId, mindMapState.loading, selectedLanguage],
  );

  const mindMapVersions = useMemo(
    () => getMindMapVersions(mindMapState.data),
    [mindMapState.data],
  );
  const activeMindMapVersion = useMemo(
    () => resolveMindMapVersion(mindMapState.data, selectedMindMapSlot),
    [selectedMindMapSlot, mindMapState.data],
  );
  const activeMindMapRoot = activeMindMapVersion?.mindMap || null;
  const defaultMindMapVersion = useMemo(
    () =>
      mindMapVersions
        .map(normalizeMindMapVersionForView)
        .find((item) => item?.slot === "default") || null,
    [mindMapVersions],
  );
  const mindMapHistoryVersions = useMemo(
    () =>
      mindMapVersions
        .map(normalizeMindMapVersionForView)
        .filter((item) => item?.slot === "custom"),
    [mindMapVersions],
  );

  const loadAskHistory = useCallback(async () => {
    if (!documentId || askHistoryState.loading) return;

    try {
      setAskHistoryState((current) => ({
        ...current,
        loading: true,
        error: "",
      }));
      const result = await getDocumentAskHistory(documentId);
      setAskHistoryState({
        loading: false,
        error: "",
        items: result.items || [],
        loaded: true,
        clearing: false,
      });
    } catch (err) {
      setAskHistoryState((current) => ({
        ...current,
        loading: false,
        error:
          err.response?.data?.message || "Could not load question history.",
        loaded: true,
      }));
    }
  }, [documentId, askHistoryState.loading]);

  const loadDocumentNote = useCallback(async () => {
    if (!documentId || noteState.loading || noteState.loaded) return;

    try {
      setNoteState((current) => ({
        ...current,
        loading: true,
        error: "",
      }));
      const result = await getDocumentNote(documentId);
      const normalizedNote = normalizeDocumentNotePayload(result.note || {});

      setNoteState({
        loading: false,
        saving: false,
        error: "",
        ...normalizedNote,
        loaded: true,
      });
    } catch (err) {
      setNoteState((current) => ({
        ...current,
        loading: false,
        error: err.response?.data?.message || "Could not load SKS Note.",
        loaded: true,
      }));
    }
  }, [documentId, noteState.loaded, noteState.loading]);

  const handleSaveNote = useCallback(async () => {
    if (!documentId || noteState.saving) return;

    const needsTitle =
      !noteState.savedTitle ||
      !noteState.title ||
      noteState.title.trim().toLowerCase() === "untitled note";

    if (needsTitle) {
      setNoteTitleDraft(
        noteState.title && noteState.title !== "Untitled note"
          ? noteState.title
          : "",
      );
      setIsNoteTitleModalOpen(true);
      return;
    }

    try {
      setNoteState((current) => ({
        ...current,
        saving: true,
        error: "",
      }));
      const result = await saveDocumentNote(documentId, noteState.content, {
        noteId: noteState.activeNoteId,
        title: noteState.title,
      });
      const normalizedNote = normalizeDocumentNotePayload(result.note || {});

      setNoteState((current) => ({
        ...current,
        saving: false,
        error: "",
        ...normalizedNote,
        loaded: true,
      }));
    } catch (err) {
      setNoteState((current) => ({
        ...current,
        saving: false,
        error: err.response?.data?.message || "Could not save SKS Note.",
      }));
    }
  }, [
    documentId,
    noteState.activeNoteId,
    noteState.content,
    noteState.saving,
    noteState.savedTitle,
    noteState.title,
  ]);

  const commitSaveNoteWithTitle = useCallback(
    async (title) => {
      if (!documentId || noteState.saving) return;

      const normalizedTitle = title.trim();

      if (!normalizedTitle) {
        setNoteState((current) => ({
          ...current,
          error: "Please enter a note title before saving.",
        }));
        return;
      }

      try {
        setNoteState((current) => ({
          ...current,
          saving: true,
          error: "",
          title: normalizedTitle,
        }));
        const result = await saveDocumentNote(documentId, noteState.content, {
          noteId: noteState.activeNoteId,
          title: normalizedTitle,
        });
        const normalizedNote = normalizeDocumentNotePayload(result.note || {});

        setNoteState((current) => ({
          ...current,
          saving: false,
          error: "",
          ...normalizedNote,
          loaded: true,
        }));
        setIsNoteTitleModalOpen(false);
        setNoteTitleDraft("");
      } catch (err) {
        setNoteState((current) => ({
          ...current,
          saving: false,
          error: err.response?.data?.message || "Could not save SKS Note.",
        }));
      }
    },
    [
      documentId,
      noteState.activeNoteId,
      noteState.content,
      noteState.saving,
    ],
  );

  const handleSelectNote = useCallback((noteId) => {
    setNoteState((current) => {
      if (
        current.content !== current.savedContent ||
        current.title !== current.savedTitle
      ) {
        const shouldDiscard = window.confirm(
          "You have unsaved changes in this note. Switch notes and discard them?",
        );

        if (!shouldDiscard) {
          return current;
        }
      }

      const nextNote = current.notes.find((note) => note.id === noteId);

      if (!nextNote) {
        return current;
      }

      return {
        ...current,
        activeNoteId: nextNote.id,
        title: nextNote.title,
        savedTitle: nextNote.title,
        content: nextNote.content,
        savedContent: nextNote.content,
        updatedAt: nextNote.updatedAt || null,
        error: "",
      };
    });
  }, []);

  const handleCreateNote = useCallback(() => {
    setNoteState((current) => {
      const now = new Date().toISOString();
      const nextIndex = current.notes.length + 1;
      const nextNote = {
        id: createClientNoteId(),
        title: "Untitled note",
        content: "",
        createdAt: now,
        updatedAt: null,
      };

      return {
        ...current,
        notes: [nextNote, ...current.notes],
        activeNoteId: nextNote.id,
        title: nextNote.title,
        savedTitle: "",
        content: "",
        savedContent: "",
        updatedAt: null,
        error: "",
      };
    });
  }, []);

  const handleRenameNote = useCallback(
    async (noteId, title) => {
      if (!documentId || noteState.saving) return;

      const targetNote = noteState.notes.find((note) => note.id === noteId);
      const normalizedTitle = title.trim();

      if (!targetNote || !normalizedTitle) return;

      try {
        setNoteState((current) => ({ ...current, saving: true, error: "" }));
        const contentToSave =
          noteId === noteState.activeNoteId
            ? noteState.content
            : targetNote.content;
        const result = await saveDocumentNote(documentId, contentToSave, {
          noteId,
          title: normalizedTitle,
        });
        const normalizedNote = normalizeDocumentNotePayload(result.note || {});

        setNoteState((current) => ({
          ...current,
          saving: false,
          error: "",
          ...normalizedNote,
          loaded: true,
        }));
      } catch (err) {
        setNoteState((current) => ({
          ...current,
          saving: false,
          error: err.response?.data?.message || "Could not rename note.",
        }));
      }
    },
    [
      documentId,
      noteState.activeNoteId,
      noteState.content,
      noteState.notes,
      noteState.saving,
    ],
  );

  const handleDeleteNote = useCallback(
    async (noteId) => {
      if (!documentId || noteState.saving) return;

      const shouldDelete = window.confirm("Delete this note?");

      if (!shouldDelete) return;

      try {
        setNoteState((current) => ({ ...current, saving: true, error: "" }));
        const result = await deleteDocumentNote(documentId, noteId);
        const normalizedNote = normalizeDocumentNotePayload(result.note || {});

        setNoteState((current) => ({
          ...current,
          saving: false,
          error: "",
          ...normalizedNote,
          loaded: true,
        }));
      } catch (err) {
        setNoteState((current) => ({
          ...current,
          saving: false,
          error: err.response?.data?.message || "Could not delete note.",
        }));
      }
    },
    [documentId, noteState.saving],
  );

  const handleClearAskHistory = useCallback(async () => {
    if (!documentId || askHistoryState.clearing) return;

    try {
      setAskHistoryState((current) => ({
        ...current,
        clearing: true,
        error: "",
      }));
      await clearDocumentAskHistory(documentId);
      setAskHistoryState({
        loading: false,
        error: "",
        items: [],
        loaded: true,
        clearing: false,
      });
      setAskState({ loading: false, error: "", pendingQuestion: "" });
    } catch (err) {
      setAskHistoryState((current) => ({
        ...current,
        clearing: false,
        error:
          err.response?.data?.message || "Could not clear question history.",
      }));
    }
  }, [documentId, askHistoryState.clearing]);

  /* Actions */
  const handleToggleFavorite = async (id) => {
    try {
      await toggleFavorite(id);
      setDocumentData((c) =>
        c && c.id === id ? { ...c, isFavorite: !c.isFavorite } : c,
      );
    } catch (err) {
      console.error("Favorite toggle failed:", err);
    }
  };

  const handleOpenRawFile = useCallback(async () => {
    if (!documentId) return;
    try {
      await openDocumentFile(documentId);
    } catch (err) {
      console.error("Open fail:", err);
    }
  }, [documentId]);

  const handleDownload = async (id, title) => {
    try {
      await downloadDocumentFile(id, title);
    } catch (err) {
      console.error("Download fail:", err);
    }
  };

  /* Actions */
  useEffect(() => {
    return () => clearDocViewer();
  }, [clearDocViewer]);

  useEffect(() => {
    if (
      activeTab !== "ask" ||
      askHistoryState.loaded ||
      askHistoryState.loading
    ) {
      return;
    }

    void loadAskHistory();
  }, [
    activeTab,
    askHistoryState.loaded,
    askHistoryState.loading,
    loadAskHistory,
  ]);

  useEffect(() => {
    if (activeTab !== "note" || noteState.loaded || noteState.loading) {
      return;
    }

    void loadDocumentNote();
  }, [
    activeTab,
    loadDocumentNote,
    noteState.loaded,
    noteState.loading,
  ]);

  useEffect(() => {
    if (!askThreadRef.current) {
      return;
    }

    askThreadRef.current.scrollTop = askThreadRef.current.scrollHeight;
  }, [askHistoryState.items.length, askState.loading]);

  const handleAsk = async () => {
    const trimmedQuestion = askQuestion.trim();

    if (!documentId || !trimmedQuestion || askState.loading) return;

    try {
      setAskState({
        loading: true,
        error: "",
        pendingQuestion: trimmedQuestion,
      });
      const result = await askDocument(documentId, trimmedQuestion);
      setAskHistoryState((current) => ({
        ...current,
        items: [...current.items, result.historyItem].slice(-6),
        loaded: true,
        error: "",
      }));
      setAskQuestion("");
      setAskState({ loading: false, error: "", pendingQuestion: "" });
    } catch (err) {
      setAskState({
        loading: false,
        error: err.response?.data?.message || "AI consultation failed.",
        pendingQuestion: "",
      });
    }
  };

  const handleAskKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleAsk();
    }
  };

  const selectedMindMapNode = useMemo(
    () =>
      findMindMapNodeById(activeMindMapRoot, selectedMindMapNodeId),
    [activeMindMapRoot, selectedMindMapNodeId],
  );

  const selectedMindMapNodePath = useMemo(
    () => findMindMapNodePathById(activeMindMapRoot, selectedMindMapNodeId),
    [activeMindMapRoot, selectedMindMapNodeId],
  );

  const selectedMindMapParentNode =
    selectedMindMapNodePath.length > 1
      ? selectedMindMapNodePath[selectedMindMapNodePath.length - 2]
      : null;
  const selectedMindMapSiblingNodes = useMemo(
    () =>
      selectedMindMapParentNode?.children?.filter(
        (node) => node.id !== selectedMindMapNode?.id,
      ) || [],
    [selectedMindMapParentNode, selectedMindMapNode?.id],
  );

  const rootMindMapId = activeMindMapRoot?.id || null;

  const expandedMindMapNodeIdSet = useMemo(
    () => new Set(expandedMindMapNodeIds),
    [expandedMindMapNodeIds],
  );

  const handleMindMapNodeSelect = useCallback((nodeId) => {
    setSelectedMindMapNodeId(nodeId);
  }, []);

  const handleMindMapNoteClose = useCallback(() => {
    setSelectedMindMapNodeId(null);
  }, []);

  const handleMindMapNodeToggle = useCallback(
    (nodeId) => {
      if (mindMapViewMode === "all") {
        return;
      }

      const targetNode = findMindMapNodeById(
        activeMindMapRoot,
        nodeId,
      );

      if (!targetNode?.children?.length) {
        return;
      }

      const isCollapsing = expandedMindMapNodeIds.includes(nodeId);

      if (
        isCollapsing &&
        selectedMindMapNodeId &&
        selectedMindMapNodeId !== nodeId &&
        findMindMapNodeById(targetNode, selectedMindMapNodeId)
      ) {
        setSelectedMindMapNodeId(nodeId);
      }

      setExpandedMindMapNodeIds((currentIds) =>
        currentIds.includes(nodeId)
          ? currentIds.filter((currentId) => currentId !== nodeId)
          : [...currentIds, nodeId],
      );
    },
    [
      activeMindMapRoot,
      expandedMindMapNodeIds,
      mindMapViewMode,
      selectedMindMapNodeId,
    ],
  );

  const handleMindMapViewModeChange = useCallback(
    (mode) => {
      setMindMapViewMode(mode);

      if (mode === "explore") {
        const nextExpandedIds =
          expandedMindMapNodeIds.length > 0
            ? expandedMindMapNodeIds
            : collectMindMapExpandedIds(activeMindMapRoot, 1);

        if (expandedMindMapNodeIds.length === 0 && rootMindMapId) {
          setExpandedMindMapNodeIds(
            nextExpandedIds.length > 0 ? nextExpandedIds : [rootMindMapId],
          );
        }

        if (
          selectedMindMapNodeId &&
          !isMindMapNodeVisible(
            activeMindMapRoot,
            selectedMindMapNodeId,
            new Set(nextExpandedIds),
            false,
            rootMindMapId,
          )
        ) {
          setSelectedMindMapNodeId(rootMindMapId);
        }
      }
    },
    [
      activeMindMapRoot,
      expandedMindMapNodeIds,
      rootMindMapId,
      selectedMindMapNodeId,
    ],
  );

  const handleMindMapLanguageChange = useCallback(
    (language) => {
      if (activeMindMapRoot) {
        void loadMindMap(language);
        return;
      }

      setSelectedLanguage(language);
    },
    [activeMindMapRoot, loadMindMap],
  );

  const handleSummarySlotChange = useCallback(
    (slot) => {
      if (!summaryVersions.some((item) => item.slot === slot)) {
        return;
      }

      setSelectedSummarySlot(slot);
    },
    [summaryVersions],
  );

  const handleMindMapSlotChange = useCallback(
    (slot) => {
      if (!mindMapVersions.some((item) => item.slot === slot)) {
        return;
      }

      setSelectedMindMapSlot(slot);
      const nextVersion = resolveMindMapVersion(mindMapState.data, slot);
      const nextRoot = nextVersion?.mindMap || null;
      const rootId = nextRoot?.id || "root";
      const defaultExpandedIds = collectMindMapExpandedIds(nextRoot, 1);

      setSelectedMindMapNodeId(rootId);
      setMindMapViewMode("explore");
      setExpandedMindMapNodeIds(
        defaultExpandedIds.length > 0
          ? defaultExpandedIds
          : rootId
            ? [rootId]
            : [],
      );
    },
    [mindMapState.data, mindMapVersions],
  );

  /* Tab Components */
  const renderSummary = () => {
    if (!summaryState.loading && !summaryState.data && !summaryState.error)
      return (
        <div className="flex flex-col items-center justify-center py-10 text-center animate-fade-in">
          <div className="relative mb-10">
            <div className="absolute -inset-8 rounded-full bg-cyan-100/40 animate-pulse" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-3xl shadow-2xl shadow-cyan-500/30">
              <SparklesIcon className="h-8 w-8" />
            </div>
          </div>

          <h3 className="text-[14px] font-[1000] text-slate-900 uppercase tracking-[0.2em] mb-3">
            Asset Intelligence
          </h3>
          <p className="text-[12px] font-medium text-slate-400 max-w-[240px] leading-relaxed mb-10">
            Select a target language to synthesize wisdom from this asset.
          </p>

          <div className="mb-8 flex p-1.5 rounded-2xl bg-slate-100/80 ring-1 ring-inset ring-slate-200/40 w-full max-w-[240px]">
            <button
              onClick={() => setSelectedLanguage("vi")}
              className={`flex-1 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all ${selectedLanguage === "vi" ? "bg-white text-cyan-600 shadow-sm ring-1 ring-slate-200/50" : "text-slate-400 hover:text-slate-600"}`}
            >
              Vietnamese
            </button>
            <button
              onClick={() => setSelectedLanguage("en")}
              className={`flex-1 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all ${selectedLanguage === "en" ? "bg-white text-cyan-600 shadow-sm ring-1 ring-slate-200/50" : "text-slate-400 hover:text-slate-600"}`}
            >
              English
            </button>
          </div>

          <button
            onClick={() => void loadSummary(selectedLanguage)}
            className="group relative flex h-14 w-full items-center justify-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 px-8 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-cyan-500/20 transition-all hover:scale-[1.02] active:scale-95"
          >
            <span>Generate Summary</span>
            <ArrowLeftIcon />
          </button>
        </div>
      );

    if (summaryState.loading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-700">
          <div className="relative mb-12 flex h-32 w-32 items-center justify-center">
            {/* Outer rings */}
            <div className="absolute inset-0 rounded-full border border-cyan-400/20 shadow-[0_0_20px_rgba(34,211,238,0.2)] animate-[spin_4s_linear_infinite]" />
            <div className="absolute -inset-2 rounded-full border border-dashed border-blue-500/30 animate-[spin_6s_linear_infinite_reverse]" />
            <div className="absolute -inset-4 rounded-full border border-cyan-300/10 animate-[spin_8s_linear_infinite]" />
            
            {/* Core Orb */}
            <div className="absolute h-20 w-20 animate-pulse rounded-full bg-cyan-400/20 blur-xl" style={{ animationDuration: '2s' }} />
            <div className="absolute h-16 w-16 animate-pulse rounded-full bg-blue-500/30 blur-lg" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-[1.8rem] bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-[0_0_30px_rgba(6,182,212,0.4)]">
              <SparklesIcon className="h-8 w-8 animate-pulse" />
            </div>
            {/* Scanning line */}
            <div className="absolute top-0 bottom-0 left-1/2 w-16 -translate-x-1/2 overflow-hidden overflow-hidden rounded-full mix-blend-overlay">
               <div className="absolute left-0 right-0 h-1 bg-white/60 blur-[1px] animate-[bounce_2s_infinite]" />
            </div>
          </div>
          
          <h3 className="text-[13px] font-[1000] text-slate-900 uppercase tracking-[0.3em] mb-3 animate-pulse">
            Synthesizing Knowledge
          </h3>
          <p className="text-[12px] font-medium text-slate-400 max-w-[280px] text-center leading-relaxed mb-8">
            AI is analyzing document structure and extracting key narrative concepts.
          </p>
          
          {/* Progress Indication */}
          <div className="flex w-56 flex-col gap-2.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-1/2 animate-[pulse_1.5s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 blur-[0.5px]" style={{ transformOrigin: 'left' }} />
            </div>
            <div className="flex justify-between px-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-cyan-600">Processing Data Elements</span>
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 animate-pulse">Please wait</span>
            </div>
          </div>
        </div>
      );
    }

    if (summaryState.error)
      return <InlineAlert tone="error">{summaryState.error}</InlineAlert>;
    if (!summaryState.data || !activeSummaryVersion) return null;

    const { title, overview, key_points, conclusion } = activeSummaryVersion;
    const activeSummaryLanguage =
      activeSummaryVersion.language || selectedLanguage;
    const narrativeBody = getNarrativeSummaryBody(activeSummaryVersion);

    return (
      <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
              <SparklesIcon className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">
                Summary
              </h3>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                AI Summary
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200/40">
              <button
                type="button"
                onClick={() => void loadSummary("vi")}
                className={`rounded-lg px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${activeSummaryLanguage === "vi" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-700"}`}
              >
                VI
              </button>
              <button
                type="button"
                onClick={() => void loadSummary("en")}
                className={`rounded-lg px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${activeSummaryLanguage === "en" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-700"}`}
              >
                EN
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsSummaryHistoryOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-slate-100 px-3.5 py-2 text-[9px] font-[1000] uppercase tracking-[0.15em] text-slate-500 ring-1 ring-slate-200/40 transition-all hover:bg-white hover:text-cyan-600 hover:shadow-sks-soft"
              title="Open summary history"
            >
              <HistoryIcon className="h-3.5 w-3.5" />
              History
            </button>
            <button
              type="button"
              onClick={() => {
                setSummaryInstructionError("");
                setIsSummaryRefreshConfirmOpen(true);
              }}
              className="rounded-xl bg-slate-100 px-3.5 py-2 text-[9px] font-[1000] uppercase tracking-[0.15em] text-slate-500 ring-1 ring-slate-200/40 transition-all hover:bg-white hover:text-cyan-600 hover:shadow-sks-soft"
              title="Create a custom summary for the current language"
            >
              <SparklesIcon className="mr-2 inline h-3.5 w-3.5" />
              New Summary
            </button>
            <button
              onClick={() => setIsSummaryModalOpen(true)}
              className="group flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-400 transition-all hover:bg-white hover:text-cyan-600 hover:shadow-sks-soft"
              title="Focus Mode"
            >
              <ExpandIcon />
            </button>
          </div>
        </div>

        <div className="space-y-10">
          <div className="space-y-4">
            <h2 className="text-3xl font-[1000] tracking-tight text-slate-900 leading-[1.15]">
              {title}
            </h2>
            <div className="h-1.5 w-16 bg-cyan-500 rounded-full" />
          </div>

          {narrativeBody ? (
            <section className="rounded-[2.25rem] border border-slate-200/80 bg-white/90 p-7 shadow-sm">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={summaryNarrativeMarkdownComponents}
              >
                {narrativeBody || ""}
              </ReactMarkdown>
            </section>
          ) : (
            <>
              <section className="space-y-4">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  Overview
                </p>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={summaryOverviewMarkdownComponents}
                >
                  {overview || ""}
                </ReactMarkdown>
              </section>

              <section className="space-y-6">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  Key Findings
                </p>
                <div className="grid grid-cols-1 gap-5">
                  {key_points?.map((point, i) => (
                    <div key={i} className="flex gap-5 group">
                      <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-[10px] font-black text-slate-400 ring-1 ring-slate-200 transition-all group-hover:bg-cyan-50 group-hover:text-cyan-600 group-hover:ring-cyan-200">
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={summaryKeyPointMarkdownComponents}
                        >
                          {point || ""}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-[0_30px_60px_-15px_rgba(15,23,42,0.4)] border border-white/10">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <SparklesIcon className="text-cyan-400 h-16 w-16" />
                </div>
                <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-cyan-500/20 blur-3xl opacity-30" />
                <p className="relative z-10 text-[9px] font-black text-cyan-400 uppercase tracking-[0.4em] mb-4">
                  Conclusion
                </p>
                <div className="relative z-10">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={summaryConclusionMarkdownComponents}
                  >
                    {conclusion || ""}
                  </ReactMarkdown>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderMindMapNodeDetail = (mode = "canvas") => {
    if (!selectedMindMapNode) {
      return null;
    }

    const detailLanguage =
      activeMindMapVersion?.language || mindMapState.data?.language || selectedLanguage;
    const isVietnamese = detailLanguage === "vi";
    const childCount = selectedMindMapNode.children?.length || 0;
    const summaryText =
      selectedMindMapNode.summary ||
      (childCount > 0
        ? isVietnamese
          ? "Phần này gom các ý liên quan để bạn tiếp tục theo dõi trong tài liệu."
          : "This branch groups the next ideas in the document."
        : "");

    const isFloating = mode === "floating";
    const isCanvasOverlay = mode === "canvas";
    const isCompact = mode === "compact";
    const containerClass = isFloating
      ? "pointer-events-auto flex h-full w-[400px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-[32px] border border-white/60 bg-white/75 shadow-[0_0_80px_-20px_rgba(34,211,238,0.15),0_30px_60px_-30px_rgba(15,23,42,0.3)] backdrop-blur-3xl ring-1 ring-slate-900/5 transition-all duration-300 animate-in slide-in-from-right-8 fade-in"
      : isCanvasOverlay
        ? "pointer-events-auto flex max-h-[min(62vh,540px)] w-full max-w-[440px] flex-col overflow-hidden rounded-[28px] border border-white/60 bg-white/85 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.34)] backdrop-blur-3xl ring-1 ring-slate-900/5 transition-all duration-300 animate-in slide-in-from-bottom-6 fade-in"
        : "pointer-events-auto flex max-h-[320px] w-[320px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[22px] border border-slate-200/80 bg-white/96 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.34)] backdrop-blur-xl";
    const childPreviewLimit = isCompact ? 3 : 6;
    const childPreviewNodes =
      selectedMindMapNode.children?.slice(0, childPreviewLimit) || [];
    const childStudyNotes = childPreviewNodes
      .map((childNode) => ({
        id: childNode.id,
        label: childNode.label || "",
        summary:
          childNode.summary && childNode.summary !== childNode.label
            ? childNode.summary
            : "",
      }))
      .filter((childNode) => childNode.label || childNode.summary);
    const detailedNodeNote = selectedMindMapNode.studyNote || null;
    const isLoadingDetailedNodeNote = false;
    const detailedNodeNoteKeyPoints = Array.isArray(detailedNodeNote?.keyPoints)
      ? detailedNodeNote.keyPoints.filter(Boolean)
      : [];
    const cleanedSummaryText =
      stripMindMapSummaryLeadIn(
        detailedNodeNote?.overview || summaryText,
        selectedMindMapNode.label,
      ) ||
      detailedNodeNote?.overview ||
      summaryText;
    const meaningSourceText = cleanedSummaryText || summaryText;
    const meaningStartsWithLabel =
      selectedMindMapNode.label &&
      new RegExp(`^${escapeRegExp(selectedMindMapNode.label)}\\b`, "i").test(
        meaningSourceText,
      );
    const meaningDetailText = meaningSourceText
      ? meaningStartsWithLabel
        ? ensureSentence(meaningSourceText)
        : isVietnamese
        ? ensureSentence(
            `${selectedMindMapNode.label} là ${lowercaseFirstLetter(
              meaningSourceText.replace(/[.!?。]\s*$/, ""),
            )}`,
          )
        : ensureSentence(
            `${selectedMindMapNode.label} means ${lowercaseFirstLetter(
              meaningSourceText.replace(/[.!?。]\s*$/, ""),
            )}`,
          )
      : isVietnamese
        ? `Mục này chưa có đủ dữ liệu giải thích riêng cho "${selectedMindMapNode.label}".`
        : `This item does not yet have enough source detail for "${selectedMindMapNode.label}".`;
    const pathLabels = selectedMindMapNodePath
      .map((node) => node?.label)
      .filter(Boolean);
    const contextText =
      selectedMindMapParentNode?.label && selectedMindMapParentNode.id !== selectedMindMapNode.id
        ? isVietnamese
          ? `Trong sơ đồ, ý này thuộc nhánh "${selectedMindMapParentNode.label}", nên nó đang làm rõ một phần của chủ đề đó.`
          : `In this map, it sits under "${selectedMindMapParentNode.label}", so it explains one part of that parent idea.`
        : pathLabels.length > 1
          ? isVietnamese
            ? `Mạch liên kết: ${pathLabels.join(" → ")}.`
            : `Map path: ${pathLabels.join(" → ")}.`
          : "";
    const detailedExplanation = detailedNodeNote?.explanation
      ? stripMindMapSummaryLeadIn(
          detailedNodeNote.explanation,
          selectedMindMapNode.label,
        ) || detailedNodeNote.explanation
      : "";
    const siblingStudyNotes =
      selectedMindMapSiblingNodes
        .slice(0, 3)
        .map((node) => ({
          id: node.id,
          label: node.label || "",
          summary:
            node.summary && node.summary !== node.label
              ? stripMindMapSummaryLeadIn(node.summary, node.label)
              : "",
        }))
        .filter((node) => node.label || node.summary);
    const relatedStudyNotes =
      detailedNodeNoteKeyPoints.length > 0
        ? []
        : childStudyNotes.length > 0
          ? childStudyNotes
          : siblingStudyNotes;
    const relatedStudyTitle =
      childStudyNotes.length > 0
        ? isVietnamese
          ? "Ý nhỏ bên trong"
          : "Inside This Idea"
        : isVietnamese
          ? "Ý liên quan cùng nhánh"
          : "Related Ideas";
    const studyDetailParagraphs = [
      detailedExplanation || meaningDetailText,
      detailedNodeNote?.studyFocus || contextText,
    ].filter(Boolean);
    const displaySummaryText =
      isCompact && meaningSourceText.length > 220
        ? `${meaningSourceText.slice(0, 220).trimEnd()}...`
        : meaningSourceText;
    const hiddenBranchCount = Math.max(
      childCount - childPreviewNodes.length,
      0,
    );
    const branchCountLabel =
      childCount > 0
        ? isVietnamese
          ? `${childCount} nhánh`
          : `${childCount} ${childCount === 1 ? "branch" : "branches"}`
        : null;
    const branchHint =
      childCount > 0
        ? isVietnamese
          ? "Chọn một nhánh bên dưới để xem tiếp."
          : "Choose a branch below to continue."
        : null;

    return (
      <div className={containerClass}>
        <div
          className={`flex items-start justify-between border-b border-slate-100 ${isCompact ? "gap-3 px-4 py-3" : "gap-4 px-6 py-5 bg-white/40"}`}
        >
          <div className="min-w-0">
            <p
              className={`font-black uppercase text-slate-400 ${isCompact ? "text-[8px] tracking-[0.2em]" : "text-[9px] tracking-[0.24em]"}`}
            >
              Study Note
            </p>
            <h4
              className={`font-black leading-snug tracking-tight text-slate-950 ${isCompact ? "mt-1.5 text-[15px]" : "mt-2 text-[18px]"}`}
            >
              {selectedMindMapNode.label}
            </h4>
          </div>
          <button
            type="button"
            onClick={handleMindMapNoteClose}
            className={`flex shrink-0 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-900 ${isCompact ? "h-8 w-8" : "h-9 w-9"}`}
            title="Close note"
          >
            <CloseIcon />
          </button>
        </div>

        <div
          className={`flex-1 overflow-y-auto scrollbar-none ${isCompact ? "space-y-4 px-4 py-3" : "space-y-5 px-5 py-4"}`}
        >
          {displaySummaryText ? (
            <section className={isCompact ? "space-y-1.5" : "space-y-2"}>
              <p
                className={`font-black uppercase tracking-[0.2em] text-slate-400 ${isCompact ? "text-[8px]" : "text-[9px]"}`}
              >
                Overview
              </p>
              <div
                className={`border border-slate-200/80 bg-slate-50/85 ${isCompact ? "rounded-[16px] p-3" : "rounded-[20px] p-4"}`}
              >
                <p
                  className={`text-slate-600 ${isCompact ? "text-[12px] leading-6" : "text-[13px] leading-7"}`}
                >
                  {displaySummaryText}
                </p>
              </div>
            </section>
          ) : null}

          <section className={isCompact ? "space-y-1.5" : "space-y-2"}>
            <p
              className={`font-black uppercase tracking-[0.2em] text-slate-400 ${isCompact ? "text-[8px]" : "text-[9px]"}`}
            >
              Study Detail
            </p>
            <div
              className={`border border-cyan-100/80 bg-cyan-50/65 ${isCompact ? "rounded-[16px] p-3" : "rounded-[20px] p-4"}`}
            >
              {isLoadingDetailedNodeNote ? (
                <div className="space-y-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-500">
                    {isVietnamese
                      ? "Đang đọc lại tài liệu cho node này..."
                      : "Reading the source for this node..."}
                  </p>
                  <div className="space-y-3 animate-pulse">
                    <div className="h-4 w-11/12 rounded-full bg-cyan-100" />
                    <div className="h-4 w-10/12 rounded-full bg-cyan-100" />
                    <div className="h-4 w-8/12 rounded-full bg-cyan-100" />
                  </div>
                </div>
              ) : (
                <>
              <p
                className={`text-slate-700 ${isCompact ? "text-[12px] leading-6" : "text-[13px] leading-7"}`}
              >
                {studyDetailParagraphs[0]}
              </p>
              {studyDetailParagraphs.slice(1).map((paragraph, index) => (
                <p
                  key={index}
                  className={`mt-3 text-slate-600 ${isCompact ? "text-[12px] leading-6" : "text-[13px] leading-7"}`}
                >
                  {paragraph}
                </p>
              ))}
              {detailedNodeNoteKeyPoints.length > 0 && !isCompact ? (
                <div className="mt-4 space-y-2.5">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-500">
                    {isVietnamese ? "Điểm cần hiểu" : "Key Points"}
                  </p>
                  <div className="space-y-2">
                    {detailedNodeNoteKeyPoints.slice(0, 6).map((point, index) => (
                      <div
                        key={`${point}-${index}`}
                        className="flex gap-3 rounded-2xl border border-white/80 bg-white/80 px-3.5 py-3"
                      >
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-[10px] font-black text-cyan-700">
                          {index + 1}
                        </span>
                        <p className="text-[12px] font-medium leading-6 text-slate-600">
                          {point}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {relatedStudyNotes.length > 0 && !isCompact ? (
                <div className="mt-4 space-y-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-500">
                    {relatedStudyTitle}
                  </p>
                  {relatedStudyNotes.slice(0, 4).map((childNode) => (
                    <button
                      key={childNode.id}
                      type="button"
                      onClick={() => handleMindMapNodeSelect(childNode.id)}
                      className="block w-full rounded-2xl border border-white/80 bg-white/80 px-3.5 py-3 text-left transition-all hover:border-cyan-200 hover:bg-white"
                    >
                      <span className="block text-[12px] font-black text-slate-800">
                        {childNode.label}
                      </span>
                      {childNode.summary ? (
                        <span className="mt-1.5 block text-[12px] font-medium leading-6 text-slate-500">
                          {childNode.summary}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
                </>
              )}
            </div>
          </section>

          {childPreviewNodes.length > 0 && (
            <section className={isCompact ? "space-y-2.5" : "space-y-3"}>
              <div className="flex items-center justify-between gap-3">
                <p
                  className={`font-black uppercase tracking-[0.2em] text-slate-400 ${isCompact ? "text-[8px]" : "text-[9px]"}`}
                >
                  Next Branches
                </p>
                {branchCountLabel ? (
                  <span
                    className={`rounded-full bg-slate-100 font-black uppercase tracking-[0.16em] text-slate-500 ring-1 ring-slate-200/80 ${isCompact ? "px-2.5 py-1 text-[8px]" : "px-3 py-1 text-[9px]"}`}
                  >
                    {branchCountLabel}
                  </span>
                ) : null}
              </div>
              <div className={isCompact ? "space-y-1.5" : "space-y-2"}>
                {childPreviewNodes.map((childNode) => (
                  <button
                    key={childNode.id}
                    type="button"
                    onClick={() => handleMindMapNodeSelect(childNode.id)}
                    className={`block w-full border border-slate-200 bg-white text-left font-semibold text-slate-700 transition-all hover:border-cyan-200 hover:bg-cyan-50/70 hover:text-slate-950 ${isCompact ? "rounded-xl px-3 py-2.5 text-[12px]" : "rounded-2xl px-3.5 py-3 text-[13px]"}`}
                  >
                    {childNode.label}
                  </button>
                ))}
              </div>
              {isCompact && hiddenBranchCount > 0 ? (
                <p className="text-[10px] font-semibold text-slate-400">
                  {isVietnamese
                    ? `+${hiddenBranchCount} nhánh nữa`
                    : `+${hiddenBranchCount} more branches`}
                </p>
              ) : null}
              {!isCompact && branchHint ? (
                <p className="mt-3 text-[11px] font-semibold leading-relaxed text-slate-500">
                  {branchHint}
                </p>
              ) : null}
            </section>
          )}
        </div>
      </div>
    );
  };

  const renderMindMap = () => {
    const isShowingAllNodes = mindMapViewMode === "all";

    if (!mindMapState.loading && !mindMapState.data && !mindMapState.error) {
      return (
        <div className="flex flex-col items-center justify-center py-10 text-center animate-fade-in">
          <div className="relative mb-10">
            <div className="absolute -inset-8 rounded-full bg-cyan-100/40 animate-pulse" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-3xl shadow-2xl shadow-cyan-500/30">
              <MindMapIcon className="h-8 w-8" />
            </div>
          </div>

          <h3 className="text-[14px] font-[1000] text-slate-900 uppercase tracking-[0.2em] mb-3">
            Mind Map
          </h3>
          <p className="text-[12px] font-medium text-slate-400 max-w-[240px] leading-relaxed mb-10">
            Select a target language to generate a knowledge network from this
            asset.
          </p>

          <div className="mb-8 flex p-1.5 rounded-2xl bg-slate-100/80 ring-1 ring-inset ring-slate-200/40 w-full max-w-[240px]">
            <button
              onClick={() => setSelectedLanguage("vi")}
              className={`flex-1 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all ${selectedLanguage === "vi" ? "bg-white text-cyan-600 shadow-sm ring-1 ring-slate-200/50" : "text-slate-400 hover:text-slate-600"}`}
            >
              Vietnamese
            </button>
            <button
              onClick={() => setSelectedLanguage("en")}
              className={`flex-1 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all ${selectedLanguage === "en" ? "bg-white text-cyan-600 shadow-sm ring-1 ring-slate-200/50" : "text-slate-400 hover:text-slate-600"}`}
            >
              English
            </button>
          </div>

          <button
            onClick={() => void loadMindMap(selectedLanguage)}
            className="group relative flex h-14 w-full items-center justify-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 px-8 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-cyan-500/20 transition-all hover:scale-[1.02] active:scale-95"
          >
            <span>Generate Mind Map</span>
            <ArrowLeftIcon />
          </button>
        </div>
      );
    }

    if (mindMapState.loading) {
      return (
        <div className="flex flex-col items-center justify-center py-24 animate-in fade-in duration-700">
          <div className="relative mb-10 flex h-36 w-36 items-center justify-center">
            {/* Orbit paths */}
            <div className="absolute inset-0 rounded-full border border-slate-200/60" />
            <div className="absolute inset-6 rounded-full border border-slate-200/40" />
            
            {/* Orbiting nodes */}
            <div className="absolute inset-0 animate-[spin_4s_linear_infinite]">
              <div className="absolute -top-1.5 left-1/2 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]" />
            </div>
            <div className="absolute inset-6 animate-[spin_3s_linear_infinite_reverse]">
              <div className="absolute -bottom-1.5 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.8)]" />
            </div>
            <div className="absolute inset-0 animate-[spin_5s_linear_infinite]">
              <div className="absolute left-0 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.8)]" />
            </div>
            <div className="absolute inset-6 animate-[spin_6s_linear_infinite]">
              <div className="absolute right-0 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.8)]" />
            </div>

            {/* Core */}
            <div className="absolute h-24 w-24 animate-pulse rounded-full bg-cyan-400/10 blur-xl" style={{ animationDuration: '2s' }} />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-[1.8rem] bg-white text-cyan-600 shadow-2xl shadow-cyan-500/15 ring-1 ring-cyan-100">
              <MindMapIcon className="h-8 w-8" />
            </div>
          </div>
          
          <h3 className="text-[13px] font-[1000] text-slate-900 uppercase tracking-[0.3em] mb-3 animate-pulse">
            Charting Knowledge Network
          </h3>
          <p className="text-[12px] font-medium text-slate-400 max-w-[280px] text-center leading-relaxed mb-6">
            AI is mapping logical relationships and constructing the structural visualization matrix.
          </p>
          
          <div className="mt-6 flex gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="h-2.5 w-2.5 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      );
    }

    if (mindMapState.error)
      return <InlineAlert tone="error">{mindMapState.error}</InlineAlert>;
    if (!activeMindMapRoot) return null;

    const activeMindMapLanguage =
      activeMindMapVersion?.language || mindMapState.data?.language || selectedLanguage;

    return (
      <div className="flex flex-col h-full gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Compact Single-Row Control Bar */}
        <div className="flex items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-xs shadow-md shadow-cyan-500/20">
              <MindMapIcon className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">
              Mind Map
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex p-0.5 rounded-lg bg-slate-100 ring-1 ring-slate-200/40">
              <button
                type="button"
                onClick={() => handleMindMapLanguageChange("vi")}
                className={`rounded-md px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition-all ${
                  activeMindMapLanguage === "vi"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-400 hover:text-slate-700"
                }`}
              >
                VI
              </button>
              <button
                type="button"
                onClick={() => handleMindMapLanguageChange("en")}
                className={`rounded-md px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition-all ${
                  activeMindMapLanguage === "en"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-400 hover:text-slate-700"
                }`}
              >
                EN
              </button>
            </div>
            <div className="flex p-0.5 rounded-lg bg-slate-100 ring-1 ring-slate-200/40">
              <button
                type="button"
                onClick={() => handleMindMapViewModeChange("explore")}
                className={`rounded-md px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition-all ${
                  !isShowingAllNodes
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-400 hover:text-slate-700"
                }`}
              >
                Explore
              </button>
              <button
                type="button"
                onClick={() => handleMindMapViewModeChange("all")}
                className={`rounded-md px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition-all ${
                  isShowingAllNodes
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-400 hover:text-slate-700"
                }`}
              >
                All
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsMindMapHistoryOpen(true)}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 ring-1 ring-slate-200/40 transition-all hover:bg-white hover:text-cyan-600"
              title="Open mind map history"
            >
              <HistoryIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setMindMapInstructionError("");
                setIsMindMapRefreshConfirmOpen(true);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 ring-1 ring-slate-200/40 transition-all hover:bg-white hover:text-cyan-600"
              title="Create custom mind map"
            >
              <SparklesIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsMindMapModalOpen(true)}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-cyan-500 hover:text-white transition-all ring-1 ring-slate-200/40"
              title="Full Screen"
            >
              <ExpandIcon />
            </button>
          </div>
        </div>

        {/* Canvas takes the remaining available space */}
        <div className="relative flex-1 rounded-[1.5rem] bg-slate-50/60 border border-slate-200/60 overflow-hidden shadow-inner min-h-0">
          <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
            <MindMapCanvas
              mindMap={activeMindMapRoot}
              selectedNodeId={selectedMindMapNode?.id}
              expandedNodeIds={expandedMindMapNodeIdSet}
              showAllNodes={isShowingAllNodes}
              onNodeSelect={handleMindMapNodeSelect}
              onNodeToggle={handleMindMapNodeToggle}
              language={activeMindMapLanguage}
              height="100%"
              compact
            />
          </Suspense>

          {/* Node detail overlay inside the canvas */}
          {selectedMindMapNode && (
            <div className="pointer-events-none absolute bottom-3 right-3">
              {renderMindMapNodeDetail("compact")}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAsk = () => {
    const hasHistory = askHistoryState.items.length > 0;
    const askTitle = "Ask AI";
    const emptyHint = "Ask your questions below to get started.";
    const inputPlaceholder = "Ask anything...";

    return (
      <div className="flex flex-col h-full gap-0">
        <div className="shrink-0 flex items-center justify-between px-1 pb-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900">
            {askTitle}
          </p>
          {hasHistory ? (
            <button
              type="button"
              onClick={() => void handleClearAskHistory()}
              disabled={askHistoryState.clearing || askState.loading}
              title="Clear history"
              className="flex h-7 w-7 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {askHistoryState.clearing ? (
                <svg
                  className="h-3.5 w-3.5 animate-spin"
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
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.519.149.022a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          ) : null}
        </div>

        <div
          ref={askThreadRef}
          className="flex-1 min-h-0 overflow-y-auto scrollbar-none px-1 py-4 space-y-6"
        >
          {askHistoryState.error ? (
            <InlineAlert tone="error">{askHistoryState.error}</InlineAlert>
          ) : null}

          {askHistoryState.loading && !hasHistory ? (
            <div className="space-y-4 animate-pulse">
              <div className="flex justify-end">
                <div className="h-12 w-[72%] rounded-[1.25rem] rounded-tr-sm bg-slate-200" />
              </div>
              <div className="flex justify-start gap-3">
                <div className="h-7 w-7 rounded-xl bg-slate-200" />
                <div className="h-24 w-[78%] rounded-[1.25rem] rounded-tl-sm bg-slate-100" />
              </div>
            </div>
          ) : null}

          {!askHistoryState.loading &&
          !hasHistory &&
          !askState.loading &&
          !askHistoryState.error ? (
            <div className="flex flex-col items-center justify-center h-full text-center animate-in fade-in duration-500">
              <div className="relative mb-5">
                <div className="absolute -inset-4 rounded-full bg-cyan-100/50 animate-pulse" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-[20px] bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-2xl shadow-xl shadow-cyan-500/25">
                  AI
                </div>
              </div>
              <h3 className="text-[13px] font-black text-slate-900 uppercase tracking-[0.2em] mb-1.5">
                {askTitle}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                {emptyHint}
              </p>
            </div>
          ) : null}

          {askHistoryState.items.map((item) => (
            <div
              key={item.id}
              className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-400"
            >
              <div className="flex justify-end">
                <div className="max-w-[86%] rounded-[1.25rem] rounded-tr-sm bg-slate-900 px-4 py-3 text-[13px] font-medium leading-relaxed text-slate-100 shadow-lg">
                  {item.question}
                </div>
              </div>

              <div className="flex justify-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20">
                  <SparklesIcon />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-cyan-600">
                      SKS Intelligence
                    </span>
                  </div>
                  <div className="rounded-[1.25rem] rounded-tl-sm border border-slate-100 bg-white px-5 py-4 shadow-sm">
                    <div className="min-w-0">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={askMarkdownComponents}
                      >
                        {item.answer || ""}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {askState.loading && askState.pendingQuestion ? (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex justify-end">
                <div className="max-w-[86%] rounded-[1.25rem] rounded-tr-sm bg-slate-900 px-4 py-3 text-[13px] font-medium leading-relaxed text-slate-100 shadow-lg">
                  {askState.pendingQuestion}
                </div>
              </div>
              <div className="flex justify-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20">
                  <SparklesIcon />
                </div>
                <div className="rounded-[1.25rem] rounded-tl-sm border border-slate-100 bg-white px-5 py-4 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 rounded-full bg-slate-300 animate-bounce" />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {askState.error ? (
            <InlineAlert tone="error">{askState.error}</InlineAlert>
          ) : null}
        </div>

        <div className="shrink-0 pt-2 pb-3 px-1">
          <div className="relative group">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-cyan-500/30 to-blue-500/30 blur-sm opacity-0 transition-all duration-500 group-focus-within:opacity-100" />
            <div className="relative flex items-end gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 group-focus-within:border-cyan-400 group-focus-within:shadow-lg group-focus-within:shadow-cyan-500/10">
              <textarea
                ref={chatInputRef}
                value={askQuestion}
                onChange={(e) => {
                  setAskQuestion(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                }}
                onKeyDown={handleAskKeyDown}
                rows={1}
                placeholder={inputPlaceholder}
                className="flex-1 min-h-[48px] resize-none bg-transparent py-3.5 pl-4 pr-2 text-[13px] font-medium text-slate-900 outline-none placeholder:text-slate-400 scrollbar-none"
                style={{ maxHeight: "120px" }}
              />
              <div className="flex items-end p-2">
                <button
                  type="button"
                  onClick={() => void handleAsk()}
                  disabled={
                    askState.loading ||
                    askHistoryState.clearing ||
                    !askQuestion.trim()
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20 transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:scale-100"
                >
                  {askState.loading ? (
                    <svg
                      className="h-4 w-4 animate-spin"
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
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  ) : (
                    <SendIcon />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSksNote = () => {
    const hasUnsavedChanges =
      noteState.content !== noteState.savedContent ||
      noteState.title !== noteState.savedTitle;
    const updatedLabel = formatSummaryHistoryTimestamp(noteState.updatedAt);

    return (
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="flex shrink-0 items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20">
              <NoteIcon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 truncate max-w-[150px]">
                {noteState.title || "SKS Note"}
              </p>
              <button
                type="button"
                onClick={() => setIsNoteHistoryOpen(true)}
                className="text-left text-[9px] font-bold uppercase tracking-widest text-slate-400 transition-all hover:text-cyan-600 truncate max-w-[150px]"
                title="Open note manager"
              >
                {updatedLabel ? `Saved ${updatedLabel}` : "Personal study note"}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsNoteHistoryOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 ring-1 ring-slate-200/60 transition-all hover:bg-white hover:text-cyan-600 shadow-sm"
              title="Note Manager"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => void handleSaveNote()}
              disabled={noteState.loading || noteState.saving || !hasUnsavedChanges}
              className="rounded-xl bg-slate-900 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-white transition-all hover:bg-cyan-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300 shadow-sm"
            >
              {noteState.saving ? "Saving" : hasUnsavedChanges ? "Save" : "Saved"}
            </button>
          </div>
        </div>

        {noteState.error ? (
          <InlineAlert tone="error">{noteState.error}</InlineAlert>
        ) : null}

        {noteState.loading ? (
          <div className="flex flex-1 flex-col gap-4 animate-pulse">
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="min-h-0 flex-1 rounded-[1.75rem]" />
          </div>
        ) : (
          <textarea
            value={noteState.content}
            onChange={(event) =>
              setNoteState((current) => ({
                ...current,
                content: event.target.value,
              }))
            }
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === "s") {
                event.preventDefault();
                void handleSaveNote();
              }
            }}
            placeholder="Write your study notes here..."
            className="min-h-0 flex-1 resize-none rounded-[1.75rem] border border-slate-200 bg-white px-5 py-4 text-[14px] font-medium leading-7 text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:border-cyan-400 focus:shadow-lg focus:shadow-cyan-500/10"
          />
        )}
      </div>
    );
  };

  const renderNoteHistoryModal = () => {
    if (!isNoteHistoryOpen) return null;

    return (
      <div className="fixed inset-0 z-[170] flex items-center justify-center bg-slate-900/40 p-5 backdrop-blur-md animate-in fade-in duration-300">
        <div className="w-full max-w-2xl overflow-hidden rounded-[2.5rem] border border-white/60 bg-white/90 shadow-[0_8px_40px_rgb(0,0,0,0.08)] backdrop-blur-xl animate-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between gap-5 border-b border-slate-200/50 px-8 py-6 bg-white/50">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 ring-1 ring-cyan-100 shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-[1000] tracking-tight text-slate-900">
                  Note Manager
                </h3>
                <p className="mt-0.5 text-[13px] font-medium text-slate-500">
                  Organize your study notes for this document
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsNoteHistoryOpen(false)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-400 ring-1 ring-slate-200 shadow-sm transition-all hover:bg-rose-50 hover:text-rose-500 hover:ring-rose-200"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="max-h-[65vh] space-y-4 overflow-y-auto p-8 scrollbar-none bg-slate-50/50">
            <button
              type="button"
              onClick={() => {
                handleCreateNote();
                setIsNoteHistoryOpen(false);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-cyan-300 bg-cyan-50/50 px-4 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-700 transition-all hover:bg-cyan-100/50 hover:border-cyan-400"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Create New Note
            </button>

            {noteState.notes.map((note) => {
              const isActive = note.id === noteState.activeNoteId;
              const noteUpdatedLabel = formatSummaryHistoryTimestamp(
                note.updatedAt,
              );

              return (
                <div
                  key={note.id}
                  className={`rounded-[1.5rem] border p-5 shadow-sm transition-all ${
                    isActive
                      ? "border-cyan-200 bg-white ring-4 ring-cyan-50/50"
                      : "border-slate-200 bg-white hover:border-cyan-300 hover:shadow-md"
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex-1 min-w-0">
                      <input
                        value={note.title}
                        onChange={(event) => {
                          const nextTitle = event.target.value;
                          setNoteState((current) => ({
                            ...current,
                            title:
                              current.activeNoteId === note.id
                                ? nextTitle
                                : current.title,
                            notes: current.notes.map((item) =>
                              item.id === note.id
                                ? { ...item, title: nextTitle }
                                : item,
                            ),
                          }));
                        }}
                        className="w-full bg-transparent text-[15px] font-black text-slate-800 outline-none transition-all placeholder:text-slate-300 focus:text-cyan-700 truncate"
                        placeholder="Untitled note"
                      />
                      <p className="mt-1 text-[11px] font-semibold text-slate-400">
                        {noteUpdatedLabel ? `Last modified ${noteUpdatedLabel}` : "Not saved yet"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectNote(note.id);
                          setIsNoteHistoryOpen(false);
                        }}
                        className={`rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${
                          isActive
                            ? "bg-cyan-500 text-white shadow-cyan-500/20"
                            : "bg-slate-100 text-slate-600 hover:bg-cyan-50 hover:text-cyan-700"
                        }`}
                      >
                        {isActive ? "Active" : "Open"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRenameNote(note.id, note.title)}
                        disabled={noteState.saving || !note.title.trim()}
                        className="rounded-xl bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-600 ring-1 ring-slate-200 transition-all hover:text-cyan-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 shadow-sm"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteNote(note.id)}
                        disabled={noteState.saving}
                        className="rounded-xl bg-white px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-rose-500 ring-1 ring-rose-200 transition-all hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 shadow-sm"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderNoteTitleModal = () => {
    if (!isNoteTitleModalOpen) return null;

    return (
      <div className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-900/40 p-5 backdrop-blur-md animate-in fade-in duration-300">
        <div className="w-full max-w-md overflow-hidden rounded-[2.5rem] border border-white/60 bg-white shadow-[0_8px_40px_rgb(0,0,0,0.08)] animate-in zoom-in-95 duration-300">
          <div className="px-8 pt-8 pb-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 ring-1 ring-cyan-100 shadow-sm">
              <NoteIcon className="h-6 w-6" />
            </div>
            <h3 className="text-2xl font-[1000] tracking-tight text-slate-900">
              Name your note
            </h3>
            
            <input
              value={noteTitleDraft}
              onChange={(event) => setNoteTitleDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void commitSaveNoteWithTitle(noteTitleDraft);
                }
              }}
              autoFocus
              placeholder="e.g. Chapter 1 Summary"
              className="mt-6 h-14 w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 text-[15px] font-bold text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:shadow-md focus:shadow-cyan-500/10"
            />
          </div>
          
          <div className="flex gap-3 bg-slate-50 px-8 py-5 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsNoteTitleModalOpen(false)}
              className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-[11px] font-black uppercase tracking-widest text-slate-500 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void commitSaveNoteWithTitle(noteTitleDraft)}
              disabled={noteState.saving || !noteTitleDraft.trim()}
              className="flex-1 rounded-2xl bg-slate-900 px-5 py-3.5 text-[11px] font-black uppercase tracking-widest text-white shadow-md shadow-slate-900/20 transition-all hover:bg-cyan-600 hover:shadow-cyan-600/30 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
            >
              {noteState.saving ? "Saving..." : "Save Note"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderRelated = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col">
        <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">
          Related Documents
        </h3>
      </div>
      <div className="space-y-3">
        {relatedDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-10 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
            <div className="h-10 w-10 text-slate-200 mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-full h-full"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                />
              </svg>
            </div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">
              No structural associations
            </p>
          </div>
        ) : (
          relatedDocuments.map((d) => (
            <RelatedCard
              key={d.id}
              document={d}
              onOpen={(id) => navigate(`/app/documents/${id}`)}
            />
          ))
        )}
      </div>
    </div>
  );

  const renderMindMapModal = () => {
    if (!activeMindMapRoot) {
      return null;
    }

    const mindMapLanguage =
      activeMindMapVersion?.language || mindMapState.data?.language || selectedLanguage;
    const isShowingAllNodes = mindMapViewMode === "all";

    return (
      <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/40 p-6 backdrop-blur-md animate-in fade-in duration-500">
        <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[32px] border border-white/20 bg-white shadow-2xl animate-in zoom-in-95 duration-500">
          {/* Header */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-100 px-8 bg-white/80 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/10">
                <MindMapIcon className="h-4 w-4" />
              </div>
              <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900">
                Mind Map
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex p-1 rounded-xl bg-slate-100 ring-1 ring-slate-200/40">
                <button
                  type="button"
                  onClick={() => handleMindMapLanguageChange("vi")}
                  className={`rounded-lg px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${
                    mindMapLanguage === "vi"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-400 hover:text-slate-700"
                  }`}
                >
                  VI
                </button>
                <button
                  type="button"
                  onClick={() => handleMindMapLanguageChange("en")}
                  className={`rounded-lg px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${
                    mindMapLanguage === "en"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-400 hover:text-slate-700"
                  }`}
                >
                  EN
                </button>
              </div>

              <div className="flex p-1 rounded-xl bg-slate-100 ring-1 ring-slate-200/40">
                <button
                  type="button"
                  onClick={() => handleMindMapViewModeChange("explore")}
                  className={`rounded-lg px-4 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${
                    !isShowingAllNodes
                      ? "bg-cyan-500 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-700"
                  }`}
                >
                  Explore
                </button>
                <button
                  type="button"
                  onClick={() => handleMindMapViewModeChange("all")}
                  className={`rounded-lg px-4 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${
                    isShowingAllNodes
                      ? "bg-cyan-500 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-700"
                  }`}
                >
                  Full View
                </button>
              </div>

              <button
    type="button"
    disabled={mindMapState.loading}
    onClick={() => {
      setMindMapInstructionError("");
      setIsMindMapRefreshConfirmOpen(true);
    }}
    className={`flex h-8 items-center gap-2 rounded-xl px-4 text-[9px] font-black uppercase tracking-widest transition-all ${mindMapState.loading ? "bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100 ring-0" : "bg-slate-100 text-slate-600 ring-1 ring-slate-200/40 hover:bg-white hover:text-cyan-600 hover:shadow-sm"}`}
  >
    {mindMapState.loading ? (
      <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    ) : (
      <SparklesIcon className="h-3.5 w-3.5" />
    )}
    <span className="hidden sm:inline">
      {mindMapState.loading ? "Generating..." : "New Map"}
    </span>
  </button>

              <button
                type="button"
                onClick={() => setIsMindMapModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* Visualization Canvas */}
          <div className="relative min-h-0 flex-1 flex overflow-hidden bg-slate-50/40">
            {mindMapState.loading && (
              <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm transition-all duration-500 animate-in fade-in zoom-in-95">
                <div className="relative flex h-24 w-24 items-center justify-center mb-6">
                  <div className="absolute inset-0 animate-[spin_4s_linear_infinite] rounded-full border-2 border-transparent border-t-cyan-500 border-l-cyan-300" />
                  <div className="absolute inset-2 animate-[spin_3s_linear_infinite_reverse] rounded-full border-2 border-transparent border-b-blue-500 border-r-blue-300" />
                  <div className="absolute inset-4 animate-[spin_5s_linear_infinite] rounded-full border border-slate-200/50" />
                  <div className="absolute h-16 w-16 animate-pulse rounded-full bg-cyan-400/20 blur-xl" style={{ animationDuration: '2s' }} />
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-cyan-500 shadow-xl shadow-cyan-500/20 ring-1 ring-cyan-100">
                    <MindMapIcon className="h-6 w-6" />
                  </div>
                </div>
                <h3 className="text-[12px] font-[1000] uppercase tracking-[0.3em] text-slate-900 animate-pulse mb-2">
                  Re-charting Network
                </h3>
                <p className="text-[11px] font-medium text-slate-500 max-w-[200px] text-center">
                  AI is restructuring and translating the knowledge nodes...
                </p>
              </div>
            )}
            <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
              <MindMapCanvas
                mindMap={activeMindMapRoot}
                selectedNodeId={selectedMindMapNode?.id}
                expandedNodeIds={expandedMindMapNodeIdSet}
                showAllNodes={isShowingAllNodes}
                onNodeSelect={handleMindMapNodeSelect}
                onNodeToggle={handleMindMapNodeToggle}
                language={mindMapLanguage}
                height="100%"
                compact={false}
              />
            </Suspense>

            {selectedMindMapNode && (
              <>
                <div className="pointer-events-none absolute inset-x-4 bottom-4 xl:hidden">
                  {renderMindMapNodeDetail("canvas")}
                </div>
                <div className="pointer-events-none absolute bottom-6 right-6 top-6 hidden xl:flex">
                  {renderMindMapNodeDetail("floating")}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderToolbar = () => {
    return (
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200/60 bg-white/80 px-6 backdrop-blur-xl transition-all">
        <div className="flex items-center gap-6 min-w-0">
          <button
            type="button"
            onClick={() => navigate("/app")}
            className="flex items-center gap-2 group whitespace-nowrap"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-900 transition-all">
              <ArrowLeftIcon />
            </div>
            <span className="text-[12px] font-black tracking-wide text-slate-500 group-hover:text-slate-900 transition-colors hidden sm:inline">
              Workspace
            </span>
          </button>

          <div className="w-px h-6 bg-slate-200/80" />

          {documentData && (
            <div className="min-w-0 flex flex-col">
              <h1 className="truncate text-[15px] font-[1000] tracking-tight text-slate-910 max-w-[200px] md:max-w-md lg:max-w-lg">
                {documentData.title}
              </h1>
              {documentData.folderName && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="h-1 w-1 rounded-full bg-cyan-500" />
                  <p className="text-[9px] font-black uppercase tracking-[0.25em] text-cyan-600 leading-none">
                    {documentData.folderName}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100/50 border border-slate-200/40">
            <button
              onClick={handleOpenRawFile}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-white hover:text-slate-900 hover:shadow-sm transition-all"
              title="Open External"
            >
              <ExternalLinkIcon />
            </button>
            <button
              onClick={() => handleDownload(documentId, documentData?.title)}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-white hover:text-slate-900 hover:shadow-sm transition-all"
              title="Download"
            >
              <DownloadIcon />
            </button>
            <button
              onClick={() => handleToggleFavorite(documentData?.id)}
              className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                documentData?.isFavorite
                  ? "bg-white text-amber-500 shadow-sm ring-1 ring-amber-100"
                  : "text-slate-400 hover:bg-white hover:text-amber-500 hover:shadow-sm"
              }`}
              title="Favorite"
            >
              <StarIcon filled={documentData?.isFavorite} />
            </button>

            <div className="w-px h-5 bg-slate-200/80 mx-1" />

            <button
              onClick={() => setSidebarOpen((v) => !v)}
              title={sidebarOpen ? "Close AI Assistant" : "Open AI Assistant"}
              className={`group relative flex h-8 items-center gap-2 rounded-xl px-3.5 text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                sidebarOpen
                  ? "bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-500 ring-1 ring-slate-200/60"
                  : "bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
              }`}
            >
              {sidebarOpen ? (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-3.5 w-3.5 shrink-0"
                  >
                    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                  </svg>
                  <span className="hidden lg:inline">Close AI</span>
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-3.5 w-3.5 shrink-0"
                  >
                    <path d="M15.98 1.804a1 1 0 0 0-1.96 0l-.24 1.192a1 1 0 0 1-.784.785l-1.192.238a1 1 0 0 0 0 1.962l1.192.238a1 1 0 0 1 .785.785l.238 1.192a1 1 0 0 0 1.962 0l.238-1.192a1 1 0 0 1 .785-.785l1.192-.238a1 1 0 0 0 0-1.962l-1.192-.238a1 1 0 0 1-.785-.785l-.238-1.192ZM6.949 5.684a1 1 0 0 0-1.898 0l-.683 2.051a1 1 0 0 1-.633.633l-2.051.683a1 1 0 0 0 0 1.898l2.051.684a1 1 0 0 1 .633.632l.683 2.051a1 1 0 0 0 1.898 0l.683-2.051a1 1 0 0 1 .633-.633l2.051-.683a1 1 0 0 0 0-1.898l-2.051-.683a1 1 0 0 1-.633-.633L6.95 5.684ZM13.949 13.684a1 1 0 0 0-1.898 0l-.184.551a1 1 0 0 1-.632.633l-.551.183a1 1 0 0 0 0 1.898l.551.183a1 1 0 0 1 .633.633l.183.551a1 1 0 0 0 1.898 0l.184-.551a1 1 0 0 1 .632-.633l.551-.183a1 1 0 0 0 0-1.898l-.551-.184a1 1 0 0 1-.633-.632l-.183-.551Z" />
                  </svg>
                  <span className="hidden lg:inline">Intelligence</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderSummaryModal = () => {
    if (!summaryState.data || !activeSummaryVersion) return null;
    const { title, overview, key_points, conclusion } = activeSummaryVersion;
    const narrativeBody = getNarrativeSummaryBody(activeSummaryVersion);

    return (
      <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/40 p-6 backdrop-blur-md animate-in fade-in duration-500">
        <div className="relative flex flex-col w-full max-w-3xl max-h-[85vh] rounded-[32px] border border-white/20 bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
          {/* Header */}
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 px-8 bg-white/80 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/10">
                <SparklesIcon className="h-4 w-4" />
              </div>
              <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900">
                Summary
              </h2>
            </div>
            <button
              onClick={() => setIsSummaryModalOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all"
            >
              <CloseIcon />
            </button>
          </div>

           <div className="flex-1 overflow-y-auto px-8 md:px-12 py-10 scrollbar-none">
           <div className="space-y-12 mb-6">
              <div className="space-y-4">
                <h1 className="text-3xl md:text-5xl font-[1000] text-slate-900 leading-[1.1] tracking-tight">
                  {title}
                </h1>
                <div className="h-1.5 w-20 bg-cyan-500 rounded-full" />
              </div>

              {narrativeBody ? (
                <div className="rounded-[2rem] border border-slate-200/80 bg-white/95 p-7 shadow-sm">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={summaryModalNarrativeMarkdownComponents}
                  >
                    {narrativeBody || ""}
                  </ReactMarkdown>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">
                      Overview
                    </p>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={summaryModalOverviewMarkdownComponents}
                    >
                      {overview || ""}
                    </ReactMarkdown>
                  </div>

                  <div className="space-y-8">
                    <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">
                      Key Points
                    </p>
                    <div className="grid gap-6">
                      {key_points?.map((point, i) => (
                        <div key={i} className="flex gap-6 group">
                          <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-[11px] font-black text-slate-400 ring-1 ring-slate-200 transition-all group-hover:bg-cyan-500 group-hover:text-white group-hover:ring-0">
                            {i + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={summaryModalKeyPointMarkdownComponents}
                            >
                              {point || ""}
                            </ReactMarkdown>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-xl border border-white/5">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                      <SparklesIcon className="text-cyan-400 h-16 w-16" />
                    </div>
                    <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-cyan-500/20 blur-3xl opacity-30" />
                    <p className="relative z-10 text-[9px] font-black uppercase tracking-[0.4em] text-cyan-500 mb-6">
                      Conclusion
                    </p>
                    <div className="relative z-10">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={summaryConclusionMarkdownComponents}
                      >
                        {conclusion || ""}
                      </ReactMarkdown>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSummaryHistoryModal = () => {
    if (!summaryState.data || !activeSummaryVersion) return null;

    const activeSlot =
      activeSummaryVersion.slot || selectedSummarySlot || "default";
    const hasSummaryHistory = summaryHistoryVersions.length > 0;

    const handleSelectSummaryVersion = (slot) => {
      handleSummarySlotChange(slot);
      setIsSummaryHistoryOpen(false);
    };

    return (
      <div className="fixed inset-0 z-[170] flex items-center justify-center p-5 overflow-hidden">
        {/* Animated Background Auras */}
        <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-md transition-all duration-500" />
        <div className="absolute top-1/4 -left-20 w-[500px] h-[500px] bg-sks-primary/20 rounded-full blur-[120px] animate-pulse pointer-events-none" />
        <div className="absolute bottom-1/4 -right-20 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] animate-pulse pointer-events-none" style={{ animationDelay: '2s' }} />

        <div className="relative w-full max-w-lg rounded-[2.5rem] border border-white/40 bg-white/70 backdrop-blur-3xl shadow-sks-heavy overflow-hidden animate-in zoom-in-95 fade-in duration-500">
          {/* Header Section */}
          <div className="relative border-b border-white/20 bg-white/20 px-8 py-7">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sks-primary to-blue-600 text-white shadow-lg shadow-sks-primary/20 group overflow-hidden">
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                  <HistoryIcon className="relative h-6 w-6 z-10" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-2xl font-[1000] tracking-tight text-sks-slate-900 leading-none">
                    Summary History
                  </h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-sks-slate-400">
                    Vault of intelligence
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSummaryHistoryOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sks-slate-400 transition-all hover:bg-white hover:text-rose-500 hover:shadow-sm"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-8 scrollbar-none space-y-10 relative">
            {/* System Standard Section */}
            <div className="space-y-5">
              <div className="flex items-center gap-3 pl-1">
                <div className="h-1 w-1 rounded-full bg-sks-primary" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-sks-slate-400">
                  AI Baseline
                </h4>
              </div>
              
              <button
                type="button"
                onClick={() => handleSelectSummaryVersion("default")}
                className={`group relative flex w-full items-center gap-5 rounded-[2rem] border p-5 text-left transition-all duration-500 overflow-hidden ${
                  activeSlot === "default"
                    ? "border-sks-primary/30 bg-white/60 shadow-sks-medium"
                    : "border-white/40 bg-white/30 hover:border-sks-primary/20 hover:bg-white/50 hover:-translate-y-0.5"
                }`}
              >
                {/* Active Glow Effect */}
                {activeSlot === "default" && (
                  <div className="absolute inset-0 bg-gradient-to-r from-sks-primary/5 to-transparent pointer-events-none" />
                )}

                <div className="flex min-w-0 flex-1 items-center gap-5">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all duration-500 ${
                      activeSlot === "default"
                        ? "bg-sks-primary text-white shadow-[0_8px_20px_-4px_rgba(14,165,233,0.4)]"
                        : "bg-white/50 text-sks-slate-400 group-hover:bg-white group-hover:text-sks-primary"
                    }`}
                  >
                    <RestoreIcon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="truncate text-base font-[1000] text-sks-slate-900 group-hover:text-sks-primary transition-colors">
                        {defaultSummaryVersion?.title || "System Default Summary"}
                      </span>
                      {activeSlot === "default" && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-sks-primary text-[8px] font-black uppercase tracking-widest text-white shadow-[0_0_12px_rgba(14,165,233,0.3)]">
                          <span className="h-1 w-1 rounded-full bg-white animate-pulse" />
                          Active
                        </div>
                      )}
                    </div>
                    <p className="text-[12px] font-medium text-sks-slate-500">
                      Standard knowledge extraction by SKS AI
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {/* Custom History Section */}
            <div className="space-y-5 pb-2">
              <div className="flex items-center gap-3 pl-1">
                <div className="h-1 w-1 rounded-full bg-blue-500" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-sks-slate-400">
                  Custom Personalizations
                </h4>
              </div>
              
              {hasSummaryHistory ? (
                <div className="space-y-4">
                  {summaryHistoryVersions.map((version, index) => {
                    const isSelected = version.slot === activeSlot;
                    const generatedLabel = formatSummaryHistoryTimestamp(
                      version.generatedAt,
                    );
                    const promptText =
                      typeof version.instruction === "string" &&
                      version.instruction.trim()
                        ? version.instruction.trim()
                        : null;

                    return (
                      <button
                        key={`${version.slot}-${index}`}
                        type="button"
                        onClick={() => handleSelectSummaryVersion(version.slot)}
                        className={`group relative flex w-full flex-col gap-4 rounded-[2.25rem] border px-6 py-6 text-left transition-all duration-500 overflow-hidden ${
                          isSelected
                            ? "border-blue-200 bg-white/80 shadow-sks-medium ring-1 ring-blue-100/50"
                            : "border-white/40 bg-white/30 hover:border-blue-100 hover:bg-white/60 hover:shadow-sks-soft hover:-translate-y-1"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex min-w-0 flex-1 items-start gap-4">
                            <div
                              className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-500 ${
                                isSelected
                                  ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                                  : "bg-white/50 text-sks-slate-400 group-hover:bg-white group-hover:text-blue-500"
                              }`}
                            >
                              <SummaryCardIcon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-3 mb-1.5">
                                <h5 className="truncate text-base font-[1000] text-sks-slate-900 group-hover:text-blue-600 transition-colors">
                                  {version.title || `Custom Iteration ${index + 1}`}
                                </h5>
                                {isSelected && (
                                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500 text-[8px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/20">
                                    <span className="h-1 w-1 rounded-full bg-white animate-pulse" />
                                    Active
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] font-bold text-sks-slate-400">
                                <ClockIcon className="h-3.5 w-3.5 opacity-70" />
                                <span>{generatedLabel || "Recently generated"}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {promptText && (
                          <div className="relative rounded-2xl bg-slate-950/5 px-4 py-3.5 border border-black/[0.03]">
                            <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-sks-slate-200" />
                            <p className="line-clamp-2 text-[11px] font-semibold italic leading-relaxed text-sks-slate-600 pl-2">
                              "{promptText}"
                            </p>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-[2.5rem] border border-dashed border-white/60 bg-white/20 py-16 px-8 text-center backdrop-blur-sm group hover:bg-white/30 transition-all duration-500">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-sks-primary/20 blur-2xl rounded-full animate-pulse" />
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-3xl bg-white/80 text-sks-slate-300 shadow-sks-soft ring-1 ring-white/60 animate-float">
                      <HistoryIcon className="h-7 w-7 opacity-50" />
                    </div>
                    <div className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-100">
                      <SparklesIcon className="h-3 w-3 text-amber-400" />
                    </div>
                  </div>
                  <h5 className="text-[12px] font-[1000] uppercase tracking-[0.3em] text-sks-slate-900 mb-2">
                    History Empty
                  </h5>
                  <p className="text-[12px] font-medium text-sks-slate-500 max-w-[220px] leading-relaxed">
                    Start personalizing your knowledge vault to see different versions here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderMindMapHistoryModal = () => {
    if (!mindMapState.data || !activeMindMapVersion) return null;

    const activeSlot =
      activeMindMapVersion.slot || selectedMindMapSlot || "default";
    const hasMindMapHistory = mindMapHistoryVersions.length > 0;

    const handleSelectMindMapVersion = (slot) => {
      handleMindMapSlotChange(slot);
      setIsMindMapHistoryOpen(false);
    };

    return (
      <div className="fixed inset-0 z-[170] flex items-center justify-center bg-slate-950/50 p-5 backdrop-blur-md animate-in fade-in duration-300">
        <div className="w-full max-w-lg overflow-hidden rounded-[2.5rem] border border-white/40 bg-white/90 shadow-2xl backdrop-blur-2xl animate-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between border-b border-slate-100 px-8 py-7">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
                <MindMapIcon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-2xl font-[1000] tracking-tight text-slate-900">
                  Mind Map History
                </h3>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                  Default and custom maps
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsMindMapHistoryOpen(false)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-500"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="max-h-[60vh] space-y-8 overflow-y-auto p-8 scrollbar-none">
            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-400">
                AI Baseline
              </p>
              <button
                type="button"
                onClick={() => handleSelectMindMapVersion("default")}
                className={`flex w-full items-center gap-4 rounded-[2rem] border p-5 text-left transition-all ${
                  activeSlot === "default"
                    ? "border-cyan-200 bg-cyan-50/70 shadow-sks-soft"
                    : "border-slate-100 bg-white hover:border-cyan-100 hover:bg-cyan-50/40"
                }`}
              >
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                    activeSlot === "default"
                      ? "bg-cyan-500 text-white"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  <RestoreIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-[1000] text-slate-900">
                    {defaultMindMapVersion?.root?.label ||
                      defaultMindMapVersion?.mindMap?.label ||
                      "System Default Mind Map"}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">
                    Standard AI mind map generated from the document.
                  </p>
                </div>
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-400">
                Custom Personalizations
              </p>
              {hasMindMapHistory ? (
                <div className="space-y-3">
                  {mindMapHistoryVersions.map((version, index) => {
                    const isSelected = version.slot === activeSlot;
                    const generatedLabel = formatSummaryHistoryTimestamp(
                      version.generatedAt,
                    );
                    const promptText =
                      typeof version.instruction === "string" &&
                      version.instruction.trim()
                        ? version.instruction.trim()
                        : null;

                    return (
                      <button
                        key={`${version.slot}-${index}`}
                        type="button"
                        onClick={() => handleSelectMindMapVersion(version.slot)}
                        className={`flex w-full flex-col gap-3 rounded-[2rem] border p-5 text-left transition-all ${
                          isSelected
                            ? "border-blue-200 bg-blue-50/70 shadow-sks-soft"
                            : "border-slate-100 bg-white hover:border-blue-100 hover:bg-blue-50/30"
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                              isSelected
                                ? "bg-blue-500 text-white"
                                : "bg-slate-100 text-slate-400"
                            }`}
                          >
                            <MindMapIcon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-[1000] text-slate-900">
                              {version.root?.label ||
                                version.mindMap?.label ||
                                `Custom Mind Map ${index + 1}`}
                            </p>
                            <p className="mt-1 text-[10px] font-bold text-slate-400">
                              {generatedLabel || "Recently generated"}
                            </p>
                          </div>
                        </div>
                        {promptText ? (
                          <p className="line-clamp-2 rounded-2xl bg-slate-950/5 px-4 py-3 text-[11px] font-semibold italic leading-relaxed text-slate-600">
                            "{promptText}"
                          </p>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-[2rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
                  <HistoryIcon className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-4 text-[12px] font-[1000] uppercase tracking-[0.2em] text-slate-500">
                    History Empty
                  </p>
                  <p className="mt-2 text-[12px] font-medium text-slate-400">
                    Create a custom mind map to save it here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSummaryRefreshConfirmModal = () => {
    if (!summaryState.data) return null;

    const activeSummaryLanguage =
      activeSummaryVersion?.language || selectedLanguage;
    const customExists = summaryHistoryVersions.length > 0;

    return (
      <div className="fixed inset-0 z-[170] flex items-center justify-center bg-slate-950/50 p-5 backdrop-blur-md animate-in fade-in duration-300">
        <div className="w-full max-w-md rounded-[2rem] border border-white/15 bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-300">
          <div className="flex items-start justify-between gap-6">
            <div className="space-y-3">
              <p className="text-[9px] font-black uppercase tracking-[0.35em] text-slate-400">
                Custom Summary
              </p>
              <h3 className="text-2xl font-[1000] tracking-tight text-slate-900">
                {customExists
                  ? "Replace the current custom summary"
                  : "Create a new custom summary"}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsSummaryRefreshConfirmOpen(false);
                setSummaryInstructionError("");
              }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-500"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="mt-6 space-y-3">
            <label
              htmlFor="summary-instruction"
              className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500"
            >
              How should this summary be different?
            </label>
            <textarea
              id="summary-instruction"
              value={summaryInstructionDraft}
              onChange={(event) => {
                setSummaryInstructionDraft(event.target.value);
                if (summaryInstructionError) {
                  setSummaryInstructionError("");
                }
              }}
              rows={5}
              placeholder="Example: Focus on definitions and formulas only. Keep it concise and exam-oriented."
              className="w-full resize-none rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] font-medium leading-6 text-slate-900 outline-none transition-all focus:border-cyan-400 focus:bg-white focus:shadow-lg focus:shadow-cyan-500/10"
            />
            {summaryInstructionError ? (
              <InlineAlert tone="error">{summaryInstructionError}</InlineAlert>
            ) : null}
          </div>

          <div className="mt-8 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setIsSummaryRefreshConfirmOpen(false);
                setSummaryInstructionError("");
              }}
              className="rounded-2xl border border-slate-200 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const trimmedInstruction = summaryInstructionDraft.trim();

                if (!trimmedInstruction) {
                  setSummaryInstructionError(
                    "Please describe how the new summary should be generated.",
                  );
                  return;
                }

                setSummaryInstructionError("");
                setIsSummaryRefreshConfirmOpen(false);
                void (async () => {
                  const created = await loadSummary(activeSummaryLanguage, {
                    forceRefresh: true,
                    slot: "custom",
                    instruction: trimmedInstruction,
                  });

                  if (!created) {
                    setIsSummaryRefreshConfirmOpen(true);
                  }
                })();
              }}
              disabled={summaryState.loading}
              className="rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.02] active:scale-95"
            >
              {customExists ? "Replace Custom Summary" : "Create Custom Summary"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderMindMapRefreshConfirmModal = () => {
    if (!activeMindMapRoot) return null;

    const activeMindMapLanguage =
      activeMindMapVersion?.language || mindMapState.data?.language || selectedLanguage;
    const customExists = mindMapHistoryVersions.length > 0;

    return (
      <div className="fixed inset-0 z-[170] flex items-center justify-center bg-slate-950/50 p-5 backdrop-blur-md animate-in fade-in duration-300">
        <div className="w-full max-w-md rounded-[2rem] border border-white/15 bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-300">
          <div className="flex items-start justify-between gap-6">
            <div className="space-y-3">
              <p className="text-[9px] font-black uppercase tracking-[0.35em] text-slate-400">
                Custom Mind Map
              </p>
              <h3 className="text-2xl font-[1000] tracking-tight text-slate-900">
                {customExists
                  ? "Replace the current custom mind map"
                  : "Create a new custom mind map"}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsMindMapRefreshConfirmOpen(false);
                setMindMapInstructionError("");
              }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-500"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="mt-6 space-y-3">
            <label
              htmlFor="mindmap-instruction"
              className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500"
            >
              How should this mind map be generated?
            </label>
            <textarea
              id="mindmap-instruction"
              value={mindMapInstructionDraft}
              onChange={(event) => {
                setMindMapInstructionDraft(event.target.value);
                if (mindMapInstructionError) {
                  setMindMapInstructionError("");
                }
              }}
              rows={5}
              placeholder="Example: Make it exam-oriented, show causes and effects, and group definitions separately."
              className="w-full resize-none rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] font-medium leading-6 text-slate-900 outline-none transition-all focus:border-cyan-400 focus:bg-white focus:shadow-lg focus:shadow-cyan-500/10"
            />
            {mindMapInstructionError ? (
              <InlineAlert tone="error">{mindMapInstructionError}</InlineAlert>
            ) : null}
          </div>

          <div className="mt-8 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setIsMindMapRefreshConfirmOpen(false);
                setMindMapInstructionError("");
              }}
              className="rounded-2xl border border-slate-200 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const trimmedInstruction = mindMapInstructionDraft.trim();

                if (!trimmedInstruction) {
                  setMindMapInstructionError(
                    "Please describe how the new mind map should be generated.",
                  );
                  return;
                }

                setMindMapInstructionError("");
                setIsMindMapRefreshConfirmOpen(false);
                void (async () => {
                  const created = await loadMindMap(activeMindMapLanguage, {
                    forceRefresh: true,
                    slot: "custom",
                    instruction: trimmedInstruction,
                  });

                  if (!created) {
                    setIsMindMapRefreshConfirmOpen(true);
                  }
                })();
              }}
              disabled={mindMapState.loading}
              className="rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.02] active:scale-95"
            >
              {customExists ? "Replace Custom Map" : "Create Custom Map"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* Render */
  const filePresentation = useMemo(
    () => getFilePresentation(documentData || { title: "", fileRef: "" }),
    [documentData],
  );
  const canPreview = useMemo(() => {
    const t = contentType.toLowerCase();
    return (
      t.includes("pdf") ||
      t.startsWith("text/") ||
      filePresentation.extension === "pdf" ||
      filePresentation.extension === "txt"
    );
  }, [contentType, filePresentation.extension]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-white">
      <div ref={containerRef} className="flex-1 flex overflow-hidden min-h-0">
        {/* PREVIEW CANVAS */}
        <main className="relative flex-1 min-w-0 flex flex-col overflow-hidden bg-slate-50/30 border-r border-slate-200/60">
          {/* INTERNAL DOCUMENT TOOLBAR (Inside Document Area only) */}
          {renderToolbar()}

          <div className="flex-1 w-full overflow-hidden">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-100 border-t-cyan-600" />
              </div>
            ) : error ? (
              <div className="flex h-full flex-col items-center justify-center p-20 text-center animate-fade-in shadow-inner bg-slate-50/10">
                <div className="h-20 w-20 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mb-6">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-10 h-10"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-extrabold text-slate-900 uppercase tracking-tight mb-2">
                  Error Loading Resource
                </h2>
                <p className="text-slate-500 font-medium max-w-xs">{error}</p>
              </div>
            ) : canPreview && fileUrl ? (
              <iframe
                src={`${fileUrl}#toolbar=0`}
                className="h-full w-full border-0 scrollbar-none shadow-inner"
                title="Asset Preview"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center p-20 text-center animate-fade-in">
                <div
                  className={`flex h-20 w-20 items-center justify-center rounded-2xl text-[12px] font-black tracking-[0.2em] shadow-xl mb-10 ${filePresentation.accent.replace("bg-teal-50", "bg-slate-900").replace("text-teal-700", "text-white")}`}
                >
                  {filePresentation.label}
                </div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-4">
                  Preview Not Available
                </h2>
                <p className="text-slate-500 font-medium mb-12 max-w-sm mx-auto leading-relaxed">
                  Preview for this file type is not available here. Use the side
                  panel to read the summary or explore the mind map.
                </p>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => handleOpenRawFile()}
                    className="rounded-2xl bg-slate-100 py-3.5 px-8 text-[10px] font-black uppercase tracking-wider text-slate-900 hover:bg-slate-200"
                  >
                    Open External
                  </button>
                  <button
                    onClick={() =>
                      handleDownload(documentId, documentData?.title)
                    }
                    className="rounded-2xl bg-slate-900 py-3.5 px-8 text-[10px] font-black uppercase tracking-wider text-white hover:shadow-xl"
                  >
                    Download Asset
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* RESIZER */}
        {sidebarOpen && (
          <div
            onMouseDown={handleMouseDown}
            className="w-px shrink-0 cursor-col-resize bg-slate-200 hover:bg-cyan-500 transition-colors relative z-30"
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>
        )}

        {/* SIDEBAR INTELLIGENCE */}
        {sidebarOpen && (
          <aside
            className="shrink-0 flex flex-col overflow-hidden bg-white border-l border-slate-200 animate-in slide-in-from-right duration-500"
            style={{
              width: sidebarWidth,
              minWidth: 360,
              maxWidth: "65%",
              height: "100%",
            }}
          >
            {/* Sidebar Header */}
            <div className="shrink-0 px-6 py-4 border-b border-slate-100/60 bg-white/50 backdrop-blur-md">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
                    <SparklesIcon className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h2 className="text-[12px] font-[1000] tracking-[0.2em] text-slate-900 leading-none uppercase">
                      AI ASSISTANT
                    </h2>
                  </div>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all"
                >
                  <CloseIcon />
                </button>
              </div>

              {/* Segmented Control Tabs */}
              <div className="flex p-1 rounded-2xl bg-slate-100/60 ring-1 ring-inset ring-slate-200/40">
                {AI_TABS.map((tab) => {
                  const Icon = tab.Icon;

                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-[9px] font-black uppercase tracking-[0.15em] transition-all duration-300 ${
                        activeTab === tab.id
                          ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50"
                          : "text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      <span className="flex h-4 w-4 items-center justify-center">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="hidden xl:inline">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* AI Content Area */}
            <div
              className={`flex-1 min-h-0 animate-soft-reveal scrollbar-none ${
                activeTab === "mindmap" || activeTab === "ask" || activeTab === "note"
                  ? "flex flex-col overflow-hidden px-6 pt-4 pb-0"
                  : "overflow-y-auto px-6 py-5 pb-24"
              }`}
              key={activeTab}
            >
              {activeTab === "summary" && renderSummary()}
              {activeTab === "mindmap" && renderMindMap()}
              {activeTab === "ask" && renderAsk()}
              {activeTab === "note" && renderSksNote()}
              {activeTab === "related" && renderRelated()}
            </div>
          </aside>
        )}
      </div>

      {/* ELITE SUMMARY MODAL */}
      {isMindMapModalOpen && renderMindMapModal()}
      {isSummaryModalOpen && renderSummaryModal()}
      {isSummaryHistoryOpen && renderSummaryHistoryModal()}
      {isMindMapHistoryOpen && renderMindMapHistoryModal()}
      {isNoteHistoryOpen && renderNoteHistoryModal()}
      {isNoteTitleModalOpen && renderNoteTitleModal()}
      {isSummaryRefreshConfirmOpen && renderSummaryRefreshConfirmModal()}
      {isMindMapRefreshConfirmOpen && renderMindMapRefreshConfirmModal()}
    </div>
  );
};

export default DocumentViewer;
