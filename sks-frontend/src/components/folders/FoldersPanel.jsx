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
      'border-[var(--sks-border)] bg-white text-[var(--sks-text-soft)] hover:border-[var(--sks-teal-soft)] hover:bg-[var(--sks-surface)] hover:text-[var(--sks-teal-deep)]',
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
      className={`flex h-10 w-10 items-center justify-center rounded-[18px] border text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]}`}
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
      className="w-full max-w-lg rounded-[32px] border border-[var(--sks-border)] bg-white p-7 shadow-[0_40px_120px_rgba(9,30,27,0.18)]"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="sks-kicker">Folder Action</p>
          <h2 className="mt-3 font-['Fraunces'] text-3xl font-semibold tracking-tight text-[var(--sks-text)]">
            {title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="sks-button-secondary px-4 py-2 text-sm font-semibold"
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
    const isActive = selectedFolderId === folder.id;
    const childCount = folder.children?.length || 0;

    return (
      <button
        key={folder.id}
        type="button"
        onClick={() => selectFolder(folder.id)}
        className={`group flex w-full items-center gap-4 rounded-[28px] border px-4 py-4 text-left shadow-[0_10px_30px_rgba(9,30,27,0.04)] transition ${
          isActive
            ? 'border-[var(--sks-teal-soft)] bg-white'
            : 'border-[var(--sks-border)] bg-[var(--sks-surface)] hover:-translate-y-0.5 hover:border-[var(--sks-teal-soft)] hover:bg-white'
        }`}
      >
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] ring-1 ring-inset ${
          isActive
            ? 'bg-teal-50 text-[var(--sks-teal-deep)] ring-teal-200'
            : 'bg-white text-[var(--sks-text-soft)] ring-[var(--sks-border)]'
        }`}>
          <FolderIcon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-[var(--sks-text)]">
            {getFolderLabel(folder)}
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--sks-text-soft)]">
            {childCount > 0 ? `${childCount} subfolders` : 'Open folder'}
          </p>
        </div>

        <div className="flex items-center gap-2 opacity-100 transition md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
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
      </button>
    );
  };

  return (
    <>
      <aside className="sks-card flex h-full flex-col overflow-hidden">
        <div className="border-b border-[var(--sks-border)] bg-[linear-gradient(180deg,rgba(247,251,249,0.94)_0%,rgba(255,255,255,0.98)_100%)] px-6 py-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="sks-kicker">Folder Explorer</p>
                  <h2 className="mt-3 font-['Fraunces'] text-3xl font-semibold tracking-tight text-[var(--sks-text)]">
                    {getFolderLabel(currentExplorerFolder || rootFolder)}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-[var(--sks-text-soft)]">
                    Keep folder hierarchy on the left so the main document library and future AI rail stay clear.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {currentExplorerFolder?.id !== rootFolder?.id ? (
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
                  ) : null}
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="sks-button-primary px-5 py-3 text-sm font-semibold"
                  >
                    New folder
                  </button>
                </div>
              </div>

              {parentFolder ? (
                <button
                  type="button"
                  onClick={() => selectFolder(parentFolder.id)}
                  className="sks-button-secondary w-fit px-4 py-2.5 text-sm font-semibold"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M12.78 15.53a.75.75 0 0 1-1.06 0l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 1 1 1.06 1.06L9.06 10l3.72 3.72a.75.75 0 0 1 0 1.06Z" clipRule="evenodd" />
                  </svg>
                  Back
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {folderPath.map((folder, index) => {
                const isCurrent = index === folderPath.length - 1;

                return (
                  <Fragment key={folder.id}>
                    {index > 0 ? (
                      <span className="text-xs font-bold text-[var(--sks-text-soft)]/45">/</span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => selectFolder(folder.id)}
                      disabled={isCurrent}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                        isCurrent
                          ? 'bg-[var(--sks-teal-deep)] text-white'
                          : 'bg-[var(--sks-surface)] text-[var(--sks-text-soft)] hover:bg-white'
                      }`}
                    >
                      {getFolderLabel(folder)}
                    </button>
                  </Fragment>
                );
              })}
            </div>
          </div>
        </div>

        <div className="scrollbar-none max-h-[calc(100vh-15rem)] flex-1 overflow-auto px-4 py-4">
          {foldersLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-[28px] bg-[var(--sks-surface)]" />
              ))}
            </div>
          ) : rootFolder ? (
            <div className="space-y-3">
              {visibleFolders.length > 0 ? (
                visibleFolders.map(renderFolderRow)
              ) : (
                <div className="rounded-[28px] border border-dashed border-[var(--sks-border)] bg-[var(--sks-surface)] px-5 py-12 text-center text-sm leading-7 text-[var(--sks-text-soft)]">
                  No subfolders yet. Create a new folder to split your material into clearer study areas.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-[28px] border border-dashed border-[var(--sks-border)] bg-[var(--sks-surface)] px-5 py-10 text-center text-sm leading-7 text-[var(--sks-text-soft)]">
              No folders yet.
            </div>
          )}
        </div>
      </aside>

      {showCreateModal ? (
        <ModalShell title="Create folder" onClose={closeModals}>
          {modalError ? (
            <div className="mb-4 rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {modalError}
            </div>
          ) : null}
          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--sks-text)]">
                Folder name
              </span>
              <input
                type="text"
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                className="sks-input w-full bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--sks-text)]">
                Parent folder
              </span>
              <select
                value={createParentId}
                onChange={(event) => setCreateParentId(event.target.value)}
                className="sks-input w-full bg-white"
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
                className="sks-button-secondary flex-1 justify-center px-4 py-3.5 text-base font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateFolder}
                disabled={isSubmitting}
                className="sks-button-primary flex-1 justify-center px-4 py-3.5 text-base font-semibold disabled:opacity-60"
              >
                {isSubmitting ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {showRenameModal ? (
        <ModalShell title="Rename folder" onClose={closeModals}>
          {modalError ? (
            <div className="mb-4 rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {modalError}
            </div>
          ) : null}
          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--sks-text)]">
                New name
              </span>
              <input
                type="text"
                value={renameName}
                onChange={(event) => setRenameName(event.target.value)}
                className="sks-input w-full bg-white"
              />
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeModals}
                disabled={isSubmitting}
                className="sks-button-secondary flex-1 justify-center px-4 py-3.5 text-base font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRenameFolder}
                disabled={isSubmitting}
                className="sks-button-primary flex-1 justify-center px-4 py-3.5 text-base font-semibold disabled:opacity-60"
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {showMoveModal ? (
        <ModalShell title="Move folder" onClose={closeModals}>
          {modalError ? (
            <div className="mb-4 rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {modalError}
            </div>
          ) : null}
          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--sks-text)]">
                Destination
              </span>
              <select
                value={moveParentId}
                onChange={(event) => setMoveParentId(event.target.value)}
                className="sks-input w-full bg-white"
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
                className="sks-button-secondary flex-1 justify-center px-4 py-3.5 text-base font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMoveFolder}
                disabled={isSubmitting}
                className="sks-button-primary flex-1 justify-center px-4 py-3.5 text-base font-semibold disabled:opacity-60"
              >
                {isSubmitting ? 'Moving...' : 'Move'}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {showDeleteModal ? (
        <ModalShell title="Delete folder" onClose={closeModals}>
          {modalError ? (
            <div className="mb-4 rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {modalError}
            </div>
          ) : null}
          <div className="space-y-5">
            <p className="text-sm leading-7 text-[var(--sks-text-soft)]">
              Delete <strong className="text-[var(--sks-text)]">{activeFolder?.name}</strong>.
              Documents inside will be moved back to the parent folder.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeModals}
                disabled={isSubmitting}
                className="sks-button-secondary flex-1 justify-center px-4 py-3.5 text-base font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteFolder}
                disabled={isSubmitting}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-rose-600 px-4 py-3.5 text-base font-semibold text-white shadow-[0_20px_40px_rgba(225,29,72,0.16)] transition hover:bg-rose-500 disabled:opacity-60"
              >
                {isSubmitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </>
  );
};

export default FoldersPanel;
