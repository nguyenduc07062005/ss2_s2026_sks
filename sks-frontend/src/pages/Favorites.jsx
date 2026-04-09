import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ActionIconButton,
  formatDateLabel,
  getFilePresentation,
  LoadingState,
} from '../components/workspace/DocumentLibraryPanel.jsx';
import {
  downloadDocumentFile,
  getFavorites,
  toggleFavorite,
} from '../service/documentAPI.js';

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

  if (loading && documents.length === 0) {
    return <LoadingState />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 animate-fade-in">
      {/* Header Section */}
      <div className="mb-12 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="animate-fade-up">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-sks-slate-950 sm:text-6xl">
            Your <span className="text-sks-primary">Favorites</span>
          </h1>
          <p className="mt-4 text-lg text-sks-slate-500">
            A curated list of your most important documents and research assets.
          </p>
        </div>

        <div className="flex items-center gap-4 rounded-3xl bg-white p-5 shadow-sks-soft ring-1 ring-sks-slate-100 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
              <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sks-slate-400">Total Assets</p>
            <p className="text-2xl font-black text-sks-slate-900">{documents.length}</p>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="w-full">
        {error && (
          <div className="mb-8 rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm font-medium text-rose-700 shadow-sm animate-fade-up">
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-rose-600">!</span>
              {error}
            </div>
          </div>
        )}

        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center animate-fade-up" style={{ animationDelay: '0.2s' }}>
            <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-[2.5rem] bg-sks-slate-50 text-sks-slate-200 shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-10 w-10">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-sks-slate-900">Your collection is empty</h2>
            <p className="mt-3 max-w-sm text-lg text-sks-slate-500">
              Star your most important documents from the workspace to see them here.
            </p>
            <button 
              onClick={() => navigate('/app')}
              className="mt-10 sks-button-primary"
            >
              Back to Workspace
            </button>
          </div>
        ) : (
          <div className="grid gap-6">
            {documents.map((doc, index) => {
              const file = getFilePresentation(doc);
              const docFileTypeTone = file.accent.replace('bg-teal-50', 'bg-sks-primary-light').replace('text-teal-700', 'text-sks-primary');
              
              return (
                <article 
                  key={doc.id}
                  className="group flex flex-col gap-6 rounded-[2rem] border border-sks-slate-100 bg-white p-7 transition-all hover:-translate-y-1 hover:border-sks-primary/20 hover:shadow-sks-medium md:flex-row md:items-center animate-fade-up"
                  style={{ animationDelay: `${0.1 + index * 0.05}s` }}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-6">
                    <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-[10px] font-black tracking-widest transition-transform group-hover:scale-110 shadow-sm ${docFileTypeTone}`}>
                      {file.label}
                    </div>

                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => handleOpenDocument(doc.id)}
                        className="truncate text-left text-2xl font-extrabold tracking-tight text-sks-slate-900 transition-colors hover:text-sks-primary"
                      >
                        {doc.title || 'Untitled Knowledge Asset'}
                      </button>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-sks-slate-50 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-sks-slate-400 ring-1 ring-inset ring-sks-slate-100 transition-all group-hover:bg-sks-primary-light group-hover:text-sks-primary group-hover:ring-sks-primary/20">
                          {doc.formattedFileSize || 'Unknown size'}
                        </span>
                        <span className="rounded-full bg-sks-slate-50 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-sks-slate-400 ring-1 ring-inset ring-sks-slate-100 transition-all group-hover:bg-sks-primary-light group-hover:text-sks-primary group-hover:ring-sks-primary/20">
                          Added {formatDateLabel(doc.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 md:pl-6">
                    <button
                      onClick={() => handleOpenDocument(doc.id)}
                      className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sks-slate-200 bg-white text-sks-slate-500 shadow-sks-soft transition-all hover:border-sks-primary/30 hover:bg-sks-primary-light hover:text-sks-primary"
                      title="Open Document"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </button>
                    
                    <button
                      onClick={() => handleDownloadDocument(doc.id, doc.title)}
                      className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sks-slate-200 bg-white text-sks-slate-500 shadow-sks-soft transition-all hover:border-sks-primary/30 hover:bg-sks-primary-light hover:text-sks-primary"
                      title="Download"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75v-2.25M7.5 11.25l4.5 4.5m0 0l4.5-4.5m-4.5 4.5V3" />
                      </svg>
                    </button>

                    <button
                      onClick={() => handleToggleFavorite(doc.id)}
                      className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-500 shadow-sks-soft transition-all hover:scale-110 active:scale-95"
                      title="Remove from Favorites"
                    >
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
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
