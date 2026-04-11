import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDocViewer } from '../context/DocViewerContext.jsx';
import MindMapCanvas from '../components/documents/MindMapCanvas.jsx';
import {
  getFilePresentation,
} from '../components/workspace/DocumentLibraryPanel.jsx';
import {
  downloadDocumentFile,
  fetchDocumentFile,
  getDocumentDetails,
  getRelatedDocuments,
  openDocumentFile,
  toggleFavorite,
} from '../service/documentAPI.js';
import { rememberRecentDocument } from '../utils/recentDocuments.js';
import {
  askDocument,
  clearDocumentAskHistory,
  getDocumentAskHistory,
  getDocumentMindMap,
  getDocumentSummary,
} from '../service/ragAPI.js';

/* ─── Icons ─── */
const ArrowLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 font-bold">
    <path fillRule="evenodd" d="M12.78 15.53a.75.75 0 0 1-1.06 0l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 1 1 1.06 1.06L9.06 10l3.72 3.72a.75.75 0 0 1 0 1.06Z" clipRule="evenodd" />
  </svg>
);

const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
    <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v7.19L7.03 7.72a.75.75 0 0 0-1.06 1.06l3.5 3.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 1 0-1.06-1.06l-2.22 2.22V2.75Z" />
    <path d="M3.5 13.25a.75.75 0 0 0-1.5 0v1A2.75 2.75 0 0 0 4.75 17h10.5A2.75 2.75 0 0 0 18 14.25v-1a.75.75 0 0 0-1.5 0v1c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-1Z" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
    <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Z" clipRule="evenodd" />
    <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06Z" clipRule="evenodd" />
  </svg>
);

const StarIcon = ({ filled }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="m9.049 2.927.951 1.927.951-1.927a1 1 0 0 1 1.793 0l1.28 2.594 2.863.416a1 1 0 0 1 .554 1.706l-2.072 2.02.49 2.852a1 1 0 0 1-1.451 1.054L10 12.347l-2.559 1.346A1 1 0 0 1 6 12.639l.49-2.852-2.072-2.02a1 1 0 0 1 .554-1.706l2.863-.416 1.28-2.594a1 1 0 0 1 1.793 0Z" />
  </svg>
);

const SparklesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
    <path d="M10 1a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 1ZM5.05 3.05a.75.75 0 0 1 1.06 0l1.062 1.06a.75.75 0 1 1-1.06 1.06L5.05 4.11a.75.75 0 0 1 0-1.06ZM14.95 3.05a.75.75 0 0 1 0 1.06l-1.06 1.062a.75.75 0 0 1-1.062-1.06l1.06-1.062a.75.75 0 0 1 1.062 0ZM3 10a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 3 10ZM14 10a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 14 10ZM5.05 16.95a.75.75 0 0 1 0-1.06l1.06-1.062a.75.75 0 0 1 1.06 1.06l-1.06 1.06a.75.75 0 0 1-1.06 0ZM14.95 16.95a.75.75 0 0 1-1.06 0l-1.062-1.06a.75.75 0 0 1 1.06-1.06l1.062 1.06a.75.75 0 0 1 0 1.06ZM10 17a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 17Z" />
  </svg>
);

const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
    <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288Z" />
  </svg>
);
const ExpandIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
    <path d="M13.28 7.78l3.22-3.22V7a.75.75 0 001.5 0V3.25a.75.75 0 00-.75-.75H13a.75.75 0 000 1.5h2.44l-3.22 3.22a.75.75 0 101.06 1.06zM6.72 12.22l-3.22 3.22V13a.75.75 0 00-1.5 0v3.75c0 .414.336.75.75.75H6.5a.75.75 0 000-1.5H4.06l3.22-3.22a.75.75 0 10-1.06-1.06z" />
  </svg>
);

/* ─── Tab Data ─── */
const AI_TABS = [
  { id: 'summary', label: 'Summary', icon: '✨' },
  { id: 'diagram', label: 'Mind Map', icon: '🗺' },
  { id: 'ask', label: 'Ask AI', icon: '🧠' },
  { id: 'related', label: 'Related', icon: '🔗' },
];

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

const isMindMapNodeVisible = (node, targetId, expandedNodeIds = new Set(), showAllNodes = false, rootId = node?.id) => {
  if (!node || !targetId) {
    return false;
  }

  if (node.id === targetId) {
    return true;
  }

  const shouldVisitChildren =
    showAllNodes
    || node.id === rootId
    || expandedNodeIds.has(node.id);

  if (!shouldVisitChildren) {
    return false;
  }

  return (node.children || []).some((child) => (
    isMindMapNodeVisible(child, targetId, expandedNodeIds, showAllNodes, rootId)
  ));
};

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
  </svg>
);

/* ─── Reusable Components ─── */
const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse rounded-2xl bg-sks-slate-100 ${className}`} />
);

const InlineAlert = ({ children, tone = 'info' }) => {
  const tones = {
    info: 'border-sks-primary/10 bg-sks-primary-light/50 text-sks-primary',
    error: 'border-rose-200 bg-rose-50 text-rose-700',
    warn: 'border-amber-200 bg-amber-50 text-amber-800',
  };
  return (
    <div className={`rounded-2xl border px-5 py-4 text-[14px] font-medium leading-relaxed ${tones[tone]} animate-fade-up`}>
      {children}
    </div>
  );
};

const SourceCard = ({ source, onOpen }) => (
  <button
    type="button"
    onClick={() => onOpen?.(source.documentId)}
    className="group block w-full rounded-2xl border border-sks-slate-100 bg-white p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-sks-primary/20 hover:shadow-sks-soft active:scale-[0.98]"
  >
    <div className="flex items-center justify-between gap-3">
      <p className="truncate text-[14px] font-black tracking-tight text-sks-slate-900 transition-colors group-hover:text-sks-primary">
        {source.documentName}
      </p>
      {typeof source.score === 'number' && (
        <span className="shrink-0 rounded-full bg-sks-primary-light px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-sks-primary">
          {Math.round(source.score * 100)}% Match
        </span>
      )}
    </div>
    {source.snippet && (
      <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-sks-slate-500 italic">
        "{source.snippet}"
      </p>
    )}
    <p className="mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-sks-slate-400">
      Source Fragment · Ch {source.chunkIndex} {source.pageNumber ? ` · P. ${source.pageNumber}` : ''}
    </p>
  </button>
);

const RelatedCard = ({ document, onOpen }) => {
  const file = getFilePresentation(document);
  const docFileTypeTone = file.accent.replace('bg-teal-50', 'bg-sks-primary-light').replace('text-teal-700', 'text-sks-primary');
  
  return (
    <button
      type="button"
      onClick={() => onOpen(document.id)}
      className="group flex w-full items-start gap-4 rounded-2xl border border-sks-slate-100 bg-white p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-sks-primary/20 hover:shadow-sks-soft active:scale-[0.98] animate-fade-up"
    >
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm ${docFileTypeTone}`}>
        {file.label}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-black tracking-tight text-sks-slate-900 transition-colors group-hover:text-sks-primary">
          {document.title}
        </p>
        <p className="mt-1 text-[11px] font-bold text-sks-slate-400">
          {document.folderName || 'General Workspace'} · {document.formattedFileSize || '—'}
        </p>
      </div>
    </button>
  );
};

