import { useMemo, useState } from 'react';
import {
  createFolder,
  deleteFolder,
  moveFolder,
  updateFolder,
} from '../../service/folderAPI.js';
import { useDocumentsContext } from '../DocumentsContext.jsx';

const FolderIcon = ({ className = '' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M3.75 5.25A2.25 2.25 0 0 1 6 3h3.21c.596 0 1.17.237 1.591.659l1.54 1.54a.75.75 0 0 0 .53.22H18A2.25 2.25 0 0 1 20.25 7.5v8.25A2.25 2.25 0 0 1 18 18H6a2.25 2.25 0 0 1-2.25-2.25V5.25Z" />
  </svg>
);

const IconButton = ({
  label,
  onClick,
  children,
  tone = 'default',
  disabled = false,
}) => {
  const tones = {
    default:
      'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800',
    danger:
      'border-rose-200 bg-white text-rose-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700',
  };

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick(event);
      }}
      className={`flex h-9 w-9 items-center justify-center rounded-2xl border text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]}`}
    >
      {children}
    </button>
  );
};

const ModalShell = ({ title, children, onClose }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm"
    onClick={onClose}
  >
    <div
      className="w-full max-w-lg rounded-[32px] bg-white p-7 shadow-[0_40px_120px_rgba(15,23,42,0.18)]"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-950">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-500 transition hover:bg-slate-200"
        >
          Close
        </button>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  </div>
);

