import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { useDocumentsContext } from '../components/DocumentsContext.jsx';
import UploadModal from '../components/documents/UploadModal.jsx';
import {
  addDocumentToFolder,
  createFolder,
  deleteFolder,
  getDocumentsByFolder,
  moveFolder,
  updateFolder,
} from '../service/folderAPI.js';
import {
  deleteDocument,
  downloadDocumentFile,
  getDocumentDetails,
  searchDocuments,
  toggleFavorite,
  updateDocumentName,
  uploadDocument,
} from '../service/documentAPI.js';
import {
  getRecentDocumentEntries,
  removeRecentDocument,
} from '../utils/recentDocuments.js';
import {
  buildPaginationItems,
  buildSearchLocationText,
  buildSearchMatchTypeLabel,
  buildSearchRelevanceLabel,
  buildSearchSnippetText,
  buildSearchTopicText,
  findFolderById,
  findFolderTrail,
  FOLDER_ACCENTS,
  formatDateLabel,
  getDocumentType,
} from './dashboardUtils.js';

const MoreIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
    <path d="M10 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM10 8.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM8.5 15.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" />
  </svg>
);

const SearchIcon = ({ className = 'h-5 w-5' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path
      fillRule="evenodd"
      d="M9 3.5a5.5 5.5 0 1 0 3.473 9.765l3.131 3.132a.75.75 0 1 0 1.06-1.06l-3.132-3.131A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
      clipRule="evenodd"
    />
  </svg>
);

const FolderAddIcon = ({ className = 'h-5 w-5' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path d="M3.5 4.75A1.75 1.75 0 0 1 5.25 3h2.44c.464 0 .909.184 1.237.513l1.31 1.31c.14.14.33.219.528.219h4.985A1.75 1.75 0 0 1 17.5 6.792v1.041H2.5V4.75Z" />
    <path d="M2.5 9.333h15v5.917A1.75 1.75 0 0 1 15.75 17H4.25A1.75 1.75 0 0 1 2.5 15.25V9.333Z" />
    <path d="M10 10.5a.75.75 0 0 1 .75.75v1.5h1.5a.75.75 0 0 1 0 1.5h-1.5v1.5a.75.75 0 0 1-1.5 0v-1.5h-1.5a.75.75 0 0 1 0-1.5h1.5v-1.5A.75.75 0 0 1 10 10.5Z" />
  </svg>
);

const UploadIcon = ({ className = 'h-5 w-5' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v7.19L7.03 7.72a.75.75 0 0 0-1.06 1.06l3.5 3.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 1 0-1.06-1.06l-2.22 2.22V2.75Z" />
    <path d="M3.5 13.25a.75.75 0 0 0-1.5 0v1A2.75 2.75 0 0 0 4.75 17h10.5A2.75 2.75 0 0 0 18 14.25v-1a.75.75 0 0 0-1.5 0v1c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-1Z" />
  </svg>
);

const OpenIcon = ({ className = 'h-5 w-5' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path d="M5.5 4A2.5 2.5 0 0 0 3 6.5v7A2.5 2.5 0 0 0 5.5 16h4.379a.75.75 0 0 0 0-1.5H5.5A1 1 0 0 1 4.5 13.5v-7a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v4.379a.75.75 0 0 0 1.5 0V6.5A2.5 2.5 0 0 0 12.5 4h-7Z" />
    <path d="M11.75 10a.75.75 0 0 0 0 1.5h2.69l-5.72 5.72a.75.75 0 1 0 1.06 1.06l5.72-5.72v2.69a.75.75 0 0 0 1.5 0V10.75A.75.75 0 0 0 16.25 10h-4.5Z" />
  </svg>
);

const EditIcon = ({ className = 'h-5 w-5' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path d="m13.69 3.805 2.505 2.505a1.75 1.75 0 0 1 0 2.475l-7.58 7.58a2.25 2.25 0 0 1-1.06.58l-2.558.64a.75.75 0 0 1-.91-.91l.64-2.558a2.25 2.25 0 0 1 .58-1.06l7.58-7.58a1.75 1.75 0 0 1 2.475 0Z" />
  </svg>
);

const MoveIcon = ({ className = 'h-5 w-5' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path d="M9.469 2.97a.75.75 0 0 1 1.061 0l2.75 2.75a.75.75 0 0 1-1.06 1.06L10.75 5.31v3.94a.75.75 0 0 1-1.5 0V5.31L7.78 6.78a.75.75 0 0 1-1.06-1.06l2.75-2.75Z" />
    <path d="M17.03 9.469a.75.75 0 0 1 0 1.061l-2.75 2.75a.75.75 0 1 1-1.06-1.06l1.47-1.47H10.75a.75.75 0 0 1 0-1.5h3.94l-1.47-1.47a.75.75 0 1 1 1.06-1.06l2.75 2.75Z" />
    <path d="M10.75 17.03a.75.75 0 0 1-1.061 0l-2.75-2.75a.75.75 0 0 1 1.06-1.06l1.47 1.47V10.75a.75.75 0 0 1 1.5 0v3.94l1.47-1.47a.75.75 0 0 1 1.06 1.06l-2.75 2.75Z" />
    <path d="M2.97 10.531a.75.75 0 0 1 0-1.061l2.75-2.75a.75.75 0 0 1 1.06 1.06L5.31 9.25h3.94a.75.75 0 0 1 0 1.5H5.31l1.47 1.47a.75.75 0 1 1-1.06 1.06l-2.75-2.75Z" />
  </svg>
);

const TrashIcon = ({ className = 'h-5 w-5' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path
      fillRule="evenodd"
      d="M8.75 2.75A1.75 1.75 0 0 0 7 4.5V5H4.75a.75.75 0 0 0 0 1.5h.296l.638 8.3A2.25 2.25 0 0 0 7.928 17h4.144a2.25 2.25 0 0 0 2.244-2.2l.638-8.3h.296a.75.75 0 0 0 0-1.5H13V4.5a1.75 1.75 0 0 0-1.75-1.75h-2.5ZM11.5 5V4.5a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25V5h3Z"
      clipRule="evenodd"
    />
  </svg>
);

const DownloadIcon = ({ className = 'h-5 w-5' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v7.19L7.03 7.72a.75.75 0 0 0-1.06 1.06l3.5 3.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 1 0-1.06-1.06l-2.22 2.22V2.75Z" />
    <path d="M3.5 13.25a.75.75 0 0 0-1.5 0v1A2.75 2.75 0 0 0 4.75 17h10.5A2.75 2.75 0 0 0 18 14.25v-1a.75.75 0 0 0-1.5 0v1c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-1Z" />
  </svg>
);

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

const CloseIcon = ({ className = 'h-5 w-5' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
  </svg>
);

const ActionIconFrame = ({ children, tone = 'bg-sks-primary-light text-sks-primary' }) => (
  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}>
    {children}
  </span>
);

const ModalShell = ({ title, children, onClose, panelClassName = 'max-w-xl' }) => (
  <div
    className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/60 px-6 py-10 pt-28 backdrop-blur-xl"
    onClick={onClose}
  >
    <div
      className={`relative w-full overflow-hidden rounded-[32px] border border-white/20 bg-white shadow-[0_45px_120px_-20px_rgba(15,23,42,0.5)] animate-in fade-in zoom-in duration-300 ${panelClassName}`}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-8 py-5 flex items-center justify-between border-b border-white/10">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400">System</p>
          <h2 className="mt-1 text-xl font-[1000] leading-tight text-white tracking-tight">
            {title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-slate-300 transition-all hover:bg-rose-500/20 hover:text-rose-400 active:scale-90"
          aria-label="Close"
        >
          <CloseIcon className="h-5.5 w-5.5" />
        </button>
      </div>
      <div className="p-8">{children}</div>
    </div>
  </div>
);

const ActionMenu = ({
  menuId,
  openMenuId,
  setOpenMenuId,
  items,
  buttonClassName = '',
  panelClassName = '',
}) => {
  const menuRef = useRef(null);
  const isOpen = openMenuId === menuId;

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, setOpenMenuId]);

  return (
    <div className="relative" ref={menuRef} onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpenMenuId(isOpen ? null : menuId)}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border border-sks-slate-200 bg-white text-sks-slate-600 shadow-sm transition-all hover:border-sks-primary/30 hover:bg-sks-primary-light hover:text-sks-primary ${buttonClassName}`}
        aria-label="Actions"
        title="Actions"
      >
        <MoreIcon />
      </button>

      {isOpen ? (
        <div
          className={`absolute right-0 bottom-full z-20 mb-2 flex items-center gap-0.5 rounded-2xl border border-sks-slate-200 bg-white px-2 py-2 shadow-sks-heavy ${panelClassName}`}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                setOpenMenuId(null);
                if (!item.disabled) {
                  item.onClick();
                }
              }}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                item.disabled
                  ? 'cursor-default text-sks-slate-300'
                  : item.danger
                    ? 'text-rose-500 hover:bg-rose-50 hover:text-rose-600'
                    : 'text-sks-slate-600 hover:bg-sks-primary-light hover:text-sks-primary'
              }`}
              title={item.label}
            >
              {item.icon}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const FolderCard = ({
  folder,
  accentClassName,
  onOpen,
  onRename,
  onDelete,
  onMove,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  openMenuId,
  setOpenMenuId,
}) => (
  <div
    draggable
    onDragStart={(event) => onDragStart(folder.id, event)}
    onDragEnd={onDragEnd}
    onDragOver={(event) => onDragOver(folder.id, event)}
    onDrop={(event) => onDrop(folder.id, event)}
    className={`group relative cursor-grab rounded-[24px] bg-white/60 backdrop-blur-xl px-6 py-6 text-left transition-all duration-400 border border-white/60 ${
      isDropTarget
        ? 'border-2 border-indigo-500 bg-indigo-50/50 shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)] scale-105'
        : 'shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-2 hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] hover:bg-white/80 hover:border-indigo-100'
    } ${isDragging ? 'opacity-50 scale-95' : ''}`}
  >
    <div className="absolute inset-x-0 top-0 h-10 w-full overflow-hidden rounded-t-[24px] pointer-events-none">
      <div className="absolute -top-10 left-1/2 h-20 w-40 -translate-x-1/2 rounded-full bg-white/80 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </div>
    
    <div className="relative z-10 flex items-center gap-5">
      <span
        className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 shadow-md ${accentClassName}`}
      >
        <div className={`absolute inset-0 rounded-2xl blur-md opacity-0 group-hover:opacity-60 transition-opacity duration-300 ${accentClassName.split(' ')[0]}`} />
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="relative z-10 h-7 w-7">
          <path d="M3.5 4.75A1.75 1.75 0 0 1 5.25 3h2.44c.464 0 .909.184 1.237.513l1.31 1.31c.14.14.33.219h4.985A1.75 1.75 0 0 1 17.5 6.792v1.041H2.5V4.75Z" />
          <path d="M2.5 9.333h15v5.917A1.75 1.75 0 0 1 15.75 17H4.25A1.75 1.75 0 0 1 2.5 15.25V9.333Z" />
        </svg>
      </span>

      <button type="button" onClick={() => onOpen(folder.id)} className="min-w-0 flex-1 text-left outline-none">
        <h3 className="truncate text-lg font-bold text-slate-800 transition-colors duration-300 group-hover:text-indigo-600 group-focus-visible:text-indigo-600">{folder.name}</h3>
      </button>

      <ActionMenu
        menuId={`folder-${folder.id}`}
        openMenuId={openMenuId}
        setOpenMenuId={setOpenMenuId}
        buttonClassName="h-9 w-9 border-transparent shadow-none"
        items={[
          { label: 'Rename', icon: <EditIcon className="h-[18px] w-[18px]" />, onClick: () => onRename(folder) },
          { label: 'Move to...', icon: <MoveIcon className="h-[18px] w-[18px]" />, onClick: () => onMove(folder) },
          { label: 'Delete', icon: <TrashIcon className="h-[18px] w-[18px]" />, onClick: () => onDelete(folder), danger: true },
        ]}
      />
    </div>

    {isDropTarget ? (
      <div className="mt-3 rounded-lg bg-sks-primary/10 px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-sks-primary">
        Drop to Move
      </div>
    ) : null}
  </div>
);

const DocumentRow = ({
  document,
  compact = false,
  searchQuery = '',
  menuId,
  openMenuId,
  setOpenMenuId,
  onOpen,
  onRename,
  onToggleFavorite,
  onDownload,
  onDelete,
  onMove,
  badgeLabel,
}) => {
  const fileType = getDocumentType(document);
  const hasSearchDetails = !compact && Boolean(searchQuery);
  const searchTopicText = buildSearchTopicText(document, searchQuery);
  const searchSnippetText = buildSearchSnippetText(document);
  const searchLocationText = buildSearchLocationText(document);
  const searchRelevanceLabel = buildSearchRelevanceLabel(document);
  const searchMatchTypeLabel = buildSearchMatchTypeLabel(document);
  const hasSearchBadges = Boolean(searchRelevanceLabel || searchMatchTypeLabel);

  const finalFileTypeTone = fileType.tone.replace('bg-teal-50', 'bg-gradient-to-br from-cyan-500 to-blue-500 shadow border-transparent').replace('text-teal-700', 'text-white');

  return (
    <tr className="group relative bg-white/40 backdrop-blur-sm transition-all duration-300 hover:bg-white hover:shadow-xl hover:-translate-y-0.5 hover:z-10 border-b border-slate-100/50 hover:border-transparent">
      <td className={`first:rounded-l-2xl last:rounded-r-2xl border-l-[3px] border-transparent group-hover:border-cyan-400 ${compact ? 'px-4 py-4' : 'px-6 py-5'}`}>
        <div className="flex items-center gap-4">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 transition-transform duration-300 group-hover:scale-110 ${finalFileTypeTone}`}>
            <span className="text-[10px] font-[900] uppercase tracking-wider">{fileType.label}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpen(document.id)}
                className="truncate text-left text-[15px] font-semibold text-sks-text transition hover:text-[#0070f3]"
              >
                {document.title}
              </button>
              <button
                type="button"
                onClick={() => onToggleFavorite(document.id)}
                className={`shrink-0 rounded p-1 transition ${document.isFavorite ? 'text-amber-400 hover:text-amber-500' : 'text-sks-slate-300 opacity-0 hover:text-amber-400 group-hover:opacity-100'}`}
                title={document.isFavorite ? 'Remove favorite' : 'Add favorite'}
              >
                <StarIcon className="h-4 w-4" filled={document.isFavorite} />
              </button>
            </div>
            {badgeLabel ? (
              <div className="mt-1">
                <span className="inline-block rounded-md bg-sks-primary-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sks-primary">
                  {badgeLabel}
                </span>
              </div>
            ) : null}
            {hasSearchDetails ? (
              <div className="mt-1.5 space-y-2">
                {hasSearchBadges ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {searchRelevanceLabel ? (
                      <span className="inline-flex items-center rounded-md bg-sks-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        {searchRelevanceLabel}
                      </span>
                    ) : null}
                    {searchMatchTypeLabel ? (
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          document.matchType === 'semantic'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {searchMatchTypeLabel}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {searchSnippetText ? (
                  <p className="text-sm leading-relaxed text-sks-slate-500">
                    <span className="font-semibold text-sks-slate-700">Why this matches:</span>{' '}
                    {searchSnippetText}
                  </p>
                ) : null}
                {searchTopicText ? (
                  <p className="text-sm leading-relaxed text-sks-slate-500">
                    <span className="font-semibold text-sks-slate-700">Topics:</span>{' '}
                    {searchTopicText}
                  </p>
                ) : null}
                {searchLocationText ? (
                  <p className="text-[12px] font-medium text-sks-slate-400">
                    {searchLocationText}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </td>
      <td className={compact ? 'px-4 py-4 text-sm text-sks-slate-500' : 'px-6 py-5 text-[15px] text-sks-slate-500'}>
        {formatDateLabel(document.updatedAt || document.createdAt)}
      </td>
      {!compact ? (
        <td className="px-6 py-5 text-[15px] text-sks-slate-500">
          {document.formattedFileSize || '-'}
        </td>
      ) : null}
      <td className={compact ? 'px-4 py-4 text-right' : 'px-6 py-5 text-right'}>
        <div className="flex justify-end">
          <ActionMenu
            menuId={menuId}
            openMenuId={openMenuId}
            setOpenMenuId={setOpenMenuId}
            buttonClassName="h-9 w-9 border-transparent bg-transparent shadow-none hover:bg-sks-primary-light hover:text-sks-primary"
            items={[
              { label: 'Open', icon: <OpenIcon className="h-4 w-4" />, onClick: () => onOpen(document.id) },
              { label: 'Rename', icon: <EditIcon className="h-4 w-4" />, onClick: () => onRename(document) },
              {
                label: 'Download',
                icon: <DownloadIcon className="h-4 w-4" />,
                onClick: () => onDownload(document.id, document.title),
              },
              { label: 'Move to...', icon: <MoveIcon className="h-4 w-4" />, onClick: () => onMove(document) },
              { label: 'Delete', icon: <TrashIcon className="h-4 w-4" />, onClick: () => onDelete(document), danger: true },
            ]}
          />
        </div>
      </td>
    </tr>
  );
};

const FolderPreviewModal = ({
  currentPage,
  documents,
  error,
  folder,
  loading,
  onClose,
  onDeleteDocument,
  onDeleteFolder,
  onDownloadDocument,
  onMoveFolder,
  onMoveDocument,
  onRenameDocument,
  onOpenDocument,
  onOpenFolder,
  onPageChange,
  onRenameFolder,
  onToggleFavoriteDocument,
  openMenuId,
  setOpenMenuId,
  totalPages,
  trail,
  draggedFolderId,
  dropTargetFolderId,
  onFolderDragStart,
  onFolderDragEnd,
  onFolderDragOver,
  onFolderDrop,
}) => (
  <ModalShell title={folder?.name || 'Folder preview'} onClose={onClose} panelClassName="max-w-5xl">
    <div className="space-y-7">
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-teal-700/65">
        {trail.map((item, index) => (
          <span key={item.id} className="contents">
            {index > 0 ? <span className="text-teal-300">/</span> : null}
            <button
              type="button"
              onClick={() => onOpenFolder(item.id)}
              className={`transition-colors ${
                index === trail.length - 1 ? 'text-teal-950' : 'hover:text-teal-900'
              }`}
            >
              {item.name}
            </button>
          </span>
        ))}
      </div>

      {folder?.children?.length ? (
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-teal-700/65">Subfolders</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {folder.children.map((childFolder, index) => (
              <FolderCard
                key={childFolder.id}
                folder={childFolder}
                accentClassName={FOLDER_ACCENTS[index % FOLDER_ACCENTS.length]}
                onOpen={onOpenFolder}
                onRename={onRenameFolder}
                onDelete={onDeleteFolder}
                onMove={onMoveFolder}
                isDragging={draggedFolderId === childFolder.id}
                isDropTarget={dropTargetFolderId === childFolder.id}
                onDragStart={onFolderDragStart}
                onDragEnd={onFolderDragEnd}
                onDragOver={onFolderDragOver}
                onDrop={onFolderDrop}
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-teal-700/65">Documents</h3>
          {totalPages > 1 ? (
            <span className="text-sm font-semibold text-teal-800/70">
              Page {currentPage} / {totalPages}
            </span>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-teal-100">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-teal-100 bg-teal-50/50">
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-teal-700/70">Name</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-teal-700/70">Modified</th>
                <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-teal-700/70">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-teal-50 bg-white">
              {loading ? (
                <tr>
                  <td colSpan="3" className="px-4 py-12 text-center text-base text-teal-800/70">
                    Loading folder contents...
                  </td>
                </tr>
              ) : documents.length > 0 ? (
                documents.map((document) => (
                  <DocumentRow
                    key={document.id}
                    compact
                    document={document}
                    menuId={`preview-document-${document.id}`}
                    openMenuId={openMenuId}
                    setOpenMenuId={setOpenMenuId}
                    onOpen={onOpenDocument}
                    onRename={onRenameDocument}
                    onToggleFavorite={onToggleFavoriteDocument}
                    onDownload={onDownloadDocument}
                    onDelete={onDeleteDocument}
                    onMove={onMoveDocument}
                    badgeLabel={''}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="px-4 py-10 text-center">
                    <p className="text-sm font-semibold tracking-tight text-teal-900/40">
                      There are no documents in this folder.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="rounded-xl border border-teal-100 px-4 py-2.5 text-sm font-semibold text-teal-800 transition hover:bg-teal-50 disabled:opacity-30"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="rounded-xl border border-teal-100 px-4 py-2.5 text-sm font-semibold text-teal-800 transition hover:bg-teal-50 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>
  </ModalShell>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createParentId, setCreateParentId] = useState('');
  const [createError, setCreateError] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteDoc, setDeleteDoc] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [folderToRename, setFolderToRename] = useState(null);
  const [renameFolderName, setRenameFolderName] = useState('');
  const [renameFolderError, setRenameFolderError] = useState('');
  const [renamingFolder, setRenamingFolder] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState(null);
  const [folderDeleteError, setFolderDeleteError] = useState('');
  const [deletingFolder, setDeletingFolder] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchCurrentPage, setSearchCurrentPage] = useState(1);
  const [searchTotalPages, setSearchTotalPages] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [recentDocuments, setRecentDocuments] = useState([]);
  const [recentDocumentsLoading, setRecentDocumentsLoading] = useState(true);
  const [previewFolderId, setPreviewFolderId] = useState(null);
  const [previewDocuments, setPreviewDocuments] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewCurrentPage, setPreviewCurrentPage] = useState(1);
  const [previewTotalPages, setPreviewTotalPages] = useState(1);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [draggedFolderId, setDraggedFolderId] = useState(null);
  const [dropTargetFolderId, setDropTargetFolderId] = useState(null);
  const [moveTarget, setMoveTarget] = useState(null);
  const [moveDestinationId, setMoveDestinationId] = useState('');
  const [moveError, setMoveError] = useState('');
  const [moving, setMoving] = useState(false);
  const [docToRename, setDocToRename] = useState(null);
  const [renameDocName, setRenameDocName] = useState('');
  const [renameDocError, setRenameDocError] = useState('');
  const [renamingDoc, setRenamingDoc] = useState(false);

  const searchQuery = searchParams.get('q')?.trim() || '';
  const folderIdFromUrl = searchParams.get('folderId');

  // Sync URL folderId with Context state
  useEffect(() => {
    if (folderIdFromUrl !== selectedFolderId) {
      selectFolder(folderIdFromUrl);
    }
  }, [folderIdFromUrl, selectFolder, selectedFolderId]);

  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  const runSearch = useCallback(async (keyword, page = 1) => {
    const trimmedKeyword = keyword.trim();

    if (!trimmedKeyword) {
      setSearchResults([]);
      setSearchCurrentPage(1);
      setSearchTotalPages(0);
      setIsSearching(false);
      return;
    }

    try {
      setIsSearching(true);
      const result = await searchDocuments(trimmedKeyword, {
        folderId: selectedFolderId,
        limit: 8,
        page,
      });

      setSearchResults(result.documents || []);
      setSearchCurrentPage(result.currentPage || 1);
      setSearchTotalPages(result.totalPages || 0);
      setError('');
    } catch (requestError) {
      setSearchResults([]);
      setSearchCurrentPage(1);
      setSearchTotalPages(0);
      setError(requestError.response?.data?.message || 'Failed to search documents.');
    } finally {
      setIsSearching(false);
    }
  }, [selectedFolderId]);

  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      setSearchCurrentPage(1);
      setSearchTotalPages(0);
      setIsSearching(false);
      return;
    }

    void runSearch(searchQuery, 1);
  }, [runSearch, searchQuery]);

  const shouldShowRecentDocuments =
    !searchQuery && (!selectedFolderId || selectedFolderId === rootFolder?.id);
  const displayedDocuments = searchQuery ? searchResults : documents;
  const childFolders = searchQuery ? [] : selectedFolder?.children || [];
  const pageError = error || contextError;

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

  const folderTrail = useMemo(() => {
    if (!rootFolder) {
      return [];
    }

    return findFolderTrail([rootFolder], selectedFolderId || rootFolder.id);
  }, [rootFolder, selectedFolderId]);

  const currentScopeLabel = useMemo(() => {
    if (!selectedFolder || selectedFolder.id === rootFolder?.id) {
      return 'Workspace';
    }

    return selectedFolder.name;
  }, [rootFolder?.id, selectedFolder]);

  const isRootScope = !selectedFolderId || selectedFolderId === rootFolder?.id;

  const loadRecentDocuments = useCallback(async () => {
    const recentEntries = getRecentDocumentEntries(12);

    if (recentEntries.length === 0) {
      setRecentDocuments([]);
      setRecentDocumentsLoading(false);
      return;
    }

    try {
      setRecentDocumentsLoading(true);

      const recentResults = await Promise.all(
        recentEntries.map(async (entry) => {
          try {
            const result = await getDocumentDetails(entry.documentId);
            return {
              ...result.document,
              recentOpenedAt: entry.openedAt,
            };
          } catch {
            removeRecentDocument(entry.documentId);
            return null;
          }
        }),
      );

      const filteredDocuments = recentResults
        .filter(Boolean)
        .filter((document) =>
          isRootScope ? true : document.folderId === selectedFolderId,
        )
        .sort(
          (left, right) =>
            Date.parse(right.recentOpenedAt || '') -
            Date.parse(left.recentOpenedAt || ''),
        )
        .slice(0, 8);

      setRecentDocuments(filteredDocuments);
    } finally {
      setRecentDocumentsLoading(false);
    }
  }, [isRootScope, selectedFolderId]);

  useEffect(() => {
    if (searchQuery) {
      setRecentDocumentsLoading(false);
      return;
    }

    void loadRecentDocuments();
  }, [loadRecentDocuments, searchQuery]);

  const previewFolder = useMemo(() => {
    if (!previewFolderId || !rootFolder) {
      return null;
    }

    return findFolderById([rootFolder], previewFolderId);
  }, [previewFolderId, rootFolder]);

  const previewTrail = useMemo(() => {
    if (!previewFolderId || !rootFolder) {
      return [];
    }

    return findFolderTrail([rootFolder], previewFolderId);
  }, [previewFolderId, rootFolder]);

  const activeCurrentPage = searchQuery ? searchCurrentPage : currentPage;
  const activeTotalPages = searchQuery ? searchTotalPages : totalPages;
  const paginationItems = useMemo(
    () => buildPaginationItems(activeCurrentPage, activeTotalPages),
    [activeCurrentPage, activeTotalPages],
  );

  const currentRefreshFolderId = selectedFolderId || rootFolder?.id;

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const nextQuery = searchInput.trim();

    if (!nextQuery) {
      setSearchParams({});
      return;
    }

    setSearchParams({ q: nextQuery });
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchParams({});
  };

  const loadFolderPreview = useCallback(async (folderId, page = 1) => {
    if (!folderId) {
      return;
    }

    try {
      setPreviewLoading(true);
      setPreviewError('');
      const result = await getDocumentsByFolder(folderId, page, 8);
      setPreviewFolderId(folderId);
      setPreviewDocuments(result.documents || []);
      setPreviewCurrentPage(result.currentPage || 1);
      setPreviewTotalPages(result.totalPages || 1);
    } catch (requestError) {
      setPreviewError(
        requestError.response?.data?.message || 'Failed to load folder contents.',
      );
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const syncWorkspace = useCallback(
    async ({ documentsPage = currentPage, previewPage = previewCurrentPage } = {}) => {
      if (currentRefreshFolderId) {
        await refreshFolders(currentRefreshFolderId);
      }

      if (searchQuery) {
        await runSearch(searchQuery, searchCurrentPage);
      } else {
        await refreshDocuments(documentsPage);
        await loadRecentDocuments();
      }

      if (previewFolderId) {
        await loadFolderPreview(previewFolderId, previewPage);
      }
    },
    [
      currentPage,
      currentRefreshFolderId,
      loadFolderPreview,
      previewCurrentPage,
      previewFolderId,
      refreshDocuments,
      refreshFolders,
      loadRecentDocuments,
      runSearch,
      searchCurrentPage,
      searchQuery,
    ],
  );

  const handlePreviewFolder = useCallback(
    (folderId) => {
      void loadFolderPreview(folderId, 1);
    },
    [loadFolderPreview],
  );

  const handleOpenFolder = (folderId) => {
    if (!folderId) {
      setSearchParams({});
      return;
    }

    setSearchParams({ folderId });

    if (searchQuery) {
      // If we were searching, clear search and go to folder
      setSearchParams({ folderId });
    }
  };

  const closePreviewFolder = () => {
    setPreviewFolderId(null);
    setPreviewDocuments([]);
    setPreviewError('');
    setPreviewCurrentPage(1);
    setPreviewTotalPages(1);
  };

  const resetMoveMode = () => {
    setDraggedFolderId(null);
    setDropTargetFolderId(null);
  };



  const handleDownloadDocument = async (documentId, title) => {
    try {
      await downloadDocumentFile(documentId, title);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to download document.');
    }
  };

  const handleUpload = async (file, title, folderId) => {
    await uploadDocument(file, title, folderId || selectedFolderId || rootFolder?.id);
    await syncWorkspace({ documentsPage: 1, previewPage: 1 });
  };

  const handleToggleFavorite = async (documentId) => {
    try {
      await toggleFavorite(documentId);
      setError('');

      if (searchQuery) {
        setSearchResults((current) =>
          current.map((document) =>
            document.id === documentId
              ? { ...document, isFavorite: !document.isFavorite }
              : document,
          ),
        );
      } else {
        await refreshDocuments(currentPage);
        await loadRecentDocuments();
      }

      if (previewFolderId) {
        await loadFolderPreview(previewFolderId, previewCurrentPage);
      }
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || 'Failed to update favorite status.',
      );
    }
  };

  const handleCreateFolder = async () => {
    if (!createName.trim()) {
      setCreateError('Please enter a folder name.');
      return;
    }

    try {
      setCreatingFolder(true);
      await createFolder(createName.trim(), createParentId || rootFolder?.id);
      setShowCreateFolderModal(false);
      setCreateName('');
      setCreateError('');
      await syncWorkspace({ previewPage: 1 });
    } catch (requestError) {
      setCreateError(requestError.response?.data?.message || 'Failed to create folder.');
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleDeleteClick = (document) => {
    setDeleteDoc(document);
    setDeleteError('');
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDoc) {
      return;
    }

    try {
      setDeleting(true);
      await deleteDocument(deleteDoc.id);
      removeRecentDocument(deleteDoc.id);
      setShowDeleteModal(false);
      setDeleteDoc(null);
      setDeleteError('');

      const nextPage =
        !searchQuery && documents.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;

      await syncWorkspace({ documentsPage: nextPage });
    } catch (requestError) {
      setDeleteError(requestError.response?.data?.message || 'Failed to delete document.');
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenRenameFolder = (folder) => {
    setFolderToRename(folder);
    setRenameFolderName(folder.name);
    setRenameFolderError('');
    setOpenMenuId(null);
  };

  const handleRenameFolder = async () => {
    if (!folderToRename) {
      return;
    }

    if (!renameFolderName.trim()) {
      setRenameFolderError('Please enter a folder name.');
      return;
    }

    try {
      setRenamingFolder(true);
      await updateFolder(
        folderToRename.id,
        renameFolderName.trim(),
        folderToRename.parentId || undefined,
      );
      setFolderToRename(null);
      setRenameFolderName('');
      setRenameFolderError('');
      await syncWorkspace();
    } catch (requestError) {
      setRenameFolderError(
        requestError.response?.data?.message || 'Failed to rename folder.',
      );
    } finally {
      setRenamingFolder(false);
    }
  };

  const handleOpenDeleteFolder = (folder) => {
    setFolderToDelete(folder);
    setFolderDeleteError('');
    setOpenMenuId(null);
  };

  const handleDeleteFolderConfirm = async () => {
    if (!folderToDelete) {
      return;
    }

    try {
      setDeletingFolder(true);
      await deleteFolder(folderToDelete.id);
      setFolderToDelete(null);
      setFolderDeleteError('');

      if (previewFolderId === folderToDelete.id) {
        closePreviewFolder();
      }

      await syncWorkspace();
    } catch (requestError) {
      setFolderDeleteError(
        requestError.response?.data?.message || 'Failed to delete folder.',
      );
    } finally {
      setDeletingFolder(false);
    }
  };

  const isValidMoveTarget = useCallback(
    (sourceFolderId, targetFolderId) => {
      if (!sourceFolderId || !targetFolderId || sourceFolderId === targetFolderId || !rootFolder) {
        return false;
      }

      const sourceFolder = findFolderById([rootFolder], sourceFolderId);
      if (!sourceFolder) {
        return false;
      }

      return !findFolderById(sourceFolder.children || [], targetFolderId);
    },
    [rootFolder],
  );

  const handleFolderMove = async (sourceFolderId, targetFolderId) => {
    if (!isValidMoveTarget(sourceFolderId, targetFolderId)) {
      return;
    }

    try {
      setError('');
      await moveFolder(sourceFolderId, targetFolderId);
      resetMoveMode();
      await syncWorkspace();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to move folder.');
      resetMoveMode();
    }
  };

  const handleFolderDragStart = (folderId, event) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', folderId);
    setDraggedFolderId(folderId);
  };

  const handleFolderDragOver = (targetFolderId, event) => {
    const sourceFolderId = draggedFolderId;

    if (!isValidMoveTarget(sourceFolderId, targetFolderId)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTargetFolderId(targetFolderId);
  };

  const handleFolderDrop = (targetFolderId, event) => {
    event.preventDefault();
    const sourceFolderId = draggedFolderId;
    setDropTargetFolderId(null);
    if (sourceFolderId) {
      void handleFolderMove(sourceFolderId, targetFolderId);
    }
  };

  const handleFolderDragEnd = () => {
    setDraggedFolderId(null);
    setDropTargetFolderId(null);
  };

  const handleOpenMoveFolder = (folder) => {
    setMoveTarget({ type: 'folder', id: folder.id, name: folder.name, parentId: folder.parentId });
    setMoveDestinationId(folder.parentId || rootFolder?.id || '');
    setMoveError('');
    setOpenMenuId(null);
  };

  const handleOpenMoveDocument = (document) => {
    setMoveTarget({ type: 'document', id: document.id, name: document.title, folderId: document.folderId });
    setMoveDestinationId(document.folderId || selectedFolderId || rootFolder?.id || '');
    setMoveError('');
    setOpenMenuId(null);
  };

  const handleMoveConfirm = async () => {
    if (!moveTarget || !moveDestinationId) {
      setMoveError('Please select a destination folder.');
      return;
    }

    try {
      setMoving(true);

      if (moveTarget.type === 'folder') {
        await moveFolder(moveTarget.id, moveDestinationId);
      } else {
        await addDocumentToFolder(moveDestinationId, moveTarget.id);
      }

      setMoveTarget(null);
      setMoveDestinationId('');
      setMoveError('');
      await syncWorkspace({ previewPage: 1 });
    } catch (requestError) {
      setMoveError(requestError.response?.data?.message || 'Failed to move item.');
    } finally {
      setMoving(false);
    }
  };

  const handleOpenRenameDocument = (document) => {
    setDocToRename(document);
    setRenameDocName(document.title || '');
    setRenameDocError('');
    setOpenMenuId(null);
  };

  const handleRenameDocument = async () => {
    if (!docToRename) return;

    if (!renameDocName.trim()) {
      setRenameDocError('Please enter a document name.');
      return;
    }

    try {
      setRenamingDoc(true);
      await updateDocumentName(docToRename.id, renameDocName.trim());
      setDocToRename(null);
      setRenameDocName('');
      setRenameDocError('');
      await syncWorkspace();
    } catch (requestError) {
      setRenameDocError(requestError.response?.data?.message || 'Failed to rename document.');
    } finally {
      setRenamingDoc(false);
    }
  };

  return (
    <>
      <div className="mx-auto max-w-[1440px] animate-fade-in pb-12">
        {/* ═══ PREMIUM HERO HEADER ═══ */}
        <div className="relative mb-10 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-8 py-8 shadow-2xl">
          {/* Mesh glow accents */}
          <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-blue-500/15 blur-3xl" />
          <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />

          {/* Breadcrumb inside banner */}
          {folderTrail.length > 1 ? (
            <nav className="mb-4 flex flex-wrap items-center gap-2 text-[11px] font-bold tracking-[0.15em] uppercase text-slate-500">
              {folderTrail.slice(1).map((folder, index) => (
                <span key={folder.id} className="contents">
                  {index > 0 ? <span className="text-slate-600">/</span> : null}
                  <NavLink to={`/app?folderId=${folder.id}`} className="transition-colors hover:text-cyan-400 cursor-pointer">
                    {folder.name}
                  </NavLink>
                </span>
              ))}
            </nav>
          ) : null}

          {/* Title row */}
          <div className="relative z-10 flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-cyan-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                  AI Active
                </span>
              </div>
              <h1 className="text-4xl font-[1000] tracking-tight text-white sm:text-5xl">
                {currentScopeLabel}
              </h1>
              <p className="mt-2 text-[14px] font-medium text-slate-400">
                Manage and organize your documents with{' '}
                <span className="font-bold text-cyan-400">SKS Intelligence</span>.
              </p>

              {/* Inline Stats */}
              <div className="mt-5 flex items-center gap-4">
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-cyan-400">
                    <path d="M3.5 4.75A1.75 1.75 0 0 1 5.25 3h2.44c.464 0 .909.184 1.237.513l1.31 1.31c.14.14.33.219.528.219h4.985A1.75 1.75 0 0 1 17.5 6.792v1.041H2.5V4.75Z" />
                    <path d="M2.5 9.333h15v5.917A1.75 1.75 0 0 1 15.75 17H4.25A1.75 1.75 0 0 1 2.5 15.25V9.333Z" />
                  </svg>
                  <span className="text-[12px] font-black text-white">{childFolders.length}</span>
                  <span className="text-[11px] font-medium text-slate-400">Folders</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-blue-400">
                    <path fillRule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Zm2 6a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H7Z" clipRule="evenodd" />
                  </svg>
                  <span className="text-[12px] font-black text-white">{total}</span>
                  <span className="text-[11px] font-medium text-slate-400">Documents</span>
                </div>
                {recentDocuments.length > 0 ? (
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-emerald-400">
                      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
                    </svg>
                    <span className="text-[12px] font-black text-white">{recentDocuments.length}</span>
                    <span className="text-[11px] font-medium text-slate-400">Recent</span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => setShowCreateFolderModal(true)}
                className="flex items-center gap-2 h-10 px-4 rounded-xl bg-white/10 border border-white/20 text-white text-sm font-bold tracking-wide backdrop-blur-sm hover:bg-white/20 hover:border-white/30 transition-all duration-200"
              >
                <FolderAddIcon className="h-4 w-4 text-cyan-400" />
                New Folder
              </button>
              <button
                type="button"
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 h-10 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-[1000] tracking-wide shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:-translate-y-0.5 transition-all duration-200"
              >
                <UploadIcon className="h-4 w-4" />
                Upload
              </button>
            </div>
          </div>

          {/* Embedded Search */}
          <div className="relative z-10 mt-6">
            <form onSubmit={handleSearchSubmit} className="group relative w-full max-w-xl">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors z-20">
                <SearchIcon className={`h-4 w-4 ${isSearching ? 'animate-pulse' : ''}`} />
              </div>
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search documents..."
                className="h-10 w-full rounded-xl border border-white/10 bg-white/10 pl-10 pr-9 text-sm font-medium text-white placeholder:text-slate-500 backdrop-blur-sm focus:border-cyan-500/50 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all duration-200"
              />
              {searchInput ? (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-slate-400 hover:bg-rose-500/30 hover:text-rose-300 transition-all"
                  title="Clear search"
                >
                  <CloseIcon className="h-3 w-3" />
                </button>
              ) : null}
            </form>
          </div>
        </div>

        {pageError ? (
          <div className="mb-8 rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm font-medium text-rose-700 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-rose-600">!</span>
              {pageError}
            </div>
          </div>
        ) : null}

        <div className="space-y-12">
          {/* Recent Activity */}
          {shouldShowRecentDocuments ? (
            <section>
              <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-[11px] font-[1000] uppercase tracking-[0.2em] text-slate-400">
                  Recent Activity
                </h2>
              </div>
              
              {recentDocumentsLoading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100"></div>
                  ))}
                </div>
              ) : recentDocuments.length > 0 ? (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {recentDocuments.map((doc) => {
                    const type = getDocumentType(doc);
                    return (
                      <div
                        key={doc.id}
                        className="group flex flex-row items-center gap-4 rounded-[20px] border border-white/60 bg-white/60 backdrop-blur-md p-4 text-left shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] transition-all duration-300 hover:-translate-y-1 hover:bg-white hover:border-cyan-100 hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] relative"
                      >
                        <button 
                          type="button"
                          onClick={() => navigate(`/app/documents/${doc.id}`)}
                          className="flex flex-row items-center gap-4 flex-1 min-w-0 outline-none"
                        >
                          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6`}>
                            <span className="text-[10px] font-black tracking-widest">{type.label}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="truncate text-[15px] font-bold text-slate-800 transition-colors group-hover:text-cyan-600">
                              {doc.title}
                            </h4>
                            <p className="mt-1 text-[11px] font-bold tracking-tight text-slate-400">
                              {formatDateLabel(doc.recentOpenedAt)}
                            </p>
                          </div>
                        </button>
                        
                        <div className="shrink-0 flex items-center">
                          <ActionMenu
                            menuId={`recent-${doc.id}`}
                            openMenuId={openMenuId}
                            setOpenMenuId={setOpenMenuId}
                            buttonClassName="h-8 w-8 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors border-none shadow-none bg-transparent"
                            items={[
                              { label: 'Open', icon: <OpenIcon className="h-4 w-4" />, onClick: () => navigate(`/app/documents/${doc.id}`) },
                              { label: 'Rename', icon: <EditIcon className="h-4 w-4" />, onClick: () => handleOpenRenameDocument(doc) },
                              {
                                label: 'Download',
                                icon: <DownloadIcon className="h-4 w-4" />,
                                onClick: () => handleDownloadDocument(doc.id, doc.title),
                              },
                              { label: 'Move to...', icon: <MoveIcon className="h-4 w-4" />, onClick: () => handleOpenMoveDocument(doc) },
                              { label: 'Delete', icon: <TrashIcon className="h-4 w-4" />, onClick: () => handleDeleteClick(doc), danger: true },
                            ]}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-3xl border-2 border-dashed border-sks-slate-200 py-12 text-center">
                  <p className="text-sm font-medium text-sks-slate-400">No recent documents found.</p>
                </div>
              )}
            </section>
          ) : null}

          {/* Folder Section */}
          {childFolders.length > 0 ? (
            <section>
              <div className="mb-5 border-b border-slate-100 pb-3">
                <h2 className="text-[11px] font-[1000] uppercase tracking-[0.2em] text-slate-400">
                  Folders
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {childFolders.map((folder, index) => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    accentClassName={FOLDER_ACCENTS[index % FOLDER_ACCENTS.length]}
                    onOpen={handleOpenFolder}
                    onRename={handleOpenRenameFolder}
                    onDelete={handleOpenDeleteFolder}
                    onMove={handleOpenMoveFolder}
                    isDragging={draggedFolderId === folder.id}
                    isDropTarget={dropTargetFolderId === folder.id}
                    onDragStart={handleFolderDragStart}
                    onDragEnd={handleFolderDragEnd}
                    onDragOver={handleFolderDragOver}
                    onDrop={handleFolderDrop}
                    openMenuId={openMenuId}
                    setOpenMenuId={setOpenMenuId}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {/* Document Section */}
          <section>
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-[11px] font-[1000] uppercase tracking-[0.2em] text-slate-400">
                Library
              </h2>
              {activeTotalPages > 1 ? (
                <span className="text-[11px] font-[1000] uppercase tracking-widest text-slate-400">
                  Page {activeCurrentPage} of {activeTotalPages}
                </span>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-[24px] border border-white/60 bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] px-2 pb-2 pt-1">
              <table className="w-full border-separate border-spacing-0 text-left">
                <thead>
                  <tr>
                    <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200/60">Name</th>
                    <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200/60">Modified</th>
                    {!searchQuery ? (
                      <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200/60">Size</th>
                    ) : null}
                    <th className="px-6 py-5 text-right text-[11px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200/60">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y-0 relative">
                  {documentsLoading || isSearching ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="h-8 w-8 animate-spin rounded-full border-4 border-sks-primary border-t-transparent"></div>
                          <p className="text-sm font-bold text-sks-primary">Syncing with workspace...</p>
                        </div>
                      </td>
                    </tr>
                  ) : displayedDocuments.length > 0 ? (
                    displayedDocuments.map((doc) => (
                      <DocumentRow
                        key={doc.id}
                        document={doc}
                        searchQuery={searchQuery}
                        menuId={`document-${doc.id}`}
                        openMenuId={openMenuId}
                        setOpenMenuId={setOpenMenuId}
                        onOpen={(id) => navigate(`/app/documents/${id}`)}
                        onRename={handleOpenRenameDocument}
                        onToggleFavorite={handleToggleFavorite}
                        onDownload={handleDownloadDocument}
                        onDelete={handleDeleteClick}
                        onMove={handleOpenMoveDocument}
                      />
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-sks-slate-50 text-sks-slate-300">
                            <SearchIcon className="h-8 w-8" />
                          </div>
                          <p className="max-w-xs text-base font-bold text-sks-slate-400">
                            {searchQuery 
                              ? `We couldn't find anything matching "${searchQuery}"`
                              : "This workspace is empty. Start by uploading a document."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {activeTotalPages > 1 ? (
              <div className="mt-8 flex items-center justify-center gap-2">
                {paginationItems.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={item.disabled}
                    onClick={() => {
                      if (item.type === 'page' && typeof item.value === 'number') {
                        if (searchQuery) {
                          void runSearch(searchQuery, item.value);
                        } else {
                          goToPage(item.value);
                        }
                      }
                    }}
                    className={`flex h-9 min-w-[36px] items-center justify-center rounded-lg px-3 text-sm font-bold transition-all ${
                      item.active
                        ? 'bg-cyan-600 text-white shadow-md shadow-cyan-500/20'
                        : item.disabled
                          ? 'cursor-default text-slate-300'
                          : 'bg-white text-slate-600 border border-slate-200 shadow-sm hover:border-cyan-300 hover:text-cyan-600'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </div>

      {/* Modals */}
      {previewFolderId ? (
        <FolderPreviewModal
          currentPage={previewCurrentPage}
          documents={previewDocuments}
          error={previewError}
          folder={previewFolder}
          loading={previewLoading}
          onClose={closePreviewFolder}
          onDeleteDocument={handleDeleteClick}
          onDeleteFolder={handleOpenDeleteFolder}
          onDownloadDocument={handleDownloadDocument}
          onMoveFolder={handleOpenMoveFolder}
          onMoveDocument={handleOpenMoveDocument}
          onRenameDocument={handleOpenRenameDocument}
          onOpenDocument={(id) => navigate(`/app/documents/${id}`)}
          onOpenFolder={handlePreviewFolder}
          onPageChange={(page) => {
            if (previewFolderId) {
              void loadFolderPreview(previewFolderId, page);
            }
          }}
          onRenameFolder={handleOpenRenameFolder}
          onToggleFavoriteDocument={handleToggleFavorite}
          openMenuId={openMenuId}
          setOpenMenuId={setOpenMenuId}
          totalPages={previewTotalPages}
          trail={previewTrail}
          draggedFolderId={draggedFolderId}
          dropTargetFolderId={dropTargetFolderId}
          onFolderDragStart={handleFolderDragStart}
          onFolderDragEnd={handleFolderDragEnd}
          onFolderDragOver={handleFolderDragOver}
          onFolderDrop={handleFolderDrop}
        />
      ) : null}

      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadSuccess={handleUpload}
        folders={folderChoices}
        defaultFolderId={selectedFolderId || rootFolder?.id || ''}
      />

      {showCreateFolderModal ? (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/60 px-6 py-10 pt-28 backdrop-blur-xl"
          onClick={() => setShowCreateFolderModal(false)}
        >
          <div
            className="relative w-full max-w-[620px] rounded-[32px] border border-white/20 bg-white shadow-[0_45px_120px_-20px_rgba(15,23,42,0.5)] overflow-hidden animate-in fade-in zoom-in duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid sm:grid-cols-[0.38fr_0.62fr]">
              {/* ═══ LEFT PANEL: BRANDING ═══ */}
              <div className="relative overflow-hidden bg-gradient-to-br from-cyan-50 via-slate-50 to-blue-50 px-7 py-6 border-r border-slate-100 flex flex-col justify-between">
                {/* Mesh Glows */}
                <div className="absolute -top-10 -left-10 h-32 w-32 rounded-full bg-cyan-400/20 blur-2xl" />
                <div className="absolute top-1/2 -right-10 h-32 w-32 rounded-full bg-blue-400/10 blur-2xl" />

                <div className="relative z-10">
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-600/80">Organization</p>
                  <h2 className="mt-2 text-2xl font-[1000] leading-tight text-slate-900 tracking-tight">
                    New <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">Folder</span>
                  </h2>
                </div>

                <div className="relative z-10 mt-8 flex flex-col gap-2">

                </div>
              </div>

              {/* ═══ RIGHT PANEL: FORM ═══ */}
              <div className="px-7 py-6 sm:px-8">
                <div className="flex items-center justify-between mb-8">
                  <p className="text-[11px] font-[1000] uppercase tracking-[0.2em] text-slate-400">Folder Form</p>
                  <button
                    onClick={() => setShowCreateFolderModal(false)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100/80 text-slate-500 transition-all hover:bg-rose-50 hover:text-rose-600 hover:rotate-90 active:scale-90"
                  >
                    <CloseIcon className="h-5.5 w-5.5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-[1000] uppercase tracking-wider text-slate-400 ml-1.5">Name</label>
                    <input
                      type="text"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-5 py-3.5 text-sm font-bold text-slate-900 outline-none transition-all focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/5 shadow-inner"
                      placeholder="Folder title..."
                      autoFocus
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-[1000] uppercase tracking-wider text-slate-400 ml-1.5">Parent Folder</label>
                    <div className="relative">
                      <select
                        value={createParentId}
                        onChange={(e) => setCreateParentId(e.target.value)}
                        className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 px-5 py-3.5 text-sm font-bold text-slate-900 outline-none transition-all focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/5 cursor-pointer shadow-inner"
                      >
                        {folderChoices.map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {folder.label}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                          <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {createError && (
                    <div className="flex items-center gap-2 rounded-2xl border border-rose-100 bg-rose-50/50 px-4 py-3.5 text-xs font-bold text-rose-600 animate-in slide-in-from-top-2 duration-300">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
                        <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                      </svg>
                      {createError}
                    </div>
                  )}

                  <button
                    onClick={() => void handleCreateFolder()}
                    disabled={creatingFolder}
                    className="group relative w-full overflow-hidden rounded-[20px] bg-slate-900 p-px shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed mt-2"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-500 bg-[length:200%_100%] animate-gradient transition-opacity opacity-0 group-hover:opacity-100" />
                    <div className={`relative flex h-[52px] items-center justify-center rounded-[19px] px-5 text-sm font-[1000] tracking-wide text-white transition-all ${creatingFolder ? 'bg-transparent' : 'bg-gradient-to-r from-cyan-600 to-blue-600'}`}>
                      <span className="drop-shadow-md flex items-center gap-2">
                        {creatingFolder ? (
                          <>
                            <svg className="h-4 w-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Creating...
                          </>
                        ) : (
                          <>
                            Create Folder
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 transition-transform group-hover:translate-x-1">
                              <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
                            </svg>
                          </>
                        )}
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {folderToRename ? (
        <div
          className="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto bg-slate-950/60 px-6 py-10 pt-28 backdrop-blur-xl"
          onClick={() => {
            setFolderToRename(null);
            setRenameFolderError('');
          }}
        >
          <div
            className="relative w-full max-w-[500px] rounded-[32px] border border-white/20 bg-white shadow-[0_45px_120px_-20px_rgba(15,23,42,0.5)] overflow-hidden animate-in fade-in zoom-in duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-8 py-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400">Management</p>
                <h2 className="mt-1 text-xl font-[1000] leading-tight text-white tracking-tight">Rename Folder</h2>
              </div>
              <button
                onClick={() => setFolderToRename(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-slate-300 hover:bg-rose-500/20 hover:text-rose-400 transition-all active:scale-90"
              >
                <CloseIcon className="h-5.5 w-5.5" />
              </button>
            </div>
            
            <div className="px-8 py-8 space-y-6">
              {renameFolderError && (
                <div className="rounded-2xl border border-rose-100 bg-rose-50/50 px-4 py-3.5 text-xs font-bold text-rose-600">
                  {renameFolderError}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-[11px] font-[1000] uppercase tracking-wider text-slate-400 ml-1.5">New folder name</label>
                <input
                  type="text"
                  value={renameFolderName}
                  onChange={(e) => setRenameFolderName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-5 py-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/5 shadow-inner"
                  autoFocus
                />
              </div>
              <button
                onClick={() => void handleRenameFolder()}
                disabled={renamingFolder}
                className="group relative w-full overflow-hidden rounded-[24px] bg-slate-900 p-px shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-500 bg-[length:200%_100%] animate-gradient transition-opacity opacity-0 group-hover:opacity-100" />
                <div className={`relative flex h-[58px] items-center justify-center rounded-[23px] px-5 text-base font-[1000] tracking-wide text-white transition-all ${renamingFolder ? 'bg-transparent' : 'bg-gradient-to-r from-cyan-600 to-blue-600'}`}>
                  {renamingFolder ? 'Updating...' : 'Save Changes'}
                </div>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {folderToDelete ? (
        <ModalShell
          title="Delete Folder"
          onClose={() => {
            setFolderToDelete(null);
            setFolderDeleteError('');
          }}
        >
          <div className="mb-8 rounded-2xl bg-rose-50/50 border border-rose-100 p-6">
            <p className="text-base font-bold text-slate-700 leading-relaxed">
              Are you sure you want to delete <strong className="text-rose-600">{folderToDelete.name}</strong>? 
              <br /><span className="text-sm font-medium text-slate-500 mt-2 block">This will remove all documents and subfolders within it. This action cannot be undone.</span>
            </p>
          </div>

          {folderDeleteError ? (
            <div className="mb-5 rounded-2xl bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700 border border-rose-100">
              {folderDeleteError}
            </div>
          ) : null}

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setFolderToDelete(null)}
              className="flex-1 h-[58px] rounded-2xl border border-slate-200 bg-white text-slate-600 font-[1000] transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-95"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteFolderConfirm()}
              disabled={deletingFolder}
              className="flex-1 h-[58px] rounded-2xl bg-rose-600 text-white font-[1000] shadow-lg shadow-rose-600/20 transition-all hover:bg-rose-700 hover:shadow-rose-600/40 active:scale-95 disabled:opacity-50"
            >
              {deletingFolder ? 'Deleting...' : 'Delete Forever'}
            </button>
          </div>
        </ModalShell>
      ) : null}

      {showDeleteModal ? (
        <ModalShell
          title="Delete Document"
          onClose={() => {
            setShowDeleteModal(false);
            setDeleteError('');
          }}
        >
          <div className="mb-8 rounded-2xl bg-sks-slate-50 p-5">
            <p className="text-base text-sks-slate-600">
              Are you sure you want to delete <strong className="text-sks-slate-900">{deleteDoc?.title || 'this document'}</strong>? 
              This action cannot be undone.
            </p>
          </div>

          {deleteError ? (
            <div className="mb-5 rounded-xl bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">
              {deleteError}
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowDeleteModal(false)}
              className="sks-button-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteConfirm()}
              disabled={deleting}
              className="flex-1 h-[58px] rounded-2xl bg-rose-600 text-white font-[1000] shadow-lg shadow-rose-600/20 transition-all hover:bg-rose-700 hover:shadow-rose-600/40 active:scale-95 disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete Forever'}
            </button>
          </div>
        </ModalShell>
      ) : null}

      {moveTarget ? (
        <div
          className="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto bg-slate-950/60 px-6 py-10 pt-28 backdrop-blur-xl"
          onClick={() => setMoveTarget(null)}
        >
          <div
            className="relative w-full max-w-[620px] rounded-[32px] border border-white/20 bg-white shadow-[0_45px_120px_-20px_rgba(15,23,42,0.5)] overflow-hidden animate-in fade-in zoom-in duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid sm:grid-cols-[0.38fr_0.62fr]">
              {/* ═══ LEFT PANEL ═══ */}
              <div className="relative overflow-hidden bg-gradient-to-br from-cyan-50 via-slate-50 to-blue-50 px-8 py-8 border-r border-slate-100 flex flex-col justify-between">
                <div className="absolute -top-10 -left-10 h-32 w-32 rounded-full bg-cyan-400/20 blur-2xl" />
                <div className="absolute top-1/2 -right-10 h-32 w-32 rounded-full bg-blue-400/10 blur-2xl" />

                <div className="relative z-10">
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-600/80">Relocation</p>
                  <h2 className="mt-4 text-3xl font-[1000] leading-[1.1] text-slate-900 tracking-tight">
                    Move <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">{moveTarget.type === 'folder' ? 'Folder' : 'Asset'}</span>
                  </h2>
                </div>

                <div className="relative z-10 mt-12 flex flex-col gap-3">
                  <div className="rounded-2xl border border-white bg-white/70 px-4 py-3.5 shadow-[0_8px_30px_-5px_rgba(148,163,184,0.15)] backdrop-blur-md">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400/80">Current Selection</p>
                    <p className="mt-1 text-xs font-[1000] text-slate-800 truncate">{moveTarget.name}</p>
                  </div>
                </div>
              </div>

              {/* ═══ RIGHT PANEL ═══ */}
              <div className="px-8 py-8 sm:px-10">
                <div className="flex items-center justify-between mb-8">
                  <p className="text-[11px] font-[1000] uppercase tracking-[0.2em] text-slate-400">Destination</p>
                  <button
                    onClick={() => setMoveTarget(null)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100/80 text-slate-500 transition-all hover:bg-rose-50 hover:text-rose-600 hover:rotate-90 active:scale-90"
                  >
                    <CloseIcon className="h-5.5 w-5.5" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-[1000] uppercase tracking-wider text-slate-400 ml-1.5 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path d="M3.75 3A1.75 1.75 0 0 0 2 4.75v10.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0 0 18 15.25v-8.5A1.75 1.75 0 0 0 16.25 5h-4.836a.25.25 0 0 1-.177-.073L9.823 3.513A1.75 1.75 0 0 0 8.586 3H3.75Z" />
                      </svg>
                      New Location
                    </label>
                    <div className="relative">
                      <select
                        value={moveDestinationId}
                        onChange={(e) => setMoveDestinationId(e.target.value)}
                        className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50/50 px-5 py-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/5 cursor-pointer shadow-inner"
                      >
                        {folderChoices.map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {folder.label}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                          <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {moveError && (
                    <div className="flex items-center gap-2 rounded-2xl border border-rose-100 bg-rose-50/50 px-4 py-3.5 text-xs font-bold text-rose-600 animate-in slide-in-from-top-2 duration-300">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
                        <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                      </svg>
                      {moveError}
                    </div>
                  )}

                  <button
                    onClick={() => void handleMoveConfirm()}
                    disabled={moving}
                    className="group relative w-full overflow-hidden rounded-[24px] bg-slate-900 p-px shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed mt-4"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-500 bg-[length:200%_100%] animate-gradient transition-opacity opacity-0 group-hover:opacity-100" />
                    <div className={`relative flex h-[58px] items-center justify-center rounded-[23px] px-5 text-base font-[1000] tracking-wide text-white transition-all ${moving ? 'bg-transparent' : 'bg-gradient-to-r from-cyan-600 to-blue-600'}`}>
                      <span className="drop-shadow-md flex items-center gap-2">
                        {moving ? (
                          <>
                            <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Relocating...
                          </>
                        ) : (
                          <>
                            Confirm Relocation
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 transition-transform group-hover:translate-x-1">
                              <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
                            </svg>
                          </>
                        )}
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {docToRename ? (
        <div
          className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-slate-950/60 px-6 py-10 pt-28 backdrop-blur-xl"
          onClick={() => {
            setDocToRename(null);
            setRenameDocError('');
          }}
        >
          <div
            className="relative w-full max-w-[500px] rounded-[32px] border border-white/20 bg-white shadow-[0_45px_120px_-20px_rgba(15,23,42,0.5)] overflow-hidden animate-in fade-in zoom-in duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-8 py-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400">Asset Config</p>
                <h2 className="mt-1 text-xl font-[1000] leading-tight text-white tracking-tight">Rename Document</h2>
              </div>
              <button
                onClick={() => setDocToRename(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-slate-300 hover:bg-rose-500/20 hover:text-rose-400 transition-all active:scale-90"
              >
                <CloseIcon className="h-5.5 w-5.5" />
              </button>
            </div>
            
            <div className="px-8 py-8 space-y-6">
              {renameDocError && (
                <div className="rounded-2xl border border-rose-100 bg-rose-50/50 px-4 py-3.5 text-xs font-bold text-rose-600">
                  {renameDocError}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-[11px] font-[1000] uppercase tracking-wider text-slate-400 ml-1.5">New asset title</label>
                <input
                  type="text"
                  value={renameDocName}
                  onChange={(e) => setRenameDocName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-5 py-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/5 shadow-inner"
                  autoFocus
                />
              </div>
              <button
                onClick={() => void handleRenameDocument()}
                disabled={renamingDoc}
                className="group relative w-full overflow-hidden rounded-[24px] bg-slate-900 p-px shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-500 bg-[length:200%_100%] animate-gradient transition-opacity opacity-0 group-hover:opacity-100" />
                <div className={`relative flex h-[58px] items-center justify-center rounded-[23px] px-5 text-base font-[1000] tracking-wide text-white transition-all ${renamingDoc ? 'bg-transparent' : 'bg-gradient-to-r from-cyan-600 to-blue-600'}`}>
                  {renamingDoc ? 'Renaming...' : 'Update Title'}
                </div>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default Dashboard;