/* ─── Main Component ─── */
  const DocumentViewer = () => {
  const navigate = useNavigate();
  const { documentId } = useParams();
  const { clearDocViewer } = useDocViewer();

  /* Core state */
  const [documentData, setDocumentData] = useState(null);
  const [relatedDocuments, setRelatedDocuments] = useState([]);
  const [fileUrl, setFileUrl] = useState('');
  const [contentType, setContentType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /* AI Rail state */
  const [activeTab, setActiveTab] = useState('summary');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(580);

  const [summaryState, setSummaryState] = useState({ loading: false, error: '', data: null });
  const [selectedLanguage, setSelectedLanguage] = useState('vi');
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isSummaryRefreshConfirmOpen, setIsSummaryRefreshConfirmOpen] = useState(false);
  const [isMindMapModalOpen, setIsMindMapModalOpen] = useState(false);
  const [isMindMapRefreshConfirmOpen, setIsMindMapRefreshConfirmOpen] = useState(false);
  const [diagramState, setDiagramState] = useState({ loading: false, error: '', data: null });
  const [selectedMindMapNodeId, setSelectedMindMapNodeId] = useState(null);
  const [mindMapViewMode, setMindMapViewMode] = useState('explore');
  const [expandedMindMapNodeIds, setExpandedMindMapNodeIds] = useState([]);
  const [askQuestion, setAskQuestion] = useState('');
  const [askHistoryState, setAskHistoryState] = useState({
    loading: false,
    error: '',
    items: [],
    loaded: false,
    clearing: false,
  });
  const [askState, setAskState] = useState({
    loading: false,
    error: '',
    pendingQuestion: '',
  });

  const chatInputRef = useRef(null);
  const askThreadRef = useRef(null);
  const isResizing = useRef(false);
  const containerRef = useRef(null);

  /* ─── Resize Handler ─── */
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent) => {
      if (!isResizing.current || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = containerRect.right - moveEvent.clientX;
      setSidebarWidth(Math.max(320, Math.min(newWidth, containerRect.width * 0.65)));
    };

    const onMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  /* ─── Data Persistence ─── */
  useEffect(() => {
    if (documentData?.id) rememberRecentDocument(documentData.id);
  }, [documentData?.id]);

  /* ─── Data Loading ─── */
  useEffect(() => {
    if (!documentId) return undefined;
    let isActive = true;
    let objectUrl = '';

    const load = async () => {
      try {
        if (isActive) setLoading(true);
        const docResult = await getDocumentDetails(documentId);
        const [relResult, fileResult] = await Promise.allSettled([
          getRelatedDocuments(documentId, 4),
          fetchDocumentFile(documentId),
        ]);

        if (fileResult.status === 'fulfilled') {
          objectUrl = URL.createObjectURL(fileResult.value.blob);
        }
        if (!isActive) { URL.revokeObjectURL(objectUrl); return; }

        setDocumentData(docResult.document);
        setRelatedDocuments(relResult.status === 'fulfilled' ? relResult.value.documents || [] : []);
        setFileUrl(objectUrl);
        setContentType(fileResult.status === 'fulfilled' ? fileResult.value.contentType || fileResult.value.blob.type || '' : '');

        const partials = [];
        if (relResult.status === 'rejected') partials.push('Related documents are unavailable.');
        if (fileResult.status === 'rejected') partials.push('Preview file could not be loaded.');
        setError(partials.join(' '));
      } catch (err) {
        if (isActive) {
          setDocumentData(null);
          setError(err.response?.data?.message || 'Failed to load the document viewer.');
        }
      } finally {
        if (isActive) setLoading(false);
      }
    };

    void load();
    return () => { isActive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [documentId]);

  /* ─── Tabs Cleanup ─── */
  useEffect(() => {
    setActiveTab('summary');
    setSummaryState({ loading: false, error: '', data: null });
    setIsSummaryModalOpen(false);
    setIsSummaryRefreshConfirmOpen(false);
    setIsMindMapModalOpen(false);
    setIsMindMapRefreshConfirmOpen(false);
    setDiagramState({ loading: false, error: '', data: null });
    setSelectedMindMapNodeId(null);
    setMindMapViewMode('explore');
    setExpandedMindMapNodeIds([]);
    setAskQuestion('');
    setAskHistoryState({
      loading: false,
      error: '',
      items: [],
      loaded: false,
      clearing: false,
    });
    setAskState({ loading: false, error: '', pendingQuestion: '' });
  }, [documentId]);

  /* ─── AI Logic ─── */
  const loadSummary = useCallback(async (language = selectedLanguage, options = {}) => {
    if (!documentId || summaryState.loading) return;
    try {
      const targetLanguage = language || selectedLanguage;
      const forceRefresh = Boolean(options.forceRefresh);
      setSelectedLanguage(targetLanguage);
      setSummaryState(s => ({ ...s, loading: true, error: '' }));
      const result = await getDocumentSummary(documentId, targetLanguage, {
        forceRefresh,
      });
      setSummaryState({ 
        loading: false, 
        error: '', 
        data: result
      });
    } catch (err) {
      setSummaryState({ loading: false, error: err.response?.data?.message || 'AI could not summarize this.', data: null });
    }
  }, [documentId, selectedLanguage, summaryState.loading]);

  const loadDiagram = useCallback(async (language = selectedLanguage, options = {}) => {
    if (!documentId || diagramState.loading) return;
    try {
      const targetLanguage = language || selectedLanguage;
      const forceRefresh = Boolean(options.forceRefresh);
      setSelectedLanguage(targetLanguage);
      setDiagramState(s => ({ ...s, loading: true, error: '' }));
      const result = await getDocumentMindMap(documentId, targetLanguage, {
        forceRefresh,
      });
      setDiagramState({
        loading: false,
        error: '',
        data: {
          mindMap: result.mindMap || null,
          summary: result.summary || '',
          language: result.language || targetLanguage,
          generatedAt: result.generatedAt || '',
          cached: Boolean(result.cached),
        },
      });
      const rootId = result.mindMap?.id || 'root';
      setSelectedMindMapNodeId(rootId);
      setMindMapViewMode('explore');
      setExpandedMindMapNodeIds(rootId ? [rootId] : []);
    } catch (err) {
      setDiagramState({ loading: false, error: err.response?.data?.message || 'AI could not build this mind map.', data: null });
      setSelectedMindMapNodeId(null);
      setExpandedMindMapNodeIds([]);
    }
  }, [documentId, diagramState.loading, selectedLanguage]);

  const loadAskHistory = useCallback(async () => {
    if (!documentId || askHistoryState.loading) return;

    try {
      setAskHistoryState((current) => ({
        ...current,
        loading: true,
        error: '',
      }));
      const result = await getDocumentAskHistory(documentId);
      setAskHistoryState({
        loading: false,
        error: '',
        items: result.items || [],
        loaded: true,
        clearing: false,
      });
    } catch (err) {
      setAskHistoryState((current) => ({
        ...current,
        loading: false,
        error: err.response?.data?.message || 'Could not load question history.',
        loaded: true,
      }));
    }
  }, [documentId, askHistoryState.loading]);

  const handleClearAskHistory = useCallback(async () => {
    if (!documentId || askHistoryState.clearing) return;

    try {
      setAskHistoryState((current) => ({
        ...current,
        clearing: true,
        error: '',
      }));
      await clearDocumentAskHistory(documentId);
      setAskHistoryState({
        loading: false,
        error: '',
        items: [],
        loaded: true,
        clearing: false,
      });
      setAskState({ loading: false, error: '', pendingQuestion: '' });
    } catch (err) {
      setAskHistoryState((current) => ({
        ...current,
        clearing: false,
        error: err.response?.data?.message || 'Could not clear question history.',
      }));
    }
  }, [documentId, askHistoryState.clearing]);

  /* ─── Actions ─── */
  const handleToggleFavorite = async (id) => {
    try {
      await toggleFavorite(id);
      setDocumentData(c => c && c.id === id ? { ...c, isFavorite: !c.isFavorite } : c);
    } catch (err) { console.error('Favorite toggle failed:', err); }
  };

  const handleOpenRawFile = useCallback(async () => {
    if (!documentId) return;
    try { await openDocumentFile(documentId); } catch (err) { console.error('Open fail:', err); }
  }, [documentId]);

  const handleDownload = async (id, title) => {
    try { await downloadDocumentFile(id, title); } catch (err) { console.error('Download fail:', err); }
  };

  /* ─── Sync doc info and actions (Simplified) ─── */
  useEffect(() => {
    return () => clearDocViewer();
  }, [clearDocViewer]);

  useEffect(() => {
    if (activeTab !== 'ask' || askHistoryState.loaded || askHistoryState.loading) {
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
        error: '',
        pendingQuestion: trimmedQuestion,
      });
      const result = await askDocument(documentId, trimmedQuestion);
      setAskHistoryState((current) => ({
        ...current,
        items: [...current.items, result.historyItem],
        loaded: true,
        error: '',
      }));
      setAskQuestion('');
      setAskState({ loading: false, error: '', pendingQuestion: '' });
    } catch (err) {
      setAskState({
        loading: false,
        error: err.response?.data?.message || 'AI consultation failed.',
        pendingQuestion: '',
      });
    }
  };

  const handleAskKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleAsk(); }
  };

  const selectedMindMapNode = useMemo(
    () =>
      findMindMapNodeById(
        diagramState.data?.mindMap,
        selectedMindMapNodeId,
      ),
    [diagramState.data?.mindMap, selectedMindMapNodeId],
  );

  const rootMindMapId = diagramState.data?.mindMap?.id || null;

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

  const handleMindMapNodeToggle = useCallback((nodeId) => {
    if (mindMapViewMode === 'all') {
      return;
    }

    const targetNode = findMindMapNodeById(diagramState.data?.mindMap, nodeId);

    if (!targetNode?.children?.length) {
      return;
    }

    const isCollapsing = expandedMindMapNodeIds.includes(nodeId);

    if (
      isCollapsing
      && selectedMindMapNodeId
      && selectedMindMapNodeId !== nodeId
      && findMindMapNodeById(targetNode, selectedMindMapNodeId)
    ) {
      setSelectedMindMapNodeId(nodeId);
    }

    setExpandedMindMapNodeIds((currentIds) => (
      currentIds.includes(nodeId)
        ? currentIds.filter((currentId) => currentId !== nodeId)
        : [...currentIds, nodeId]
    ));
  }, [diagramState.data?.mindMap, expandedMindMapNodeIds, mindMapViewMode, selectedMindMapNodeId]);

  const handleMindMapViewModeChange = useCallback((mode) => {
    setMindMapViewMode(mode);

    if (mode === 'explore') {
      const nextExpandedIds = expandedMindMapNodeIds.length > 0
        ? expandedMindMapNodeIds
        : (rootMindMapId ? [rootMindMapId] : []);

      if (expandedMindMapNodeIds.length === 0 && rootMindMapId) {
        setExpandedMindMapNodeIds(nextExpandedIds);
      }

      if (
        selectedMindMapNodeId
        && !isMindMapNodeVisible(
          diagramState.data?.mindMap,
          selectedMindMapNodeId,
          new Set(nextExpandedIds),
          false,
          rootMindMapId,
        )
      ) {
        setSelectedMindMapNodeId(rootMindMapId);
      }
    }
  }, [
    diagramState.data?.mindMap,
    expandedMindMapNodeIds,
    rootMindMapId,
    selectedMindMapNodeId,
  ]);

  const handleMindMapLanguageChange = useCallback((language) => {
    if (diagramState.data?.mindMap) {
      void loadDiagram(language);
      return;
    }

    setSelectedLanguage(language);
  }, [diagramState.data?.mindMap, loadDiagram]);

  /* ─── Tab Components ─── */
  const renderSummary = () => {
    if (!summaryState.loading && !summaryState.data && !summaryState.error) return (
      <div className="flex flex-col items-center justify-center py-10 text-center animate-fade-in">
        <div className="relative mb-10">
           <div className="absolute -inset-8 rounded-full bg-cyan-100/40 animate-pulse" />
           <div className="relative flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-3xl shadow-2xl shadow-cyan-500/30">✨</div>
        </div>
        
        <h3 className="text-[14px] font-[1000] text-slate-900 uppercase tracking-[0.2em] mb-3">Asset Intelligence</h3>
        <p className="text-[12px] font-medium text-slate-400 max-w-[240px] leading-relaxed mb-10">Select a target language to synthesize wisdom from this asset.</p>
        
        <div className="mb-8 flex p-1.5 rounded-2xl bg-slate-100/80 ring-1 ring-inset ring-slate-200/40 w-full max-w-[240px]">
          <button 
            onClick={() => setSelectedLanguage('vi')}
            className={`flex-1 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all ${selectedLanguage === 'vi' ? 'bg-white text-cyan-600 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Tiếng Việt
          </button>
          <button 
            onClick={() => setSelectedLanguage('en')}
            className={`flex-1 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all ${selectedLanguage === 'en' ? 'bg-white text-cyan-600 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-400 hover:text-slate-600'}`}
          >
            English
          </button>
        </div>

        <button 
          onClick={() => void loadSummary()}
          className="group relative flex h-14 w-full items-center justify-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 px-8 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-cyan-500/20 transition-all hover:scale-[1.02] active:scale-95"
        >
          <span>Generate Summary</span>
          <ArrowLeftIcon />
        </button>
      </div>
    );

    if (summaryState.loading) return (
      <div className="space-y-6 animate-pulse px-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full opacity-70" />
        <Skeleton className="h-4 w-5/6 opacity-50" />
        <div className="pt-8 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );

    if (summaryState.error) return <InlineAlert tone="error">{summaryState.error}</InlineAlert>;
    if (!summaryState.data) return null;

    const { title, overview, key_points, conclusion } = summaryState.data;
    const activeSummaryLanguage = summaryState.data.language || selectedLanguage;

    return (
      <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
               <SparklesIcon className="h-5 w-5" />
             </div>
             <div className="flex flex-col">
                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Summary</h3>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">AI Summary</span>
             </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200/40">
              <button
                type="button"
                onClick={() => void loadSummary('vi')}
                className={`rounded-lg px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${activeSummaryLanguage === 'vi' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}
              >
                VI
              </button>
              <button
                type="button"
                onClick={() => void loadSummary('en')}
                className={`rounded-lg px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${activeSummaryLanguage === 'en' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}
              >
                EN
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsSummaryRefreshConfirmOpen(true)}
              className="rounded-xl bg-slate-100 px-3.5 py-2 text-[9px] font-[1000] uppercase tracking-[0.15em] text-slate-500 ring-1 ring-slate-200/40 transition-all hover:bg-white hover:text-cyan-600 hover:shadow-sks-soft"
              title="Create a new summary for the current language"
            >
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
          
          <section className="space-y-4">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Overview</p>
            <p className="text-[16px] leading-[1.8] font-medium text-slate-600">
              {overview}
            </p>
          </section>

          <section className="space-y-6">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Key Findings</p>
            <div className="grid grid-cols-1 gap-5">
              {key_points?.map((point, i) => (
                <div key={i} className="flex gap-5 group">
                  <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-[10px] font-black text-slate-400 ring-1 ring-slate-200 transition-all group-hover:bg-cyan-50 group-hover:text-cyan-600 group-hover:ring-cyan-200">
                    {i + 1}
                  </div>
                  <p className="text-[15px] leading-relaxed font-bold text-slate-800">{point}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-[0_30px_60px_-15px_rgba(15,23,42,0.4)] border border-white/10">
            <div className="absolute top-0 right-0 p-8 opacity-10"><SparklesIcon className="text-cyan-400 h-16 w-16" /></div>
            <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-cyan-500/20 blur-3xl opacity-30" />
            <p className="relative z-10 text-[9px] font-black text-cyan-400 uppercase tracking-[0.4em] mb-4">Conclusion</p>
            <p className="relative z-10 text-xl font-bold leading-relaxed italic text-slate-50 tracking-tight">
              "{conclusion}"
            </p>
          </div>

        </div>
      </div>
    );
  };

  const renderMindMapNodeDetail = (mode = 'canvas') => {
    if (!selectedMindMapNode) {
      return null;
    }

    const detailLanguage = diagramState.data?.language || selectedLanguage;
    const isVietnamese = detailLanguage === 'vi';
    const childCount = selectedMindMapNode.children?.length || 0;
    const summaryText = selectedMindMapNode.summary
      || (childCount > 0
        ? (isVietnamese
          ? 'Phan nay gom cac y lien quan de ban tiep tuc theo doi trong tai lieu.'
          : 'This branch groups the next ideas in the document.')
        : '');

    const isFloating = mode === 'floating';
    const isCanvasOverlay = mode === 'canvas';
    const isCompact = mode === 'compact';
    const containerClass = isFloating
      ? 'pointer-events-auto flex h-full w-[400px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/96 shadow-[0_36px_90px_-44px_rgba(15,23,42,0.42)] backdrop-blur-xl'
      : isCanvasOverlay
        ? 'pointer-events-auto flex max-h-[min(62vh,540px)] w-full max-w-[440px] flex-col overflow-hidden rounded-[26px] border border-slate-200/80 bg-white/96 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.34)] backdrop-blur-xl'
        : 'pointer-events-auto flex max-h-[320px] w-[320px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[22px] border border-slate-200/80 bg-white/96 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.34)] backdrop-blur-xl';
    const childPreviewLimit = isCompact ? 3 : 6;
    const childPreviewNodes = selectedMindMapNode.children?.slice(0, childPreviewLimit) || [];
    const displaySummaryText = isCompact && summaryText.length > 220
      ? `${summaryText.slice(0, 220).trimEnd()}...`
      : summaryText;
    const hiddenBranchCount = Math.max(childCount - childPreviewNodes.length, 0);
    const branchCountLabel = childCount > 0
      ? (isVietnamese
        ? `${childCount} nhanh`
        : `${childCount} ${childCount === 1 ? 'branch' : 'branches'}`)
      : null;
    const branchHint = childCount > 0
      ? (isVietnamese
        ? 'Chon mot nhanh ben duoi de xem tiep.'
        : 'Choose a branch below to continue.')
      : null;

    return (
      <div className={containerClass}>
        <div className={`flex items-start justify-between border-b border-slate-100 ${isCompact ? 'gap-3 px-4 py-3' : 'gap-4 px-5 py-4'}`}>
          <div className="min-w-0">
            <p className={`font-black uppercase text-slate-400 ${isCompact ? 'text-[8px] tracking-[0.2em]' : 'text-[9px] tracking-[0.24em]'}`}>
              Study Note
            </p>
            <h4 className={`font-black leading-snug tracking-tight text-slate-950 ${isCompact ? 'mt-1.5 text-[15px]' : 'mt-2 text-[18px]'}`}>
              {selectedMindMapNode.label}
            </h4>
          </div>
          <button
            type="button"
            onClick={handleMindMapNoteClose}
            className={`flex shrink-0 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-900 ${isCompact ? 'h-8 w-8' : 'h-9 w-9'}`}
            title="Close note"
          >
            <CloseIcon />
          </button>
        </div>

        <div className={`flex-1 overflow-y-auto scrollbar-none ${isCompact ? 'space-y-4 px-4 py-3' : 'space-y-5 px-5 py-4'}`}>
          {displaySummaryText ? (
            <section className={isCompact ? 'space-y-1.5' : 'space-y-2'}>
              <p className={`font-black uppercase tracking-[0.2em] text-slate-400 ${isCompact ? 'text-[8px]' : 'text-[9px]'}`}>
                Overview
              </p>
              <div className={`border border-slate-200/80 bg-slate-50/85 ${isCompact ? 'rounded-[16px] p-3' : 'rounded-[20px] p-4'}`}>
                <p className={`text-slate-600 ${isCompact ? 'text-[12px] leading-6' : 'text-[13px] leading-7'}`}>
                  {displaySummaryText}
                </p>
              </div>
            </section>
          ) : null}

          {childPreviewNodes.length > 0 && (
            <section className={isCompact ? 'space-y-2.5' : 'space-y-3'}>
              <div className="flex items-center justify-between gap-3">
                <p className={`font-black uppercase tracking-[0.2em] text-slate-400 ${isCompact ? 'text-[8px]' : 'text-[9px]'}`}>
                  Next Branches
                </p>
                {branchCountLabel ? (
                  <span className={`rounded-full bg-slate-100 font-black uppercase tracking-[0.16em] text-slate-500 ring-1 ring-slate-200/80 ${isCompact ? 'px-2.5 py-1 text-[8px]' : 'px-3 py-1 text-[9px]'}`}>
                    {branchCountLabel}
                  </span>
                ) : null}
              </div>
              <div className={isCompact ? 'space-y-1.5' : 'space-y-2'}>
                {childPreviewNodes.map((childNode) => (
                  <button
                    key={childNode.id}
                    type="button"
                    onClick={() => handleMindMapNodeSelect(childNode.id)}
                    className={`block w-full border border-slate-200 bg-white text-left font-semibold text-slate-700 transition-all hover:border-cyan-200 hover:bg-cyan-50/70 hover:text-slate-950 ${isCompact ? 'rounded-xl px-3 py-2.5 text-[12px]' : 'rounded-2xl px-3.5 py-3 text-[13px]'}`}
                  >
                    {childNode.label}
                  </button>
                ))}
              </div>
              {isCompact && hiddenBranchCount > 0 ? (
                <p className="text-[10px] font-semibold text-slate-400">
                  {isVietnamese
                    ? `+${hiddenBranchCount} nhanh nua`
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

  const renderDiagram = () => {
    const isShowingAllNodes = mindMapViewMode === 'all';

    if (!diagramState.loading && !diagramState.data && !diagramState.error) {
      return (
        <div className="flex flex-col items-center justify-center py-10 text-center animate-fade-in">
          <div className="relative mb-10">
             <div className="absolute -inset-8 rounded-full bg-cyan-100/40 animate-pulse" />
             <div className="relative flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-3xl shadow-2xl shadow-cyan-500/30">🗺</div>
          </div>

          <h3 className="text-[14px] font-[1000] text-slate-900 uppercase tracking-[0.2em] mb-3">Mind Map</h3>
          <p className="text-[12px] font-medium text-slate-400 max-w-[240px] leading-relaxed mb-10">Select a target language to generate a knowledge network from this asset.</p>

          <div className="mb-8 flex p-1.5 rounded-2xl bg-slate-100/80 ring-1 ring-inset ring-slate-200/40 w-full max-w-[240px]">
            <button 
              onClick={() => setSelectedLanguage('vi')}
              className={`flex-1 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all ${selectedLanguage === 'vi' ? 'bg-white text-cyan-600 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Tiếng Việt
            </button>
            <button 
              onClick={() => setSelectedLanguage('en')}
              className={`flex-1 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all ${selectedLanguage === 'en' ? 'bg-white text-cyan-600 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-400 hover:text-slate-600'}`}
            >
              English
            </button>
          </div>

          <button 
            onClick={() => void loadDiagram(selectedLanguage)}
            className="group relative flex h-14 w-full items-center justify-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 px-8 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-cyan-500/20 transition-all hover:scale-[1.02] active:scale-95"
          >
            <span>Generate Mind Map</span>
            <ArrowLeftIcon />
          </button>
        </div>
      );
    }

    if (diagramState.loading) {
      return (
        <div className="space-y-4 animate-pulse">
          <Skeleton className="h-36 w-full rounded-[28px]" />
          <Skeleton className="h-[420px] w-full rounded-[30px]" />
          <Skeleton className="h-32 w-full rounded-[24px]" />
        </div>
      );
    }

    if (diagramState.error) return <InlineAlert tone="error">{diagramState.error}</InlineAlert>;
    if (!diagramState.data?.mindMap) return null;

    return (
      <div className="flex flex-col h-full gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Compact Single-Row Control Bar */}
        <div className="flex items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-xs shadow-md shadow-cyan-500/20">🗺</div>
            <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Mind Map</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex p-0.5 rounded-lg bg-slate-100 ring-1 ring-slate-200/40">
              <button
                type="button"
                onClick={() => handleMindMapLanguageChange('vi')}
                className={`rounded-md px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition-all ${
                  selectedLanguage === 'vi' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-700'
                }`}
              >VI</button>
              <button
                type="button"
                onClick={() => handleMindMapLanguageChange('en')}
                className={`rounded-md px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition-all ${
                  selectedLanguage === 'en' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-700'
                }`}
              >EN</button>
            </div>
            <div className="flex p-0.5 rounded-lg bg-slate-100 ring-1 ring-slate-200/40">
              <button
                type="button"
                onClick={() => handleMindMapViewModeChange('explore')}
                className={`rounded-md px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition-all ${
                  !isShowingAllNodes ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-700'
                }`}
              >Explore</button>
              <button
                type="button"
                onClick={() => handleMindMapViewModeChange('all')}
                className={`rounded-md px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition-all ${
                  isShowingAllNodes ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-700'
                }`}
              >All</button>
            </div>
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

        {/* Canvas — chiếm toàn bộ không gian còn lại */}
        <div className="relative flex-1 rounded-[1.5rem] bg-slate-50/60 border border-slate-200/60 overflow-hidden shadow-inner min-h-0">
          <MindMapCanvas
            mindMap={diagramState.data.mindMap}
            selectedNodeId={selectedMindMapNode?.id}
            expandedNodeIds={expandedMindMapNodeIdSet}
            showAllNodes={isShowingAllNodes}
            onNodeSelect={handleMindMapNodeSelect}
            onNodeToggle={handleMindMapNodeToggle}
            language={diagramState.data.language || selectedLanguage}
            height="100%"
            compact
          />

          {/* Node Detail — floating overlay bên trong canvas */}
          {selectedMindMapNode && (
            <div className="pointer-events-none absolute bottom-3 right-3">
              {renderMindMapNodeDetail('compact')}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAskLegacy = () => {
    const _suggestedQuestions = [
      'Tóm tắt nội dung chính của tài liệu này?',
      'Các khái niệm quan trọng nhất là gì?',
      'Giải thích phần khó hiểu nhất?',
    ];

    return (
      <div className="flex flex-col h-full gap-0">
        {/* Chat Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none px-1 py-4 space-y-6">

          {/* Empty State */}
          {!askState.answer && !askState.loading && (
            <div className="flex flex-col items-center justify-center h-full text-center animate-in fade-in duration-500">
              <div className="relative mb-5">
                <div className="absolute -inset-4 rounded-full bg-cyan-100/50 animate-pulse" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-[20px] bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-2xl shadow-xl shadow-cyan-500/25">🧠</div>
              </div>
              <h3 className="text-[13px] font-black text-slate-900 uppercase tracking-[0.2em] mb-1.5">Ask AI</h3>
              <p className="text-[11px] text-slate-400 font-medium">Ask your questions below to get started</p>
            </div>
          )}

          {/* Loading skeleton */}
          {askState.loading && !askState.answer && (
            <div className="flex justify-end animate-in fade-in duration-300">
              <div className="max-w-[85%] rounded-[1.25rem] rounded-tr-sm bg-slate-900 px-4 py-3 text-[13px] font-medium text-slate-100 shadow-lg">
                {askQuestion}
              </div>
            </div>
          )}

          {/* Q&A Message */}
          {askState.answer && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-400">
              {/* User Bubble */}
              <div className="flex justify-end">
                <div className="max-w-[86%] rounded-[1.25rem] rounded-tr-sm bg-slate-900 px-4 py-3 text-[13px] font-medium leading-relaxed text-slate-100 shadow-lg">
                  {askQuestion}
                </div>
              </div>

              {/* AI Bubble */}
              <div className="flex justify-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20 mt-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                    <path d="M15.98 1.804a1 1 0 0 0-1.96 0l-.24 1.192a1 1 0 0 1-.784.785l-1.192.238a1 1 0 0 0 0 1.962l1.192.238a1 1 0 0 1 .785.785l.238 1.192a1 1 0 0 0 1.962 0l.238-1.192a1 1 0 0 1 .785-.785l1.192-.238a1 1 0 0 0 0-1.962l-1.192-.238a1 1 0 0 1-.785-.785l-.238-1.192ZM6.949 5.684a1 1 0 0 0-1.898 0l-.683 2.051a1 1 0 0 1-.633.633l-2.051.683a1 1 0 0 0 0 1.898l2.051.684a1 1 0 0 1 .633.632l.683 2.051a1 1 0 0 0 1.898 0l.683-2.051a1 1 0 0 1 .633-.633l2.051-.683a1 1 0 0 0 0-1.898l-2.051-.683a1 1 0 0 1-.633-.633L6.95 5.684Z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-cyan-600">SKS Intelligence</span>
                  </div>
                  <div className="rounded-[1.25rem] rounded-tl-sm border border-slate-100 bg-white px-5 py-4 shadow-sm">
                    <p className="whitespace-pre-wrap text-[14px] leading-[1.8] text-slate-700 font-medium">
                      {askState.answer}
                    </p>
                  </div>
                  {askState.sources?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3 pl-1">
                      {askState.sources.map((s, i) => (
                        <div key={i} className="flex items-center gap-1.5 rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-1.5">
                          <div className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                          <span className="text-[9px] font-black uppercase tracking-wider text-cyan-600">Nguồn {i + 1}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Typing indicator */}
          {askState.loading && (
            <div className="flex justify-start gap-3 animate-in fade-in duration-300">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M15.98 1.804a1 1 0 0 0-1.96 0l-.24 1.192a1 1 0 0 1-.784.785l-1.192.238a1 1 0 0 0 0 1.962l1.192.238a1 1 0 0 1 .785.785l.238 1.192a1 1 0 0 0 1.962 0l.238-1.192a1 1 0 0 1 .785-.785l1.192-.238a1 1 0 0 0 0-1.962l-1.192-.238a1 1 0 0 1-.785-.785l-.238-1.192ZM6.949 5.684a1 1 0 0 0-1.898 0l-.683 2.051a1 1 0 0 1-.633.633l-2.051.683a1 1 0 0 0 0 1.898l2.051.684a1 1 0 0 1 .633.632l.683 2.051a1 1 0 0 0 1.898 0l.683-2.051a1 1 0 0 1 .633-.633l2.051-.683a1 1 0 0 0 0-1.898l-2.051-.683a1 1 0 0 1-.633-.633L6.95 5.684Z" />
                </svg>
              </div>
              <div className="rounded-[1.25rem] rounded-tl-sm border border-slate-100 bg-white px-5 py-4 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 rounded-full bg-slate-300 animate-bounce" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="shrink-0 pt-2 pb-3 px-1">
          <div className="relative group">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-cyan-500/30 to-blue-500/30 blur-sm opacity-0 group-focus-within:opacity-100 transition-all duration-500" />
            <div className="relative flex items-end gap-0 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden group-focus-within:border-cyan-400 group-focus-within:shadow-lg group-focus-within:shadow-cyan-500/10 transition-all duration-300">
              <textarea
                ref={chatInputRef}
                value={askQuestion}
                onChange={(e) => { setAskQuestion(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
                onKeyDown={handleAskKeyDown}
                rows={1}
                placeholder="Ask anything about the document..."
                className="flex-1 min-h-[48px] resize-none bg-transparent py-3.5 pl-4 pr-2 text-[13px] font-medium text-slate-900 placeholder:text-slate-400 outline-none scrollbar-none"
                style={{ maxHeight: '120px' }}
              />
              <div className="flex items-end p-2">
                <button
                  type="button"
                  onClick={() => void handleAsk()}
                  disabled={askState.loading || !askQuestion.trim()}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:scale-100"
                >
                  {askState.loading ? (
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : <SendIcon />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  void renderAskLegacy;

  const renderAsk = () => {
    const hasHistory = askHistoryState.items.length > 0;
    const askTitle = 'Ask AI';
    const emptyHint = 'Ask your questions below to get started.';
    const inputPlaceholder = 'Ask anything...';

    return (
      <div className="flex flex-col h-full gap-0">
        <div className="shrink-0 flex items-center justify-between px-1 pb-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900">{askTitle}</p>
          {hasHistory ? (
            <button
              type="button"
              onClick={() => void handleClearAskHistory()}
              disabled={askHistoryState.clearing || askState.loading}
              title="Clear history"
              className="flex h-7 w-7 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {askHistoryState.clearing ? (
                <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.519.149.022a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ) : null}
        </div>

        <div
          ref={askThreadRef}
          className="flex-1 min-h-0 overflow-y-auto scrollbar-none px-1 py-4 space-y-6"
        >
          {askHistoryState.error ? <InlineAlert tone="error">{askHistoryState.error}</InlineAlert> : null}

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

          {!askHistoryState.loading && !hasHistory && !askState.loading && !askHistoryState.error ? (
            <div className="flex flex-col items-center justify-center h-full text-center animate-in fade-in duration-500">
              <div className="relative mb-5">
                <div className="absolute -inset-4 rounded-full bg-cyan-100/50 animate-pulse" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-[20px] bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-2xl shadow-xl shadow-cyan-500/25">
                  AI
                </div>
              </div>
              <h3 className="text-[13px] font-black text-slate-900 uppercase tracking-[0.2em] mb-1.5">{askTitle}</h3>
              <p className="text-[11px] text-slate-400 font-medium">{emptyHint}</p>
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
                    <p className="whitespace-pre-wrap text-[14px] leading-[1.8] font-medium text-slate-700">
                      {item.answer}
                    </p>
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

          {askState.error ? <InlineAlert tone="error">{askState.error}</InlineAlert> : null}
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
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                }}
                onKeyDown={handleAskKeyDown}
                rows={1}
                placeholder={inputPlaceholder}
                className="flex-1 min-h-[48px] resize-none bg-transparent py-3.5 pl-4 pr-2 text-[13px] font-medium text-slate-900 outline-none placeholder:text-slate-400 scrollbar-none"
                style={{ maxHeight: '120px' }}
              />
              <div className="flex items-end p-2">
                <button
                  type="button"
                  onClick={() => void handleAsk()}
                  disabled={askState.loading || askHistoryState.clearing || !askQuestion.trim()}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20 transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:scale-100"
                >
                  {askState.loading ? (
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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


  const renderRelated = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col">
        <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Semantic Links</h3>
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Cross-Reference Nodes</span>
      </div>
      <div className="space-y-3">
        {relatedDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-10 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
            <div className="h-10 w-10 text-slate-200 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-full h-full"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>
            </div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">No structural associations</p>
          </div>
        ) : (
          relatedDocuments.map((d) => <RelatedCard key={d.id} document={d} onOpen={(id) => navigate(`/app/documents/${id}`)} />)
        )}
      </div>
    </div>
  );

  const renderMindMapModal = () => {
    if (!diagramState.data?.mindMap) {
      return null;
    }

    const diagramLanguage = diagramState.data.language || selectedLanguage;
    const isShowingAllNodes = mindMapViewMode === 'all';

    return (
      <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/40 p-6 backdrop-blur-md animate-in fade-in duration-500">
        <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[32px] border border-white/20 bg-white shadow-2xl animate-in zoom-in-95 duration-500">

          {/* Header */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-100 px-8 bg-white/80 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/10">
                <span className="text-sm">🗺</span>
              </div>
              <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900">Mind Map</h2>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex p-1 rounded-xl bg-slate-100 ring-1 ring-slate-200/40">
                <button
                  type="button"
                  onClick={() => handleMindMapLanguageChange('vi')}
                  className={`rounded-lg px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${
                    diagramLanguage === 'vi' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-700'
                  }`}
                >VI</button>
                <button
                  type="button"
                  onClick={() => handleMindMapLanguageChange('en')}
                  className={`rounded-lg px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${
                    diagramLanguage === 'en' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-700'
                  }`}
                >EN</button>
              </div>

              <div className="flex p-1 rounded-xl bg-slate-100 ring-1 ring-slate-200/40">
                <button
                  type="button"
                  onClick={() => handleMindMapViewModeChange('explore')}
                  className={`rounded-lg px-4 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${
                    !isShowingAllNodes ? 'bg-cyan-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-700'
                  }`}
                >Explore</button>
                <button
                  type="button"
                  onClick={() => handleMindMapViewModeChange('all')}
                  className={`rounded-lg px-4 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${
                    isShowingAllNodes ? 'bg-cyan-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-700'
                  }`}
                >Full View</button>
              </div>

              <button
                type="button"
                onClick={() => setIsMindMapRefreshConfirmOpen(true)}
                className="flex h-8 items-center gap-2 rounded-xl bg-slate-100 px-4 text-[9px] font-black uppercase tracking-widest text-slate-600 ring-1 ring-slate-200/40 transition-all hover:bg-white hover:text-cyan-600 hover:shadow-sm"
              >
                <SparklesIcon />
                <span className="hidden sm:inline">Regenerate</span>
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
            <MindMapCanvas
              mindMap={diagramState.data.mindMap}
              selectedNodeId={selectedMindMapNode?.id}
              expandedNodeIds={expandedMindMapNodeIdSet}
              showAllNodes={isShowingAllNodes}
              onNodeSelect={handleMindMapNodeSelect}
              onNodeToggle={handleMindMapNodeToggle}
              language={diagramState.data.language || selectedLanguage}
              height="100%"
              compact={false}
            />

            {selectedMindMapNode && (
              <>
                <div className="pointer-events-none absolute inset-x-4 bottom-4 xl:hidden">
                  {renderMindMapNodeDetail('canvas')}
                </div>
                <div className="pointer-events-none absolute bottom-6 right-6 top-6 hidden xl:flex">
                  {renderMindMapNodeDetail('floating')}
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
            onClick={() => navigate('/app')}
            className="flex items-center gap-2 group whitespace-nowrap"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-900 transition-all">
              <ArrowLeftIcon />
            </div>
            <span className="text-[12px] font-black tracking-wide text-slate-500 group-hover:text-slate-900 transition-colors hidden sm:inline">Workspace</span>
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
                  ? 'bg-white text-amber-500 shadow-sm ring-1 ring-amber-100'
                  : 'text-slate-400 hover:bg-white hover:text-amber-500 hover:shadow-sm'
              }`}
              title="Favorite"
            >
              <StarIcon filled={documentData?.isFavorite} />
            </button>
            
            <div className="w-px h-5 bg-slate-200/80 mx-1" />

            <button
              onClick={() => setSidebarOpen(v => !v)}
              title={sidebarOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
              className={`group relative flex h-8 items-center gap-2 rounded-xl px-3.5 text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                sidebarOpen
                  ? 'bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-500 ring-1 ring-slate-200/60'
                  : 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {sidebarOpen ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
                    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                  </svg>
                  <span className="hidden lg:inline">Close AI</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
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
    if (!summaryState.data) return null;
    const { title, overview, key_points, conclusion } = summaryState.data;

    return (
      <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/40 p-6 backdrop-blur-md animate-in fade-in duration-500">
        <div className="relative flex flex-col w-full max-w-3xl max-h-[85vh] rounded-[32px] border border-white/20 bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
          
          {/* Header */}
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 px-8 bg-white/80 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/10">
                <SparklesIcon className="h-4 w-4" />
              </div>
              <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900">Summary</h2>
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

              <div className="space-y-4">
                <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">Overview</p>
                <p className="text-[18px] leading-relaxed font-medium text-slate-600">
                  {overview}
                </p>
              </div>

              <div className="space-y-8">
                <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">Key Points</p>
                <div className="grid gap-6">
                  {key_points?.map((point, i) => (
                    <div key={i} className="flex gap-6 group">
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-[11px] font-black text-slate-400 ring-1 ring-slate-200 transition-all group-hover:bg-cyan-500 group-hover:text-white group-hover:ring-0">
                        {i + 1}
                      </div>
                      <p className="text-[17px] font-bold text-slate-800 leading-snug">
                        {point}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-xl border border-white/5">
                <div className="absolute top-0 right-0 p-8 opacity-10"><SparklesIcon className="text-cyan-400 h-16 w-16" /></div>
                <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-cyan-500/20 blur-3xl opacity-30" />
                <p className="relative z-10 text-[9px] font-black uppercase tracking-[0.4em] text-cyan-500 mb-6">Conclusion</p>
                <p className="relative z-10 text-xl font-bold italic leading-relaxed text-slate-50 tracking-tight">
                  "{conclusion}"
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSummaryRefreshConfirmModal = () => {
    if (!summaryState.data) return null;

    const activeSummaryLanguage = summaryState.data.language || selectedLanguage;
    const languageLabel = activeSummaryLanguage === 'vi' ? 'VI' : 'EN';

    return (
      <div className="fixed inset-0 z-[170] flex items-center justify-center bg-slate-950/50 p-5 backdrop-blur-md animate-in fade-in duration-300">
        <div className="w-full max-w-md rounded-[2rem] border border-white/15 bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-300">
          <div className="flex items-start justify-between gap-6">
            <div className="space-y-3">
              <p className="text-[9px] font-black uppercase tracking-[0.35em] text-slate-400">Confirm Refresh</p>
              <h3 className="text-2xl font-[1000] tracking-tight text-slate-900">Create a new {languageLabel} summary?</h3>
              <p className="text-[14px] leading-relaxed text-slate-600">
                This will create a fresh summary and replace the current version for the selected language.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsSummaryRefreshConfirmOpen(false)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-500"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="mt-8 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsSummaryRefreshConfirmOpen(false)}
              className="rounded-2xl border border-slate-200 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSummaryRefreshConfirmOpen(false);
                void loadSummary(activeSummaryLanguage, { forceRefresh: true });
              }}
              className="rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.02] active:scale-95"
            >
              Confirm New Summary
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderMindMapRefreshConfirmModal = () => {
    if (!diagramState.data?.mindMap) return null;

    const activeDiagramLanguage = diagramState.data.language || selectedLanguage;
    const languageLabel = activeDiagramLanguage === 'vi' ? 'VI' : 'EN';

    return (
      <div className="fixed inset-0 z-[170] flex items-center justify-center bg-slate-950/50 p-5 backdrop-blur-md animate-in fade-in duration-300">
        <div className="w-full max-w-md rounded-[2rem] border border-white/15 bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-300">
          <div className="flex items-start justify-between gap-6">
            <div className="space-y-3">
              <p className="text-[9px] font-black uppercase tracking-[0.35em] text-slate-400">Confirm Refresh</p>
              <h3 className="text-2xl font-[1000] tracking-tight text-slate-900">Create a new {languageLabel} mind map?</h3>
              <p className="text-[14px] leading-relaxed text-slate-600">
                This will create a fresh mind map and replace the current version for the selected language.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsMindMapRefreshConfirmOpen(false)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-500"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="mt-8 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsMindMapRefreshConfirmOpen(false)}
              className="rounded-2xl border border-slate-200 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setIsMindMapRefreshConfirmOpen(false);
                void loadDiagram(activeDiagramLanguage, { forceRefresh: true });
              }}
              className="rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.02] active:scale-95"
            >
              Confirm New Mind Map
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* ─── RENDER ─── */
  const filePresentation = useMemo(() => getFilePresentation(documentData || { title: '', fileRef: '' }), [documentData]);
  const canPreview = useMemo(() => {
    const t = contentType.toLowerCase();
    return t.includes('pdf') || t.startsWith('text/') || filePresentation.extension === 'pdf' || filePresentation.extension === 'txt';
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
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                   </div>
                  <h2 className="text-xl font-extrabold text-slate-900 uppercase tracking-tight mb-2">Error Loading Resource</h2>
                  <p className="text-slate-500 font-medium max-w-xs">{error}</p>
                </div>
              ) : canPreview && fileUrl ? (
                <iframe src={`${fileUrl}#toolbar=0`} className="h-full w-full border-0 scrollbar-none shadow-inner" title="Asset Preview" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center p-20 text-center animate-fade-in">
                  <div className={`flex h-20 w-20 items-center justify-center rounded-2xl text-[12px] font-black tracking-[0.2em] shadow-xl mb-10 ${filePresentation.accent.replace('bg-teal-50', 'bg-slate-900').replace('text-teal-700', 'text-white')}`}>
                    {filePresentation.label}
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-4">Preview Not Available</h2>
                  <p className="text-slate-500 font-medium mb-12 max-w-sm mx-auto leading-relaxed">Preview for this file type is not available here. Use the side panel to read the summary or explore the mind map.</p>
                  <div className="flex gap-4 justify-center">
                    <button onClick={() => handleOpenRawFile()} className="rounded-2xl bg-slate-100 py-3.5 px-8 text-[10px] font-black uppercase tracking-wider text-slate-900 hover:bg-slate-200">Open External</button>
                    <button onClick={() => handleDownload(documentId, documentData?.title)} className="rounded-2xl bg-slate-900 py-3.5 px-8 text-[10px] font-black uppercase tracking-wider text-white hover:shadow-xl">Download Asset</button>
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
            style={{ width: sidebarWidth, minWidth: 360, maxWidth: '65%', height: '100%' }}
          >
            {/* Sidebar Header */}
             <div className="shrink-0 px-6 py-4 border-b border-slate-100/60 bg-white/50 backdrop-blur-md">
               <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
                      <SparklesIcon className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h2 className="text-[12px] font-[1000] tracking-[0.2em] text-slate-900 leading-none uppercase">AI ASSISTANT</h2>
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
                  {AI_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-[9px] font-black uppercase tracking-[0.15em] transition-all duration-300 ${
                        activeTab === tab.id 
                        ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50' 
                        : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <span className="text-sm">{tab.icon}</span>
                      <span className="hidden xl:inline">{tab.label}</span>
                    </button>
                  ))}
               </div>
            </div>

            {/* AI Content Area */}
            <div
              className={`flex-1 min-h-0 animate-soft-reveal scrollbar-none ${
                activeTab === 'diagram' || activeTab === 'ask'
                  ? 'flex flex-col overflow-hidden px-6 pt-4 pb-0'
                  : 'overflow-y-auto px-6 py-5 pb-24'
              }`}
              key={activeTab}
            >
               {activeTab === 'summary' && renderSummary()}
               {activeTab === 'diagram' && renderDiagram()}
               {activeTab === 'ask' && renderAsk()}
               {activeTab === 'related' && renderRelated()}
            </div>
          </aside>
        )}
      </div>

      {/* ELITE SUMMARY MODAL */}
      {isMindMapModalOpen && renderMindMapModal()}
      {isSummaryModalOpen && renderSummaryModal()}
      {isSummaryRefreshConfirmOpen && renderSummaryRefreshConfirmModal()}
      {isMindMapRefreshConfirmOpen && renderMindMapRefreshConfirmModal()}
    </div>
  );
};

export default DocumentViewer;
