import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDocumentsContext } from '../components/DocumentsContext.jsx';
import UploadModal from '../components/documents/UploadModal.jsx';
import FoldersPanel from '../components/folders/FoldersPanel.jsx';
import DocumentLibraryPanel, {
  ModalShell,
} from '../components/workspace/DocumentLibraryPanel.jsx';
import {
  deleteDocument,
  downloadDocumentFile,
  searchDocuments,
  toggleFavorite,
  updateDocumentName,
  uploadDocument,
} from '../service/documentAPI.js';
import { addDocumentToFolder, removeDocumentFromFolder } from '../service/folderAPI.js';

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
    selectFolder,
    selectedFolder,
    selectedFolderId,
    total,
    totalPages,
  } = useDocumentsContext();

  const [error, setError] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
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
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchQuery = searchParams.get('q')?.trim() || '';

  const pageError = error || contextError;
  const childFolders = searchQuery ? [] : selectedFolder?.children || [];

  const runSearch = useCallback(async (keyword) => {
    const trimmedKeyword = keyword.trim();

    if (!trimmedKeyword) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    try {
      setIsSearching(true);
      const result = await searchDocuments(trimmedKeyword, 20);
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
    } catch (requestError) {
      setSearchResults([]);
      setError(
        requestError.response?.data?.message || 'Failed to search documents.',
      );
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    void runSearch(searchQuery);
  }, [runSearch, searchQuery]);

  const displayedDocuments = searchQuery ? searchResults : documents;

  const folderChoices = useMemo(
    () =>
      folderOptions.map((folder) => ({
        ...folder,
        label:
          folder.depth === 0
            ? 'Workspace'
            : `${'\u00A0'.repeat(folder.depth * 4)}${folder.name}`,
      })),
    [folderOptions],
  );

  const selectedFolderLabel = useMemo(() => {
    if (!selectedFolder || selectedFolder.id === rootFolder?.id) {
      return 'Workspace';
    }

    return selectedFolder.name;
  }, [rootFolder?.id, selectedFolder]);

  const summaryLabel = useMemo(
    () =>
      searchQuery
        ? `${displayedDocuments.length} results`
        : `${childFolders.length} folders | ${total} files`,
    [childFolders.length, displayedDocuments.length, searchQuery, total],
  );

  const description = useMemo(() => {
    if (searchQuery) {
      return `Results are shown directly inside the workspace for "${searchQuery}".`;
    }

    if (!selectedFolder || selectedFolder.id === rootFolder?.id) {
      return '';
    }

    return `Files currently stored inside ${selectedFolder.name}.`;
  }, [rootFolder?.id, searchQuery, selectedFolder]);

  const handleOpenDocument = (documentId) => {
    navigate(`/app/documents/${documentId}`);
  };

  const handleDownloadDocument = async (documentId, title) => {
    try {
      await downloadDocumentFile(documentId, title);
      setError('');
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || 'Failed to download document.',
      );
    }
  };

  const handleUpload = async (file, title, folderId) => {
    await uploadDocument(file, title, folderId || selectedFolderId || rootFolder?.id);
    await refreshFolders(selectedFolderId || rootFolder?.id);
    await refreshDocuments(1);
  };

  const handleToggleFavorite = async (docId) => {
    try {
      await toggleFavorite(docId);
      setError('');
      if (searchQuery) {
        setSearchResults((current) =>
          current.map((document) =>
            document.id === docId
              ? { ...document, isFavorite: !document.isFavorite }
              : document,
          ),
        );
        return;
      }

      await refreshDocuments(currentPage);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || 'Failed to update favorite status.',
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
      if (searchQuery) {
        await runSearch(searchQuery);
        return;
      }

      await refreshDocuments(currentPage);
    } catch (requestError) {
      setRenameError(
        requestError.response?.data?.message || 'Failed to rename document.',
      );
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

      if (searchQuery) {
        await runSearch(searchQuery);
        await refreshFolders(selectedFolderId || rootFolder?.id);
        return;
      }

      const nextPage =
        documents.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;

      await refreshDocuments(nextPage);
      await refreshFolders(selectedFolderId || rootFolder?.id);
    } catch (requestError) {
      setDeleteError(
        requestError.response?.data?.message || 'Failed to delete document.',
      );
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
    } catch (requestError) {
      setMoveError(
        requestError.response?.data?.message || 'Failed to move document.',
      );
    } finally {
      setMoving(false);
    }
  };

  const pagination =
    !searchQuery && totalPages > 1
      ? {
          currentPage,
          totalPages,
          onPrevious: () => void goToPage(currentPage - 1),
          onNext: () => void goToPage(currentPage + 1),
        }
      : null;

  return (
    <>
      <div className="overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-[0_22px_50px_rgba(15,23,42,0.06)]">
        <div className="grid lg:grid-cols-[380px_minmax(0,1fr)]">
          <FoldersPanel />

          <div className="min-w-0 border-t border-slate-200 lg:border-l lg:border-t-0">
            <DocumentLibraryPanel
              title={searchQuery ? 'Search results' : selectedFolderLabel}
              summaryLabel={summaryLabel}
              description={description}
              error={pageError}
              loading={documentsLoading || isSearching}
              childFolders={childFolders}
              documents={displayedDocuments}
              emptyTitle={searchQuery ? 'No matching documents' : 'This folder is empty'}
              emptyDescription={
                searchQuery
                  ? 'Try another keyword or clear the search box to return to the current folder.'
                  : 'Upload a document or create a subfolder to keep building your workspace.'
              }
              pagination={pagination}
              onOpenFolder={selectFolder}
              onOpenDocument={handleOpenDocument}
              onDownloadDocument={handleDownloadDocument}
              onToggleFavorite={handleToggleFavorite}
              onMoveDocument={searchQuery ? null : handleMoveClick}
              onRenameDocument={handleRenameClick}
              onDeleteDocument={handleDeleteClick}
              showFolderContext={Boolean(searchQuery)}
              actions={
                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="inline-flex items-center gap-2 rounded-3xl bg-teal-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-teal-500/25 transition hover:bg-teal-500"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-5 w-5"
                  >
                    <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v7.19L7.03 7.72a.75.75 0 0 0-1.06 1.06l3.5 3.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 1 0-1.06-1.06l-2.22 2.22V2.75Z" />
                    <path d="M3.5 13.25a.75.75 0 0 0-1.5 0v1A2.75 2.75 0 0 0 4.75 17h10.5A2.75 2.75 0 0 0 18 14.25v-1a.75.75 0 0 0-1.5 0v1c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-1Z" />
                  </svg>
                  Upload
                </button>
              }
            />
          </div>
        </div>
      </div>

      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadSuccess={handleUpload}
        folders={folderChoices}
        defaultFolderId={selectedFolderId || rootFolder?.id || ''}
      />

      {showRenameModal ? (
        <ModalShell title="Rename document" onClose={() => setShowRenameModal(false)}>
          {renameError ? (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {renameError}
            </div>
          ) : null}
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
      ) : null}

      {showDeleteModal ? (
        <ModalShell title="Delete document" onClose={() => setShowDeleteModal(false)}>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Remove{' '}
            <strong className="text-slate-900">
              {deleteDoc?.title || 'this document'}
            </strong>{' '}
            from your workspace.
          </p>
          {deleteError ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {deleteError}
            </div>
          ) : null}
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
      ) : null}

      {showMoveModal ? (
        <ModalShell title="Move document" onClose={() => setShowMoveModal(false)}>
          <p className="text-base leading-7 text-slate-600">
            Choose a new destination for{' '}
            <strong className="text-slate-900">
              {moveDoc?.title || 'this document'}
            </strong>
            .
          </p>
          {moveError ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {moveError}
            </div>
          ) : null}
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
      ) : null}
    </>
  );
};

export default Dashboard;
