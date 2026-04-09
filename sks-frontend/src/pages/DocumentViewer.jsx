import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MermaidPreview from '../components/documents/MermaidPreview.jsx';
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
  getDocumentDiagram,
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
  { id: 'diagram', label: 'Diagram', icon: '📐' },
  { id: 'ask', label: 'Ask AI', icon: '🧠' },
  { id: 'related', label: 'Related', icon: '🔗' },
];

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
  const [diagramState, setDiagramState] = useState({ loading: false, error: '', data: null });
  const [askQuestion, setAskQuestion] = useState('');
  const [askState, setAskState] = useState({ loading: false, error: '', answer: '', sources: [] });

  const chatInputRef = useRef(null);
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
    setDiagramState({ loading: false, error: '', data: null });
    setAskQuestion('');
    setAskState({ loading: false, error: '', answer: '', sources: [] });
  }, [documentId]);

  /* ─── AI Logic ─── */
  const loadSummary = useCallback(async (language = selectedLanguage) => {
    if (!documentId || summaryState.loading) return;
    try {
      setSelectedLanguage(language);
      setSummaryState(s => ({ ...s, loading: true, error: '' }));
      const result = await getDocumentSummary(documentId, language);
      setSummaryState({ 
        loading: false, 
        error: '', 
        data: result
      });
    } catch (err) {
      setSummaryState({ loading: false, error: err.response?.data?.message || 'AI could not summarize this.', data: null });
    }
  }, [documentId, selectedLanguage, summaryState.loading]);

  const loadDiagram = useCallback(async () => {
    if (!documentId || diagramState.loading) return;
    try {
      setDiagramState(s => ({ ...s, loading: true, error: '' }));
      const result = await getDocumentDiagram(documentId);
      setDiagramState({ loading: false, error: '', data: { diagram: result.diagram || '', summary: result.summary || '', cached: Boolean(result.cached) } });
    } catch (err) {
      setDiagramState({ loading: false, error: err.response?.data?.message || 'AI could not map this.', data: null });
    }
  }, [documentId, diagramState.loading]);

  useEffect(() => {
    if (!documentId || !documentData) return;
    if (activeTab === 'diagram' && !diagramState.data && !diagramState.loading) void loadDiagram();
  }, [activeTab, diagramState.data, diagramState.loading, documentData, documentId, loadDiagram]);

  /* ─── Actions ─── */
  const handleToggleFavorite = async (id) => {
    try {
      await toggleFavorite(id);
      setDocumentData(c => c && c.id === id ? { ...c, isFavorite: !c.isFavorite } : c);
    } catch (err) { console.error('Favorite toggle failed:', err); }
  };

  const handleOpenRawFile = async () => {
    if (!documentId) return;
    try { await openDocumentFile(documentId); } catch (err) { console.error('Open fail:', err); }
  };

  const handleDownload = async (id, title) => {
    try { await downloadDocumentFile(id, title); } catch (err) { console.error('Download fail:', err); }
  };

  const handleAsk = async () => {
    if (!documentId || !askQuestion.trim() || askState.loading) return;
    try {
      setAskState(s => ({ ...s, loading: true, error: '' }));
      const result = await askDocument(documentId, askQuestion.trim());
      setAskState({ loading: false, error: '', answer: result.answer || '', sources: result.sources || [] });
    } catch {
      setAskState(s => ({ ...s, loading: false, error: 'AI consultation failed.' }));
    }
  };

  const handleAskKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleAsk(); }
  };

  /* ─── Tab Components ─── */
  const renderSummary = () => {
    if (!summaryState.loading && !summaryState.data && !summaryState.error) return (
      <div className="flex flex-col items-center justify-center py-10 text-center animate-fade-in">
        <div className="relative mb-10">
           <div className="absolute -inset-6 rounded-full bg-indigo-50/50 animate-pulse" />
           <div className="relative flex h-20 w-20 items-center justify-center rounded-[24px] bg-black text-white text-3xl shadow-xl">✨</div>
        </div>
        
        <h3 className="text-[14px] font-black text-slate-900 uppercase tracking-widest mb-3">Asset Intelligence</h3>
        <p className="text-[12px] font-medium text-slate-400 max-w-[240px] leading-relaxed mb-10">Select a target language to synthesize wisdom from this asset.</p>
        
        <div className="mb-8 flex p-1.5 rounded-2xl bg-slate-100 ring-1 ring-inset ring-slate-200/20 w-full max-w-[240px]">
          <button 
            onClick={() => setSelectedLanguage('vi')}
            className={`flex-1 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all ${selectedLanguage === 'vi' ? 'bg-white text-black shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Tiếng Việt
          </button>
          <button 
            onClick={() => setSelectedLanguage('en')}
            className={`flex-1 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all ${selectedLanguage === 'en' ? 'bg-white text-black shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            English
          </button>
        </div>

        <button 
          onClick={() => void loadSummary()}
          className="group relative flex h-14 w-full items-center justify-center gap-4 overflow-hidden rounded-2xl bg-black px-8 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-2xl transition-all hover:scale-[1.02] active:scale-95"
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

    const handleResetSummary = () => {
      setSummaryState({ loading: false, error: '', data: null });
    };

    return (
      <div className="space-y-10 animate-soft-reveal">
        <div className="flex items-center justify-between border-b border-slate-100 pb-6">
          <div className="flex items-center gap-3">
             <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 text-sm shadow-sm ring-1 ring-indigo-100/50">✦</div>
             <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Synthesis Report</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => void loadSummary('vi')}
                className={`rounded-lg px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${activeSummaryLanguage === 'vi' ? 'bg-white text-black shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}
              >
                VI
              </button>
              <button
                type="button"
                onClick={() => void loadSummary('en')}
                className={`rounded-lg px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${activeSummaryLanguage === 'en' ? 'bg-white text-black shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}
              >
                EN
              </button>
            </div>
            <button 
              onClick={handleResetSummary}
              className="group flex h-9 px-4 items-center gap-2 rounded-xl text-slate-400 transition-all hover:bg-slate-50 hover:text-black"
              title="Re-analyze"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.451a.75.75 0 0 0 0-1.5H4.25a.75.75 0 0 0-.75.75v4a.75.75 0 0 0 1.5 0v-2.62l.515.515a7 7 0 0 0 12.007-4.904.75.75 0 0 0-1.5 0ZM4.688 8.576a5.5 5.5 0 0 1 9.201-2.466l.312.311h-2.451a.75.75 0 0 0 0 1.5H15.75a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 0-1.5 0v2.62l-.515-.515a7 7 0 0 0-12.007 4.904.75.75 0 0 0 1.5 0Z" clipRule="evenodd" />
              </svg>
              <span className="text-[9px] font-black uppercase tracking-widest">Retry</span>
            </button>
            <button 
              onClick={() => setIsSummaryModalOpen(true)}
              className="group flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-black hover:text-white shadow-sm"
              title="Focus Mode"
            >
              <ExpandIcon />
            </button>
          </div>
        </div>

        <div className="space-y-8">
          <h2 className="text-3xl font-black tracking-tight text-slate-900 leading-[1.15]">
            {title}
          </h2>
          
          <div className="space-y-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Contextual Overview</p>
            <p className="text-[16px] leading-relaxed font-medium text-slate-600">
              {overview}
            </p>
          </div>

          <div className="space-y-5">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Key Insights</p>
            <div className="space-y-4">
              {key_points?.map((point, i) => (
                <div key={i} className="flex gap-5 group">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500 transition-transform group-hover:scale-150" />
                  <p className="text-[15px] leading-relaxed font-semibold text-slate-800">{point}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-8 text-white shadow-2xl border border-white/5">
            <div className="absolute top-0 right-0 p-6 opacity-20"><SparklesIcon className="text-cyan-400" /></div>
            <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-cyan-500/10 blur-3xl" />
            <p className="relative z-10 text-[10px] font-black text-cyan-400 uppercase tracking-[0.4em] mb-4">Core Takeaway</p>
            <p className="relative z-10 text-xl font-bold leading-relaxed italic text-slate-50 tracking-tight">
              "{conclusion}"
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderDiagram = () => {
    if (diagramState.loading) return <Skeleton className="h-64 w-full" />;
    if (diagramState.error) return <InlineAlert tone="error">{diagramState.error}</InlineAlert>;
    if (!diagramState.data) return null;
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-sks-slate-400">Conceptual Map</span>
          <span className="rounded-full bg-sks-primary-light px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-sks-primary">Vibrant</span>
        </div>
        <MermaidPreview chart={diagramState.data.diagram} />
        {diagramState.data.summary && (
          <div className="rounded-2xl border border-sks-slate-50 bg-sks-slate-50/50 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sks-slate-400 mb-3">Contextual Basis</p>
            <p className="text-[13px] leading-relaxed text-sks-slate-600 italic font-medium">{diagramState.data.summary}</p>
          </div>
        )}
      </div>
    );
  };

  const renderAsk = () => (
    <div className="flex flex-col h-full gap-8">
      <div className="flex-1 space-y-12 min-h-0">
        {askState.answer && (
          <div className="space-y-6 animate-soft-reveal">
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-[2rem] rounded-tr-none bg-gradient-to-br from-slate-900 to-slate-950 px-6 py-3 text-[14px] font-bold leading-relaxed text-white shadow-xl shadow-slate-900/10">
                {askQuestion}
              </div>
            </div>
            
            <div className="flex justify-start">
              <div className="max-w-full space-y-3">
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-slate-950 text-[7px] font-black text-white shadow-sm">AI</div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-900">Knowledge Synthesis</span>
                </div>
                <div className="pl-3">
                  <p className="whitespace-pre-wrap text-[15px] leading-[1.75] text-slate-700 font-medium tracking-tight">
                    {askState.answer}
                  </p>
                </div>
                
                {askState.sources?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pl-3 pt-0.5">
                    {askState.sources.map((s, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[8px] font-black text-indigo-500 bg-indigo-50/10 px-2.5 py-0.5 rounded-md uppercase tracking-wider border border-indigo-100/30">
                        SOURCE {i+1} · P. {s.pageNumber || '—'}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 pt-4 bg-white/40 backdrop-blur-md">
        <div className="relative group">
          <textarea
            ref={chatInputRef}
            value={askQuestion}
            onChange={(e) => setAskQuestion(e.target.value)}
            onKeyDown={handleAskKeyDown}
            rows={1}
            placeholder="Consult the neural library..."
            className="w-full resize-none rounded-[2rem] border border-slate-200 bg-slate-50/30 py-5 pl-8 pr-20 text-[14px] font-bold text-slate-900 placeholder:text-slate-300 outline-none transition-all focus:border-cyan-400 focus:bg-white focus:shadow-2xl focus:shadow-cyan-500/5 focus:ring-8 focus:ring-cyan-500/5"
          />
          <button
            type="button"
            onClick={() => void handleAsk()}
            disabled={askState.loading || !askQuestion.trim()}
            className="absolute bottom-2.5 right-2.5 flex h-12 w-12 items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-cyan-600 to-blue-600 text-white shadow-xl shadow-cyan-600/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-20"
          >
            {askState.loading ? (
               <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
               </svg>
            ) : <SendIcon />}
          </button>
        </div>
      </div>
    </div>
  );

  const renderRelated = () => (
    <div className="space-y-3">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sks-slate-400 px-1 mb-4">Semantic Associations</p>
      {relatedDocuments.length === 0 ? (
        <InlineAlert>No direct associations identified yet.</InlineAlert>
      ) : (
        relatedDocuments.map((d) => <RelatedCard key={d.id} document={d} onOpen={(id) => navigate(`/app/documents/${id}`)} />)
      )}
    </div>
  );

  const renderSummaryModal = () => {
    if (!summaryState.data) return null;
    const { title, overview, key_points, conclusion } = summaryState.data;

    return (
      <div className="fixed inset-0 z-[150] flex items-start justify-center bg-slate-950/40 px-6 py-24 backdrop-blur-md">
        {/* Centered Modal Container */}
        <div className="relative flex flex-col w-full max-w-5xl max-h-full rounded-[40px] border border-white/60 bg-white shadow-[0_45px_120px_-20px_rgba(15,23,42,0.35)] overflow-hidden animate-soft-reveal">
          
          {/* Elite Glass Header */}
          <div className="flex h-20 shrink-0 items-center justify-between border-b border-slate-100/50 px-10 bg-white/70 backdrop-blur-xl">
            <div className="flex items-center gap-6">
              <button 
                onClick={() => setIsSummaryModalOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-all hover:bg-slate-900 hover:text-white"
                title="Back to Workspace"
              >
                <ArrowLeftIcon />
              </button>
              <h2 className="text-[11px] font-[1000] uppercase tracking-[0.3em] text-slate-900">Summary</h2>
            </div>
            <button 
               onClick={() => setIsSummaryModalOpen(false)}
               className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-300 hover:bg-rose-50 hover:text-rose-600 transition-all"
            >
               <CloseIcon />
            </button>
          </div>

          {/* Content Area (Scrollable) */}
          <div className="flex-1 overflow-y-auto px-8 py-10 scrollbar-none">
            <div className="space-y-12 animate-fade-up">
              <header className="space-y-4">
                <h1 className="text-3xl md:text-5xl font-black text-slate-900 leading-tight tracking-tight">
                  {title}
                </h1>
                <div className="h-1.5 w-16 bg-black rounded-full" />
              </header>

              <section className="space-y-4">
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Contextual Overview</p>
                <p className="text-[18px] leading-relaxed font-medium text-slate-600">
                  {overview}
                </p>
              </section>

              <section className="space-y-6">
                <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">Key Insights</p>
                <div className="grid grid-cols-1 gap-6">
                  {key_points?.map((point, i) => (
                    <div key={i} className="flex gap-4 items-start">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-[9px] font-black text-white">
                        {i + 1}
                      </span>
                      <p className="text-[16px] font-bold text-slate-800 leading-snug">
                        {point}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[2rem] bg-slate-950 p-10 text-white shadow-xl">
                <p className="text-[8px] font-black uppercase tracking-[0.4em] text-slate-500 mb-4">Strategic Takeaway</p>
                <p className="text-xl md:text-2xl font-bold italic leading-relaxed text-slate-100">
                  "{conclusion}"
                </p>
              </section>
            </div>
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
    <div className="flex flex-col overflow-hidden bg-white" style={{ height: 'calc(100vh - 80px)' }}>
      {/* ELITE MINIMALIST TOOLBAR */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-8">
        <div className="flex items-center gap-6 min-w-0">
          <button
            onClick={() => navigate('/app')}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-all hover:border-cyan-500 hover:text-cyan-600 hover:shadow-lg hover:shadow-cyan-500/10 active:scale-95"
          >
            <ArrowLeftIcon />
          </button>
          <div className="flex items-center gap-4 min-w-0">
            <h1 className="truncate font-display text-lg font-extrabold tracking-tight text-slate-900">
              {documentData?.title || 'Knowledge Asset'}
            </h1>
            <div className="hidden h-4 w-px bg-slate-200 sm:block" />
            <div className="hidden items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 sm:flex">
                {documentData?.folderName || 'General Workspace'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 sm:mr-2">
             <button 
              onClick={() => handleOpenRawFile()} 
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-900 transition-all"
              title="Open External"
             >
                <ExternalLinkIcon />
             </button>
             <button 
              onClick={() => handleDownload(documentId, documentData?.title)} 
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-900 transition-all"
              title="Download"
             >
                <DownloadIcon />
             </button>
             <button
                onClick={() => handleToggleFavorite(documentData?.id)}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                  documentData?.isFavorite 
                  ? 'bg-amber-50 text-amber-500' 
                  : 'text-slate-300 hover:bg-slate-50 hover:text-amber-500'
                }`}
                title="Favorite"
              >
                <StarIcon filled={documentData?.isFavorite} />
              </button>
          </div>
          
          <div className="h-8 w-px bg-slate-200 mx-2" />
          
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className={`group flex h-10 items-center gap-3 rounded-xl px-5 text-[11px] font-[1000] uppercase tracking-[0.2em] transition-all shadow-sm ${
              sidebarOpen 
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-cyan-600/20' 
              : 'border border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:text-cyan-700'
            }`}
          >
            <SparklesIcon className={sidebarOpen ? 'animate-pulse' : ''} />
            <span>Intelligence</span>
          </button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        {/* ELITE PREVIEW CANVAS */}
        <main className="relative flex-1 min-w-0 overflow-hidden bg-slate-50" style={{ height: 'calc(100vh - 144px)' }}>
           <div className="h-full w-full overflow-y-auto scrollbar-none sks-bg-dots">
             <div className="min-h-full w-full bg-white overflow-hidden">
              {loading ? (
                <div className="flex h-96 items-center justify-center">
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
                <iframe src={fileUrl} className="h-screen min-h-full w-full border-0" title="Asset Preview" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center p-20 text-center animate-fade-in">
                  <div className={`flex h-20 w-20 items-center justify-center rounded-2xl text-[12px] font-black tracking-[0.2em] shadow-xl mb-10 ${filePresentation.accent.replace('bg-teal-50', 'bg-slate-900').replace('text-teal-700', 'text-white')}`}>
                    {filePresentation.label}
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-4">Neural Extraction Only</h2>
                  <p className="text-slate-500 font-medium mb-12 max-w-sm mx-auto leading-relaxed">Previewing this asset format directly is not supported. Use the Intelligence Rail for summary and analysis.</p>
                  <div className="flex gap-4 justify-center">
                    <button onClick={() => handleOpenRawFile()} className="sks-button-secondary py-3.5 px-8 text-[11px] font-[1000] uppercase tracking-wider">Open External</button>
                    <button onClick={() => handleDownload(documentId, documentData?.title)} className="sks-button-primary py-3.5 px-8 text-[11px] font-[1000] uppercase tracking-wider bg-gradient-to-r from-slate-900 to-slate-950">Download Asset</button>
                  </div>
                </div>
              )}
             </div>
           </div>
        </main>

        {/* RESIZER */}
        {sidebarOpen && (
          <div 
            onMouseDown={handleMouseDown} 
            className="w-px shrink-0 cursor-col-resize bg-slate-200 hover:bg-black transition-colors relative"
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>
        )}

        {/* SIDEBAR INTELLIGENCE */}
        {sidebarOpen && (
          <aside 
            className="shrink-0 flex flex-col overflow-hidden bg-white border-l border-slate-200 animate-fade-in" 
            style={{ width: sidebarWidth, minWidth: 360, maxWidth: '65%', height: '100%' }}
          >
            {/* Sidebar Header */}
            <div className="shrink-0 px-6 py-4 border-b border-slate-100">
               <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-600/20">
                      <SparklesIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-black tracking-widest text-slate-900 leading-none uppercase">Intelligence</h2>
                      <p className="hidden mt-1 text-[8px] font-black uppercase tracking-widest text-slate-400">Synthesis Hub</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSidebarOpen(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-slate-300 hover:bg-slate-50 hover:text-slate-900 transition-all"
                  >
                    <CloseIcon />
                  </button>
               </div>

               {/* Segmented Control Tabs */}
               <div className="flex p-1.5 rounded-2xl bg-slate-100/80 ring-1 ring-inset ring-slate-200/20">
                  {AI_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-[9px] font-[1000] uppercase tracking-widest transition-all duration-300 ${
                        activeTab === tab.id 
                        ? 'bg-white text-cyan-700 shadow-sm ring-1 ring-cyan-100' 
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
            <div className="flex-1 overflow-y-auto px-6 py-5 pb-24 animate-soft-reveal" key={activeTab}>
               {activeTab === 'summary' && renderSummary()}
               {activeTab === 'diagram' && renderDiagram()}
               {activeTab === 'ask' && renderAsk()}
               {activeTab === 'related' && renderRelated()}
            </div>
          </aside>
        )}
      </div>

      {/* ELITE SUMMARY MODAL */}
      {isSummaryModalOpen && renderSummaryModal()}
    </div>
  );
};

export default DocumentViewer;
