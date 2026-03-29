import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BrandBadge from '../components/BrandBadge.jsx';
import { useDocumentsContext } from '../components/DocumentsContext.jsx';
import UploadModal from '../components/documents/UploadModal.jsx';
import FoldersPanel from '../components/folders/FoldersPanel.jsx';
import {
  deleteDocument,
  getDocumentFile,
  toggleFavorite,
  searchDocuments,
  updateDocumentName,
  uploadDocument,
} from '../service/documentAPI.js';
import {
  addDocumentToFolder,
  removeDocumentFromFolder,
} from '../service/folderAPI.js';
import { clearToken } from '../utils/auth.js';

const FILE_ACCENTS = {
  pdf: 'bg-rose-100 text-rose-700',
  doc: 'bg-sky-100 text-sky-700',
  docx: 'bg-sky-100 text-sky-700',
  txt: 'bg-slate-200 text-slate-700',
  xls: 'bg-emerald-100 text-emerald-700',
  xlsx: 'bg-emerald-100 text-emerald-700',
  ppt: 'bg-amber-100 text-amber-700',
  pptx: 'bg-amber-100 text-amber-700',
};

const ActionIconButton = ({
  label,
  onClick,
  children,
  tone = 'default',
  disabled = false,
}) => {
  const tones = {
    default:
      'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900',
    favorite:
      'border-amber-200 bg-amber-50 text-amber-600 hover:border-amber-300 hover:bg-amber-100',
    danger:
      'border-rose-200 bg-white text-rose-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700',
  };

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]}`}
    >
      {children}
    </button>
  );
};

const StatusIcon = ({ status }) => {
  if (status === 'processed') {
    return (
      <span
        title="Processed"
        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
          <path fillRule="evenodd" d="M16.704 5.29a.75.75 0 0 1 .006 1.06l-7.25 7.333a.75.75 0 0 1-1.076.008L4.3 9.607a.75.75 0 0 1 1.06-1.06l3.55 3.548 6.72-6.799a.75.75 0 0 1 1.06-.006Z" clipRule="evenodd" />
        </svg>
      </span>
    );
  }

  if (status === 'pending') {
    return (
      <span
        title="Pending"
        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
          <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.5a.75.75 0 0 0-1.5 0V10c0 .199.079.39.22.53l2.25 2.25a.75.75 0 0 0 1.06-1.06l-2.03-2.03V6.5Z" clipRule="evenodd" />
        </svg>
      </span>
    );
  }

  return (
    <span
      title={status || 'Unknown'}
      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path fillRule="evenodd" d="M18 10A8 8 0 1 1 2 10a8 8 0 0 1 16 0Zm-8.75 3.25a.75.75 0 0 0 1.5 0v-1.5a.75.75 0 0 0-1.5 0v1.5Zm.75-8.5a.875.875 0 1 0 0 1.75.875.875 0 0 0 0-1.75Z" clipRule="evenodd" />
      </svg>
    </span>
  );
};

const ModalShell = ({ title, children, onClose }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm"
    onClick={onClose}
  >
    <div
      className="w-full max-w-lg rounded-[32px] bg-white p-8 shadow-[0_40px_120px_rgba(15,23,42,0.18)]"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-3xl font-bold text-slate-950">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-500 transition hover:bg-slate-200"
        >
          Close
        </button>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  </div>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const {
    currentPage,
    documents,
    documentsLoading,
    error: contextError,
    folderOptions,
    goToPage,
    refreshDocuments,
    refreshFolders,
    rootFolder,
    selectedFolder,
    selectedFolderId,
    total,
    totalPages,
  } = useDocumentsContext();
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameDoc, setRenameDoc] = useState(null);
  const [newDocName, setNewDocName] = useState('');
  const [renameError, setRenameError] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteDoc, setDeleteDoc] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveDoc, setMoveDoc] = useState(null);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState('');
  const [moveError, setMoveError] = useState('');
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (contextError) {
      setError(contextError);
    }
  }, [contextError]);

  const runSearch = useCallback(async (keyword) => {
    const trimmedKeyword = keyword.trim();

    if (!trimmedKeyword) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    try {
      setIsSearching(true);
      const result = await searchDocuments(trimmedKeyword, 12);
      const merged = [
        ...(result.relatedTitleDocuments || []),
        ...(result.relatedContentDocuments || []),
      ];
      const deduped = merged.filter(
        (document, index, array) =>
          array.findIndex((item) => item.id === document.id) === index,
      );
      setSearchResults(deduped);
      setError('');
    } catch (err) {
      setSearchResults([]);
      setError(err.response?.data?.message || 'Failed to search documents.');
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const keyword = searchText.trim();

    if (!keyword) {
      setSearchResults([]);
      setIsSearching(false);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      void runSearch(keyword);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [runSearch, searchText]);

  const handleUpload = async (file, title, folderId) => {
    await uploadDocument(file, title, folderId || selectedFolderId || rootFolder?.id);
    await refreshFolders(selectedFolderId || rootFolder?.id);
    await refreshDocuments(1);
  };

  const handleToggleFavorite = async (docId) => {
    try {
      await toggleFavorite(docId);
      if (searchText.trim()) {
        setSearchResults((prev) =>
          prev.map((doc) =>
            doc.id === docId ? { ...doc, isFavorite: !doc.isFavorite } : doc,
          ),
        );
      } else {
        await refreshDocuments(currentPage);
      }
    } catch (err) {
      setError(
        err.response?.data?.message || 'Failed to update favorite status.',
      );
    }
  };

  const handleRenameClick = (doc) => {
    setRenameDoc(doc);
    setNewDocName(doc.title || '');
    setRenameError('');
    setShowRenameModal(true);
  };

  const handleRenameConfirm = async () => {
    if (!renameDoc || !newDocName.trim()) {
      setRenameError('Please enter a valid document name.');
      return;
    }

    try {
      setRenaming(true);
      setRenameError('');
      await updateDocumentName(renameDoc.id, newDocName.trim());
      setShowRenameModal(false);
      setRenameDoc(null);
      setNewDocName('');
      if (searchText.trim()) {
        await runSearch(searchText.trim());
      } else {
        await refreshDocuments(currentPage);
      }
    } catch (err) {
      setRenameError(err.response?.data?.message || 'Failed to rename document.');
    } finally {
      setRenaming(false);
    }
  };

  const handleDeleteClick = (doc) => {
    setDeleteDoc(doc);
    setDeleteError('');
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDoc) {
      return;
    }

    try {
      setDeleting(true);
      setDeleteError('');
      await deleteDocument(deleteDoc.id);
      setShowDeleteModal(false);
      setDeleteDoc(null);
      if (searchText.trim()) {
        await runSearch(searchText.trim());
      } else {
        const nextPage =
          documents.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
        await refreshDocuments(nextPage);
      }
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Failed to delete document.');
    } finally {
      setDeleting(false);
    }
  };

  const handleMoveClick = (doc) => {
    setMoveDoc(doc);
    setMoveTargetFolderId(rootFolder?.id || '');
    setMoveError('');
    setShowMoveModal(true);
  };

  const handleMoveConfirm = async () => {
    if (!moveDoc || !selectedFolderId || !rootFolder?.id) {
      return;
    }

    if (!moveTargetFolderId) {
      setMoveError('Please choose a destination folder.');
      return;
    }

    if (moveTargetFolderId === selectedFolderId) {
      setMoveError('Document is already inside this folder.');
      return;
    }

    try {
      setMoving(true);
      setMoveError('');

      if (moveTargetFolderId === rootFolder.id) {
        await removeDocumentFromFolder(selectedFolderId, moveDoc.id);
      } else {
        await addDocumentToFolder(moveTargetFolderId, moveDoc.id);
      }

      setShowMoveModal(false);
      setMoveDoc(null);
      setMoveTargetFolderId('');
      await refreshFolders(selectedFolderId);
      await refreshDocuments(currentPage);
    } catch (err) {
      setMoveError(err.response?.data?.message || 'Failed to move document.');
    } finally {
      setMoving(false);
    }
  };

  const handlePageChange = async (page) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      await goToPage(page);
    }
  };

  const handleLogout = () => {
    clearToken();
    navigate('/login', { replace: true });
  };

  const handleViewDocument = (documentId) => {
    window.open(getDocumentFile(documentId), '_blank', 'noopener,noreferrer');
  };

  const handleDownloadDocument = (documentId, title) => {
    const link = document.createElement('a');
    link.href = getDocumentFile(documentId);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    if (title) {
      link.download = title;
    }
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const getFileExtension = (doc) => {
    const source = doc?.title || doc?.fileRef || '';
    const parts = source.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : 'file';
  };

  const getFilePresentation = (doc) => {
    const extension = getFileExtension(doc);
    return {
      label: extension === 'file' ? 'FILE' : extension.slice(0, 4).toUpperCase(),
      accent: FILE_ACCENTS[extension] || 'bg-slate-200 text-slate-700',
    };
  };

  const displayedDocuments = useMemo(
    () => (searchText.trim() ? searchResults : documents),
    [documents, searchResults, searchText],
  );

  const selectedFolderLabel = useMemo(() => {
    if (!selectedFolder) {
      return 'Workspace';
    }

    return selectedFolder.id === rootFolder?.id ? 'Root' : selectedFolder.name;
  }, [rootFolder?.id, selectedFolder]);

  const folderChoices = useMemo(
    () =>
      folderOptions.map((folder) => ({
        ...folder,
        label:
          folder.depth === 0
            ? 'Root'
            : `${'\u00A0'.repeat(folder.depth * 4)}${folder.name}`,
      })),
    [folderOptions],
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#effdf9_0%,#f8fbff_34%,#eef4fb_100%)]">
      <header className="sticky top-0 z-40 border-b border-white/80 bg-white/92 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-3 text-left transition hover:opacity-80"
            >
              <BrandBadge className="h-14 w-44 sm:h-16 sm:w-52" />
            </button>

            <div className="flex flex-1 items-center gap-3 lg:max-w-2xl">
              <div className="relative flex-1">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400">
                  <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
                </svg>
                <input
                  type="text"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search documents"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-12 pr-4 text-base text-slate-700 outline-none transition focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-100"
                />
              </div>
              <button
                onClick={handleLogout}
                className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                Logout
              </button>
            </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:px-8">
        <FoldersPanel />

        <div className="space-y-5">
          <section className="overflow-hidden rounded-[32px] border border-white/80 bg-white/92 shadow-[0_28px_90px_rgba(15,23,42,0.08)]">
            <div className="flex flex-col gap-5 px-6 py-6 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-teal-700">
                  {searchText.trim() ? 'Global search' : 'Current location'}
                </p>
                <h1 className="mt-3 truncate text-3xl font-bold text-slate-950 sm:text-4xl">
                  {searchText.trim()
                    ? 'Search across all documents'
                    : selectedFolderLabel}
                </h1>
                <div className="mt-4 flex flex-wrap gap-3">
                  <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">
                    {searchText.trim()
                      ? `${displayedDocuments.length} results`
                      : `${total} files`}
                  </span>
                  <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">
                    {searchText.trim()
                      ? 'Title + content search'
                      : `Folder view${selectedFolder?.id === rootFolder?.id ? ' / includes root files' : ''}`}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden rounded-[26px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500 sm:block">
                  Uploads default to the current folder.
                </div>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="rounded-[24px] bg-teal-600 px-5 py-4 text-sm font-bold text-white shadow-lg shadow-teal-500/30 transition hover:bg-teal-500"
                >
                  Upload document
                </button>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-[36px] border border-white/80 bg-white/92 shadow-[0_28px_90px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-teal-500" />
              <h2 className="text-2xl font-bold text-slate-950 sm:text-3xl">
                Documents
              </h2>
            </div>
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600">
              {searchText.trim() ? 'Search results' : selectedFolderLabel}
            </span>
          </div>

          {error && (
            <div className="mx-6 mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 lg:mx-8">
              {error}
            </div>
          )}

          {documentsLoading || isSearching ? (
            <div className="flex items-center justify-center py-24">
              <svg className="h-10 w-10 animate-spin text-teal-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : displayedDocuments.length === 0 ? (
            <div className="px-6 py-24 text-center lg:px-8">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[28px] bg-slate-100 text-sm font-extrabold tracking-[0.3em] text-slate-500">
                DOCS
              </div>
              <p className="mt-6 text-lg font-semibold text-slate-700">
                {searchText.trim()
                  ? 'No matching documents'
                  : 'This folder has no documents yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-4 px-6 py-6 lg:px-8">
              {displayedDocuments.map((doc) => {
                const file = getFilePresentation(doc);

                return (
                  <article
                    key={doc.id}
                    className="grid gap-4 rounded-[28px] border border-slate-200 bg-slate-50/70 p-5 transition hover:border-teal-200 hover:bg-white hover:shadow-[0_18px_40px_rgba(15,23,42,0.06)] lg:grid-cols-[auto,1fr,auto]"
                  >
                    <div className={`flex h-16 w-16 items-center justify-center rounded-[22px] text-sm font-extrabold tracking-[0.24em] ${file.accent}`}>
                      {file.label}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <h3 className="truncate text-xl font-bold text-slate-950 sm:text-2xl">
                            {doc.title || 'Untitled document'}
                          </h3>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                            <span>{doc.formattedFileSize || 'Unknown size'}</span>
                            <span className="text-slate-300">/</span>
                            <span>
                              {doc.createdAt
                                ? new Date(doc.createdAt).toLocaleDateString()
                                : 'No date'}
                            </span>
                          </div>
                        </div>

                        <StatusIcon status={doc.status} />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <ActionIconButton
                        label="View document"
                        onClick={() => handleViewDocument(doc.id)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                          <path d="M10 3c4.613 0 8.28 2.99 9.543 6.322a1.75 1.75 0 0 1 0 1.356C18.28 14.01 14.613 17 10 17c-4.613 0-8.28-2.99-9.543-6.322a1.75 1.75 0 0 1 0-1.356C1.72 5.99 5.387 3 10 3Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" />
                        </svg>
                      </ActionIconButton>
                      <ActionIconButton
                        label="Download document"
                        onClick={() => handleDownloadDocument(doc.id, doc.title)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                          <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v7.19L7.03 7.72a.75.75 0 0 0-1.06 1.06l3.5 3.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 1 0-1.06-1.06l-2.22 2.22V2.75Z" />
                          <path d="M3.5 13.25a.75.75 0 0 0-1.5 0v1A2.75 2.75 0 0 0 4.75 17h10.5A2.75 2.75 0 0 0 18 14.25v-1a.75.75 0 0 0-1.5 0v1c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-1Z" />
                        </svg>
                      </ActionIconButton>
                      <ActionIconButton
                        label={doc.isFavorite ? 'Remove favorite' : 'Add favorite'}
                        onClick={() => handleToggleFavorite(doc.id)}
                        tone={doc.isFavorite ? 'favorite' : 'default'}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill={doc.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m9.049 2.927.951 1.927.951-1.927a1 1 0 0 1 1.793 0l1.28 2.594 2.863.416a1 1 0 0 1 .554 1.706l-2.072 2.02.49 2.852a1 1 0 0 1-1.451 1.054L10 12.347l-2.559 1.346A1 1 0 0 1 6 12.639l.49-2.852-2.072-2.02a1 1 0 0 1 .554-1.706l2.863-.416 1.28-2.594a1 1 0 0 1 1.793 0Z" />
                        </svg>
                      </ActionIconButton>
                      {!searchText.trim() && (
                        <ActionIconButton
                          label="Move document"
                          onClick={() => handleMoveClick(doc)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                            <path fillRule="evenodd" d="M10.25 3a.75.75 0 0 1 .75.75v3.69l1.72-1.72a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06L9.5 7.44V3.75A.75.75 0 0 1 10.25 3ZM4 11.75A2.75 2.75 0 0 1 6.75 9h6.5A2.75 2.75 0 0 1 16 11.75v1.5A2.75 2.75 0 0 1 13.25 16h-6.5A2.75 2.75 0 0 1 4 13.25v-1.5Z" clipRule="evenodd" />
                          </svg>
                        </ActionIconButton>
                      )}
                      <ActionIconButton
                        label="Rename document"
                        onClick={() => handleRenameClick(doc)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                          <path d="m13.879 2.697 3.424 3.424a1.5 1.5 0 0 1 0 2.121l-8.264 8.264a4.5 4.5 0 0 1-1.897 1.11l-2.685.806a.75.75 0 0 1-.93-.93l.806-2.685a4.5 4.5 0 0 1 1.11-1.897l8.264-8.264a1.5 1.5 0 0 1 2.121 0Z" />
                        </svg>
                      </ActionIconButton>
                      <ActionIconButton
                        label="Delete document"
                        onClick={() => handleDeleteClick(doc)}
                        tone="danger"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                          <path fillRule="evenodd" d="M8.75 3a1.75 1.75 0 0 0-1.75 1.75V5H4.75a.75.75 0 0 0 0 1.5h.318l.764 9.167A2.25 2.25 0 0 0 8.074 17.75h3.852a2.25 2.25 0 0 0 2.242-2.083l.764-9.167h.318a.75.75 0 0 0 0-1.5H13V4.75A1.75 1.75 0 0 0 11.25 3h-2.5ZM11.5 5v-.25a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25V5h3Z" clipRule="evenodd" />
                        </svg>
                      </ActionIconButton>
                    </div>
                  </article>
                );
              })}

              {totalPages > 1 && !searchText.trim() && (
                <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                  <p className="text-sm text-slate-500">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage <= 1}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= totalPages}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          </section>
        </div>
      </section>

      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadSuccess={handleUpload}
        folders={folderChoices}
        defaultFolderId={selectedFolderId || rootFolder?.id || ''}
      />

      {showRenameModal && (
        <ModalShell
          title="Rename document"
          onClose={() => setShowRenameModal(false)}
        >
            {renameError && (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {renameError}
              </div>
            )}
            <input
              type="text"
              value={newDocName}
              onChange={(event) => setNewDocName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleRenameConfirm();
                }
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-100"
            />
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowRenameModal(false)}
                disabled={renaming}
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleRenameConfirm()}
                disabled={renaming || !newDocName.trim()}
                className="flex-1 rounded-2xl bg-teal-600 px-4 py-3.5 text-base font-bold text-white transition hover:bg-teal-500 disabled:opacity-60"
              >
                {renaming ? 'Saving...' : 'Save'}
              </button>
            </div>
        </ModalShell>
      )}

      {showDeleteModal && (
        <ModalShell
          title="Delete document"
          onClose={() => setShowDeleteModal(false)}
        >
            <p className="mt-4 text-base leading-7 text-slate-600">
              Remove <strong className="text-slate-900">{deleteDoc?.title || 'this document'}</strong> from your workspace.
            </p>
            {deleteError && (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {deleteError}
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteConfirm()}
                disabled={deleting}
                className="flex-1 rounded-2xl bg-rose-600 px-4 py-3.5 text-base font-bold text-white transition hover:bg-rose-500 disabled:opacity-60"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
        </ModalShell>
      )}

      {showMoveModal && (
        <ModalShell
          title="Move document"
          onClose={() => setShowMoveModal(false)}
        >
          <p className="text-base leading-7 text-slate-600">
            Choose a new destination for <strong className="text-slate-900">{moveDoc?.title || 'this document'}</strong>.
          </p>
          {moveError && (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {moveError}
            </div>
          )}
          <label className="mt-5 block">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              Destination folder
            </span>
            <select
              value={moveTargetFolderId}
              onChange={(event) => setMoveTargetFolderId(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-100"
            >
              {folderChoices.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.label}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => setShowMoveModal(false)}
              disabled={moving}
              className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleMoveConfirm()}
              disabled={moving}
              className="flex-1 rounded-2xl bg-teal-600 px-4 py-3.5 text-base font-bold text-white transition hover:bg-teal-500 disabled:opacity-60"
            >
              {moving ? 'Moving...' : 'Move'}
            </button>
          </div>
        </ModalShell>
      )}
    </main>
  );
};

export default Dashboard;