const FoldersPanel = () => {
  const {
    foldersLoading,
    folderOptions,
    refreshFolders,
    rootFolder,
    selectedFolderId,
    selectFolder,
    selectedFolder,
  } = useDocumentsContext();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createParentId, setCreateParentId] = useState('');
  const [renameName, setRenameName] = useState('');
  const [moveParentId, setMoveParentId] = useState('');
  const [activeFolder, setActiveFolder] = useState(null);
  const [modalError, setModalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const openCreateModal = () => {
    setCreateName('');
    setCreateParentId(selectedFolderId || rootFolder?.id || '');
    setModalError('');
    setShowCreateModal(true);
  };

  const openRenameModal = (folder) => {
    setActiveFolder(folder);
    setRenameName(folder.name || '');
    setModalError('');
    setShowRenameModal(true);
  };

  const openMoveModal = (folder) => {
    setActiveFolder(folder);
    setMoveParentId(folder.parentId || rootFolder?.id || '');
    setModalError('');
    setShowMoveModal(true);
  };

  const openDeleteModal = (folder) => {
    setActiveFolder(folder);
    setModalError('');
    setShowDeleteModal(true);
  };

  const closeModals = () => {
    setShowCreateModal(false);
    setShowRenameModal(false);
    setShowMoveModal(false);
    setShowDeleteModal(false);
    setModalError('');
    setActiveFolder(null);
    setIsSubmitting(false);
  };

  const handleCreateFolder = async () => {
    if (!createName.trim()) {
      setModalError('Please enter a folder name.');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await createFolder(
        createName.trim(),
        createParentId || rootFolder?.id,
      );
      const nextFolderId = result.folder?.id || createParentId || rootFolder?.id;
      await refreshFolders(nextFolderId);
      if (nextFolderId) {
        selectFolder(nextFolderId);
      }
      closeModals();
    } catch (err) {
      setModalError(
        err.response?.data?.message || err.message || 'Failed to create folder.',
      );
      setIsSubmitting(false);
    }
  };

  const handleRenameFolder = async () => {
    if (!activeFolder || !renameName.trim()) {
      setModalError('Please enter a folder name.');
      return;
    }

    try {
      setIsSubmitting(true);
      await updateFolder(activeFolder.id, renameName.trim(), activeFolder.parentId);
      await refreshFolders(activeFolder.id);
      closeModals();
    } catch (err) {
      setModalError(
        err.response?.data?.message || err.message || 'Failed to rename folder.',
      );
      setIsSubmitting(false);
    }
  };

  const handleMoveFolder = async () => {
    if (!activeFolder) {
      return;
    }

    try {
      setIsSubmitting(true);
      await moveFolder(activeFolder.id, moveParentId || rootFolder?.id);
      await refreshFolders(activeFolder.id);
      closeModals();
    } catch (err) {
      setModalError(
        err.response?.data?.message || err.message || 'Failed to move folder.',
      );
      setIsSubmitting(false);
    }
  };

  const handleDeleteFolder = async () => {
    if (!activeFolder) {
      return;
    }

    try {
      setIsSubmitting(true);
      const nextFolderId = activeFolder.parentId || rootFolder?.id;
      await deleteFolder(activeFolder.id);
      await refreshFolders(nextFolderId);
      if (selectedFolderId === activeFolder.id && nextFolderId) {
        selectFolder(nextFolderId);
      }
      closeModals();
    } catch (err) {
      setModalError(
        err.response?.data?.message || err.message || 'Failed to delete folder.',
      );
      setIsSubmitting(false);
    }
  };

  const renderFolderNode = (folder, depth = 0) => {
    const isRoot = folder.id === rootFolder?.id;
    const isSelected = folder.id === selectedFolderId;
    const documentCount = folder.userDocuments?.length || 0;
    const childCount = folder.children?.length || 0;

    return (
      <div key={folder.id} className="space-y-2">
        <button
          type="button"
          onClick={() => selectFolder(folder.id)}
          className={`flex w-full items-center gap-3 rounded-[24px] border px-4 py-3 text-left transition ${
            isSelected
              ? 'border-teal-200 bg-teal-50 text-slate-900 shadow-[0_16px_35px_rgba(13,148,136,0.10)]'
              : 'border-transparent bg-slate-50 text-slate-700 hover:border-slate-200 hover:bg-white'
          }`}
          style={{ marginLeft: `${depth * 12}px` }}
        >
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] ${
              isSelected ? 'bg-white text-teal-600' : 'bg-white text-slate-500'
            }`}
          >
            <FolderIcon className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-current">
              {isRoot ? 'Root' : folder.name}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {documentCount} docs / {childCount} folders
            </p>
          </div>

          {!isRoot && (
            <div className="flex items-center gap-2">
              <IconButton label="Rename folder" onClick={() => openRenameModal(folder)}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="m13.879 2.697 3.424 3.424a1.5 1.5 0 0 1 0 2.121l-8.264 8.264a4.5 4.5 0 0 1-1.897 1.11l-2.685.806a.75.75 0 0 1-.93-.93l.806-2.685a4.5 4.5 0 0 1 1.11-1.897l8.264-8.264a1.5 1.5 0 0 1 2.121 0Z" />
                </svg>
              </IconButton>
              <IconButton label="Move folder" onClick={() => openMoveModal(folder)}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h9.19L10.72 7.03a.75.75 0 0 1 1.06-1.06l3.5 3.5a.75.75 0 0 1 0 1.06l-3.5 3.5a.75.75 0 1 1-1.06-1.06l2.22-2.22H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
                </svg>
              </IconButton>
              <IconButton
                label="Delete folder"
                onClick={() => openDeleteModal(folder)}
                tone="danger"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M8.75 3a1.75 1.75 0 0 0-1.75 1.75V5H4.75a.75.75 0 0 0 0 1.5h.318l.764 9.167A2.25 2.25 0 0 0 8.074 17.75h3.852a2.25 2.25 0 0 0 2.242-2.083l.764-9.167h.318a.75.75 0 0 0 0-1.5H13V4.75A1.75 1.75 0 0 0 11.25 3h-2.5ZM11.5 5v-.25a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25V5h3Z" clipRule="evenodd" />
                </svg>
              </IconButton>
            </div>
          )}
        </button>

        {folder.children?.length > 0 && (
          <div className="space-y-2">
            {folder.children.map((childFolder) =>
              renderFolderNode(childFolder, depth + 1),
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <aside className="overflow-hidden rounded-[32px] border border-white/80 bg-white/92 shadow-[0_28px_90px_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-100 px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-400">
                Structure
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                Folders
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {selectedFolder
                  ? `Current: ${selectedFolder.id === rootFolder?.id ? 'Root' : selectedFolder.name}`
                  : 'Pick a folder to filter documents.'}
              </p>
            </div>

            <button
              type="button"
              onClick={openCreateModal}
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              New
            </button>
          </div>
        </div>

        <div className="max-h-[calc(100vh-220px)] overflow-auto px-4 py-4">
          {foldersLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-16 animate-pulse rounded-[24px] bg-slate-100"
                />
              ))}
            </div>
          ) : rootFolder ? (
            <div className="space-y-2">{renderFolderNode(rootFolder)}</div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              No folders available.
            </div>
          )}
        </div>
      </aside>

      {showCreateModal && (
        <ModalShell title="Create folder" onClose={closeModals}>
          {modalError && (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {modalError}
            </div>
          )}
          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                Folder name
              </span>
              <input
                type="text"
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                Parent folder
              </span>
              <select
                value={createParentId}
                onChange={(event) => setCreateParentId(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100"
              >
                {folderChoices.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeModals}
                disabled={isSubmitting}
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateFolder}
                disabled={isSubmitting}
                className="flex-1 rounded-2xl bg-teal-600 px-4 py-3.5 text-base font-bold text-white transition hover:bg-teal-500 disabled:opacity-60"
              >
                {isSubmitting ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {showRenameModal && (
        <ModalShell title="Rename folder" onClose={closeModals}>
          {modalError && (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {modalError}
            </div>
          )}
          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                New name
              </span>
              <input
                type="text"
                value={renameName}
                onChange={(event) => setRenameName(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100"
              />
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeModals}
                disabled={isSubmitting}
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRenameFolder}
                disabled={isSubmitting}
                className="flex-1 rounded-2xl bg-teal-600 px-4 py-3.5 text-base font-bold text-white transition hover:bg-teal-500 disabled:opacity-60"
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {showMoveModal && (
        <ModalShell title="Move folder" onClose={closeModals}>
          {modalError && (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {modalError}
            </div>
          )}
          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                Destination
              </span>
              <select
                value={moveParentId}
                onChange={(event) => setMoveParentId(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100"
              >
                {folderChoices
                  .filter((folder) => folder.id !== activeFolder?.id)
                  .map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.label}
                    </option>
                  ))}
              </select>
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeModals}
                disabled={isSubmitting}
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMoveFolder}
                disabled={isSubmitting}
                className="flex-1 rounded-2xl bg-teal-600 px-4 py-3.5 text-base font-bold text-white transition hover:bg-teal-500 disabled:opacity-60"
              >
                {isSubmitting ? 'Moving...' : 'Move'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {showDeleteModal && (
        <ModalShell title="Delete folder" onClose={closeModals}>
          {modalError && (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {modalError}
            </div>
          )}
          <div className="space-y-5">
            <p className="text-sm leading-7 text-slate-600">
              Delete <strong className="text-slate-900">{activeFolder?.name}</strong>.
              Documents inside will be moved back to the parent folder.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeModals}
                disabled={isSubmitting}
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteFolder}
                disabled={isSubmitting}
                className="flex-1 rounded-2xl bg-rose-600 px-4 py-3.5 text-base font-bold text-white transition hover:bg-rose-500 disabled:opacity-60"
              >
                {isSubmitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </>
  );
};

export default FoldersPanel;
