import { Fragment, useMemo, useState } from 'react';
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
      className={`flex h-10 w-10 items-center justify-center rounded-2xl border text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]}`}
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

const findFolderPath = (folders, folderId, trail = []) => {
  for (const folder of folders) {
    const nextTrail = [...trail, folder];

    if (folder.id === folderId) {
      return nextTrail;
    }

    const nestedTrail = findFolderPath(folder.children || [], folderId, nextTrail);

    if (nestedTrail.length > 0) {
      return nestedTrail;
    }
  }

  return [];
};

const FoldersPanel = () => {
  const {
    foldersLoading,
    folderOptions,
    refreshFolders,
    rootFolder,
    selectedFolderId,
    selectFolder,
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
            ? 'Workspace'
            : `${'\u00A0'.repeat(folder.depth * 4)}${folder.name}`,
      })),
    [folderOptions],
  );

  const getFolderLabel = (folder) =>
    folder?.id === rootFolder?.id ? 'Workspace' : folder?.name || 'Untitled folder';

  const folderPath = useMemo(() => {
    if (!rootFolder) {
      return [];
    }

    const activeFolderId = selectedFolderId || rootFolder.id;
    const nextPath = findFolderPath([rootFolder], activeFolderId);

    return nextPath.length > 0 ? nextPath : [rootFolder];
  }, [rootFolder, selectedFolderId]);

  const currentExplorerFolder = folderPath[folderPath.length - 1] || rootFolder;
  const parentFolder =
    folderPath.length > 1 ? folderPath[folderPath.length - 2] : null;
  const visibleFolders = currentExplorerFolder?.children || [];

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
      await createFolder(createName.trim(), createParentId || rootFolder?.id);
      const nextFolderId = createParentId || rootFolder?.id;
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

  const renderFolderRow = (folder) => {
    return (
      <button
        key={folder.id}
        type="button"
        onClick={() => selectFolder(folder.id)}
        className="group flex w-full items-center gap-4 rounded-3xl border border-transparent bg-white px-4 py-4 text-left transition hover:border-slate-200 hover:bg-white"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition group-hover:bg-teal-50 group-hover:text-teal-600">
          <FolderIcon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-slate-900">
            {getFolderLabel(folder)}
          </p>
          {/*
            {childCount} folders • {documentCount} files
          </p>
          */}
        </div>

        <div className="flex items-center gap-2 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
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
          <div className="hidden h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 transition group-hover:bg-teal-50 group-hover:text-teal-600 md:flex">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M7.22 14.78a.75.75 0 0 1 0-1.06L10.94 10 7.22 6.28a.75.75 0 0 1 1.06-1.06l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0Z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </button>
    );
  };

  return (
    <>
      <aside className="flex h-full flex-col bg-slate-50/70">
        <div className="border-b border-slate-200 px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-3xl font-semibold text-slate-950">
                Folders
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {currentExplorerFolder?.id !== rootFolder?.id && (
                <>
                  <IconButton
                    label="Rename folder"
                    onClick={() => openRenameModal(currentExplorerFolder)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path d="m13.879 2.697 3.424 3.424a1.5 1.5 0 0 1 0 2.121l-8.264 8.264a4.5 4.5 0 0 1-1.897 1.11l-2.685.806a.75.75 0 0 1-.93-.93l.806-2.685a4.5 4.5 0 0 1 1.11-1.897l8.264-8.264a1.5 1.5 0 0 1 2.121 0Z" />
                    </svg>
                  </IconButton>
                  <IconButton
                    label="Move folder"
                    onClick={() => openMoveModal(currentExplorerFolder)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h9.19L10.72 7.03a.75.75 0 0 1 1.06-1.06l3.5 3.5a.75.75 0 0 1 0 1.06l-3.5 3.5a.75.75 0 1 1-1.06-1.06l2.22-2.22H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
                    </svg>
                  </IconButton>
                  <IconButton
                    label="Delete folder"
                    onClick={() => openDeleteModal(currentExplorerFolder)}
                    tone="danger"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path fillRule="evenodd" d="M8.75 3a1.75 1.75 0 0 0-1.75 1.75V5H4.75a.75.75 0 0 0 0 1.5h.318l.764 9.167A2.25 2.25 0 0 0 8.074 17.75h3.852a2.25 2.25 0 0 0 2.242-2.083l.764-9.167h.318a.75.75 0 0 0 0-1.5H13V4.75A1.75 1.75 0 0 0 11.25 3h-2.5ZM11.5 5v-.25a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25V5h3Z" clipRule="evenodd" />
                    </svg>
                  </IconButton>
                </>
              )}
              <button
                type="button"
                onClick={openCreateModal}
                className="rounded-2xl bg-teal-600 px-5 py-3 text-base font-semibold text-white transition hover:bg-teal-500"
              >
                New folder
              </button>
            </div>
          </div>

          {parentFolder && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => selectFolder(parentFolder.id)}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M12.78 15.53a.75.75 0 0 1-1.06 0l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 1 1 1.06 1.06L9.06 10l3.72 3.72a.75.75 0 0 1 0 1.06Z" clipRule="evenodd" />
                </svg>
                Back
              </button>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {folderPath.map((folder, index) => {
              const isCurrent = index === folderPath.length - 1;

              return (
                <Fragment key={folder.id}>
                  {index > 0 && (
                    <span className="text-xs font-bold text-slate-300">/</span>
                  )}
                  <button
                    type="button"
                    onClick={() => selectFolder(folder.id)}
                    disabled={isCurrent}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      isCurrent
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {getFolderLabel(folder)}
                  </button>
                </Fragment>
              );
            })}
          </div>
        </div>

        <div className="scrollbar-none max-h-[calc(100vh-240px)] flex-1 overflow-auto px-4 py-4">
          {foldersLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-3xl bg-white" />
              ))}
            </div>
          ) : rootFolder ? (
            <div className="space-y-2">
              {visibleFolders.length > 0 ? (
                visibleFolders.map(renderFolderRow)
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center text-base text-slate-500">
                  No subfolders yet.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-base text-slate-500">
              No folders yet.
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
