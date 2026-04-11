import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  downloadDocumentFile,
  getFavorites,
  toggleFavorite,
} from '../service/documentAPI.js';
import {
  formatDateLabel,
  getDocumentType,
} from './dashboardUtils.js';

const StarIcon = ({ className = 'h-5 w-5', filled = false }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={filled ? undefined : '1.7'}
    className={className}
  >
    <path d="M10 2.75 12.163 7.133l4.836.703-3.5 3.412.826 4.817L10 13.79l-4.325 2.275.826-4.817-3.5-3.412 4.836-.703L10 2.75Z" />
  </svg>
);

const OpenIcon = ({ className = 'h-5 w-5' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path d="M5.5 4A2.5 2.5 0 0 0 3 6.5v7A2.5 2.5 0 0 0 5.5 16h4.379a.75.75 0 0 0 0-1.5H5.5A1 1 0 0 1 4.5 13.5v-7a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v4.379a.75.75 0 0 0 1.5 0V6.5A2.5 2.5 0 0 0 12.5 4h-7Z" />
    <path d="M11.75 10a.75.75 0 0 0 0 1.5h2.69l-5.72 5.72a.75.75 0 1 0 1.06 1.06l5.72-5.72v2.69a.75.75 0 0 0 1.5 0V10.75A.75.75 0 0 0 16.25 10h-4.5Z" />
  </svg>
);

const DownloadIcon = ({ className = 'h-5 w-5' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v7.19L7.03 7.72a.75.75 0 0 0-1.06 1.06l3.5 3.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 1 0-1.06-1.06l-2.22 2.22V2.75Z" />
    <path d="M3.5 13.25a.75.75 0 0 0-1.5 0v1A2.75 2.75 0 0 0 4.75 17h10.5A2.75 2.75 0 0 0 18 14.25v-1a.75.75 0 0 0-1.5 0v1c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-1Z" />
  </svg>
);

const Favorites = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadFavorites = async () => {
    try {
      setLoading(true);
      const result = await getFavorites();
      setDocuments(result.favorites || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load favorites.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFavorites();
  }, []);

  const handleOpenDocument = (documentId) => {
    navigate(`/app/documents/${documentId}`);
  };

  const handleDownloadDocument = async (documentId, title) => {
    try {
      await downloadDocumentFile(documentId, title);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleToggleFavorite = async (documentId) => {
    try {
      await toggleFavorite(documentId);
      setDocuments((curr) => curr.filter((doc) => doc.id !== documentId));
    } catch {
      setError('Update failed.');
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] animate-fade-in pb-12">
      {/* ═══ PREMIUM HERO HEADER ═══ */}
      <div className="relative mb-12 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-8 py-10 shadow-2xl">
        {/* Mesh glow accents */}
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-cyan-400 font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>
                Curated Collection
              </span>
            </div>
            <h1 className="text-4xl font-[1000] tracking-tight text-white sm:text-6xl">
              Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400">Favorites</span>
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 shadow-lg shadow-cyan-500/10">
              <StarIcon className="h-6 w-6" filled />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Priority Assets</p>
              <p className="text-2xl font-black text-white leading-none mt-1">{documents.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ CONTENT SECTION ═══ */}
      <div className="space-y-8">
        {error && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 px-6 py-4 text-sm font-bold text-rose-400 backdrop-blur-md animate-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/20 text-rose-400">!</span>
              {error}
            </div>
          </div>
        )}

        {loading && documents.length === 0 ? (
          <div className="grid gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-32 w-full animate-pulse rounded-[2rem] bg-slate-900/5"></div>
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="relative mb-8">
              <div className="absolute inset-0 animate-pulse rounded-full bg-cyan-500/10 blur-2xl"></div>
              <div className="relative flex h-24 w-24 items-center justify-center rounded-[2.5rem] border border-white bg-white/50 shadow-xl backdrop-blur-md">
                <StarIcon className="h-10 w-10 text-slate-300" />
              </div>
            </div>
            <h2 className="text-3xl font-[1000] tracking-tight text-slate-900">Priority Index Empty</h2>
            <p className="mt-4 max-w-sm text-lg font-medium text-slate-500">
              Mark critical knowledge assets as favorites in the Workspace to populate this priority view.
            </p>
            <button 
              onClick={() => navigate('/app')}
              className="mt-10 group relative overflow-hidden rounded-2xl bg-slate-900 px-8 py-4 text-sm font-black uppercase tracking-widest text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 to-blue-600 opacity-0 transition-opacity group-hover:opacity-100"></div>
              <span className="relative">Back to Workspace</span>
            </button>
          </div>
        ) : (
          <div className="grid gap-5">
            {documents.map((doc, index) => {
              const fileType = getDocumentType(doc);
              const finalFileTypeTone = fileType.tone.replace('bg-teal-50', 'bg-gradient-to-br from-cyan-500 to-blue-500 shadow border-transparent').replace('text-teal-700', 'text-white');
              
              return (
                <article 
                  key={doc.id}
                  className="group relative flex flex-col gap-6 rounded-[2rem] border border-slate-100 bg-white/40 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-2xl md:flex-row md:items-center animate-in fade-in slide-in-from-bottom-4"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-600 opacity-0 transition-opacity group-hover:opacity-100 rounded-b-[2rem]"></div>
                  
                  <div className="flex min-w-0 flex-1 items-center gap-6">
                    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 text-[10px] font-black tracking-widest transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6 ${finalFileTypeTone}`}>
                      {fileType.label}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 
                          role="button"
                          onClick={() => handleOpenDocument(doc.id)}
                          className="truncate text-xl font-[1000] tracking-tight text-slate-900 transition-colors hover:text-cyan-600 cursor-pointer"
                        >
                          {doc.title || 'Untitled Asset'}
                        </h3>
                        <div className="h-1.5 w-1.5 rounded-full bg-cyan-400"></div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                          {doc.formattedFileSize || '-'}
                        </span>
                        <span className="h-1 w-1 rounded-full bg-slate-200"></span>
                        <span className="text-[11px] font-bold text-slate-400">
                          Indexed on {formatDateLabel(doc.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 md:border-l md:border-slate-100 md:pl-6">
                    <button
                      onClick={() => handleOpenDocument(doc.id)}
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-all hover:bg-cyan-50 hover:text-cyan-600 active:scale-90"
                      title="Read Document"
                    >
                      <OpenIcon />
                    </button>
                    <button
                      onClick={() => handleDownloadDocument(doc.id, doc.title)}
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-all hover:bg-blue-50 hover:text-blue-600 active:scale-90"
                      title="Download"
                    >
                      <DownloadIcon />
                    </button>
                    <button
                      onClick={() => handleToggleFavorite(doc.id)}
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-400 border border-amber-100 transition-all hover:bg-rose-50 hover:border-rose-100 hover:text-rose-400 hover:scale-110 active:scale-90"
                      title="Remove from Index"
                    >
                      <StarIcon filled />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Favorites;
