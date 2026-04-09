/* eslint-disable react-refresh/only-export-components */

const FILE_ACCENTS = {
  pdf: 'bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-200',
  doc: 'bg-sky-100 text-sky-700 ring-1 ring-inset ring-sky-200',
  docx: 'bg-sky-100 text-sky-700 ring-1 ring-inset ring-sky-200',
  txt: 'bg-slate-200 text-slate-700 ring-1 ring-inset ring-slate-300',
  xls: 'bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  xlsx: 'bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  ppt: 'bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200',
  pptx: 'bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200',
};

export const getFileExtension = (doc) => {
  const source = doc?.title || doc?.fileRef || '';
  const parts = source.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : 'file';
};

export const getFilePresentation = (doc) => {
  const extension = getFileExtension(doc);

  return {
    label: extension === 'file' ? 'FILE' : extension.slice(0, 4).toUpperCase(),
    accent: FILE_ACCENTS[extension] || 'bg-slate-200 text-slate-700 ring-1 ring-inset ring-slate-300',
    extension,
  };
};

export const formatDateLabel = (value) => {
  if (!value) {
    return 'No date';
  }

  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return 'No date';
  }
};

export const ActionIconButton = ({
  label,
  onClick,
  children,
  tone = 'default',
  disabled = false,
}) => {
  const tones = {
    default:
      'border-[var(--sks-border)] bg-white text-[var(--sks-text-soft)] hover:border-[var(--sks-teal-soft)] hover:bg-[var(--sks-surface)] hover:text-[var(--sks-teal-deep)]',
    favorite:
      'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100',
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
      className={`flex h-11 w-11 items-center justify-center rounded-[20px] border transition disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]}`}
    >
      {children}
    </button>
  );
};

export const ModalShell = ({ title, children, onClose }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm"
    onClick={onClose}
  >
    <div
      className="w-full max-w-lg rounded-[32px] border border-[var(--sks-border)] bg-white p-8 shadow-[0_40px_120px_rgba(9,30,27,0.18)]"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="sks-kicker">Document Action</p>
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
      <div className="mt-6">{children}</div>
    </div>
  </div>
);

const ChildFolderRow = ({ folder, onOpenFolder }) => (
  <button
    key={folder.id}
    type="button"
    onClick={() => onOpenFolder(folder.id)}
    className="group flex w-full items-center justify-between gap-5 rounded-[28px] border border-[var(--sks-border)] bg-[var(--sks-surface)] px-5 py-5 text-left shadow-[0_12px_34px_rgba(9,30,27,0.04)] transition hover:-translate-y-0.5 hover:border-[var(--sks-teal-soft)] hover:bg-white"
  >
    <div className="flex min-w-0 items-start gap-4">
      <div className="mt-0.5 flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-200">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-6 w-6"
        >
          <path d="M3.75 5.25A2.25 2.25 0 0 1 6 3h3.21c.596 0 1.17.237 1.591.659l1.54 1.54a.75.75 0 0 0 .53.22H18A2.25 2.25 0 0 1 20.25 7.5v8.25A2.25 2.25 0 0 1 18 18H6a2.25 2.25 0 0 1-2.25-2.25V5.25Z" />
        </svg>
      </div>

      <div className="min-w-0">
        <p className="truncate text-xl font-semibold text-[var(--sks-text)]">
          {folder.name}
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--sks-text-soft)]">
          Open folder and continue working in context.
        </p>
      </div>
    </div>

    <div className="hidden h-12 w-12 items-center justify-center rounded-[20px] border border-[var(--sks-border)] bg-white text-[var(--sks-text-soft)] transition group-hover:border-[var(--sks-teal-soft)] group-hover:text-[var(--sks-teal-deep)] sm:flex">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-5 w-5"
      >
        <path
          fillRule="evenodd"
          d="M7.22 14.78a.75.75 0 0 1 0-1.06L10.94 10 7.22 6.28a.75.75 0 0 1 1.06-1.06l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0Z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  </button>
);

const DocumentRow = ({
  doc,
  onOpenDocument,
  onDownloadDocument,
  onToggleFavorite,
  onRenameDocument,
  onDeleteDocument,
  onMoveDocument,
  contextLabel,
}) => {
  const file = getFilePresentation(doc);

  return (
    <article className="rounded-[28px] border border-[var(--sks-border)] bg-white px-5 py-5 shadow-[0_12px_34px_rgba(9,30,27,0.04)] transition hover:-translate-y-0.5 hover:border-[var(--sks-teal-soft)]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div
            className={`mt-0.5 flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] text-sm font-bold tracking-[0.22em] ${file.accent}`}
          >
            {file.label}
          </div>

          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => onOpenDocument(doc.id)}
              className="truncate text-left text-xl font-semibold text-[var(--sks-text)] transition hover:text-[var(--sks-teal-deep)]"
            >
              {doc.title || 'Untitled document'}
            </button>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sks-text-soft)]">
              <span className="sks-pill bg-[var(--sks-surface)] text-[var(--sks-text-soft)]">
                {doc.formattedFileSize || 'Unknown size'}
              </span>
              <span className="sks-pill bg-[var(--sks-surface)] text-[var(--sks-text-soft)]">
                {formatDateLabel(doc.createdAt)}
              </span>
              {contextLabel ? (
                <span className="sks-pill bg-teal-50 text-[var(--sks-teal-deep)]">
                  {contextLabel}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 xl:justify-end">
          <ActionIconButton
            label="Open document"
            onClick={() => onOpenDocument(doc.id)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path d="M10 3c4.613 0 8.28 2.99 9.543 6.322a1.75 1.75 0 0 1 0 1.356C18.28 14.01 14.613 17 10 17c-4.613 0-8.28-2.99-9.543-6.322a1.75 1.75 0 0 1 0-1.356C1.72 5.99 5.387 3 10 3Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" />
            </svg>
          </ActionIconButton>
          <ActionIconButton
            label="Download document"
            onClick={() => onDownloadDocument(doc.id, doc.title)}
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
          </ActionIconButton>
          <ActionIconButton
            label={doc.isFavorite ? 'Remove favorite' : 'Add favorite'}
            onClick={() => onToggleFavorite(doc.id)}
            tone={doc.isFavorite ? 'favorite' : 'default'}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill={doc.isFavorite ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m9.049 2.927.951 1.927.951-1.927a1 1 0 0 1 1.793 0l1.28 2.594 2.863.416a1 1 0 0 1 .554 1.706l-2.072 2.02.49 2.852a1 1 0 0 1-1.451 1.054L10 12.347l-2.559 1.346A1 1 0 0 1 6 12.639l.49-2.852-2.072-2.02a1 1 0 0 1 .554-1.706l2.863-.416 1.28-2.594a1 1 0 0 1 1.793 0Z"
              />
            </svg>
          </ActionIconButton>
          {onMoveDocument ? (
            <ActionIconButton
              label="Move document"
              onClick={() => onMoveDocument(doc)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path
                  fillRule="evenodd"
                  d="M10.25 3a.75.75 0 0 1 .75.75v3.69l1.72-1.72a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06L9.5 7.44V3.75A.75.75 0 0 1 10.25 3ZM4 11.75A2.75 2.75 0 0 1 6.75 9h6.5A2.75 2.75 0 0 1 16 11.75v1.5A2.75 2.75 0 0 1 13.25 16h-6.5A2.75 2.75 0 0 1 4 13.25v-1.5Z"
                  clipRule="evenodd"
                />
              </svg>
            </ActionIconButton>
          ) : null}
          {onRenameDocument ? (
            <ActionIconButton
              label="Rename document"
              onClick={() => onRenameDocument(doc)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path d="m13.879 2.697 3.424 3.424a1.5 1.5 0 0 1 0 2.121l-8.264 8.264a4.5 4.5 0 0 1-1.897 1.11l-2.685.806a.75.75 0 0 1-.93-.93l.806-2.685a4.5 4.5 0 0 1 1.11-1.897l8.264-8.264a1.5 1.5 0 0 1 2.121 0Z" />
              </svg>
            </ActionIconButton>
          ) : null}
          {onDeleteDocument ? (
            <ActionIconButton
              label="Delete document"
              onClick={() => onDeleteDocument(doc)}
              tone="danger"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path
                  fillRule="evenodd"
                  d="M8.75 3a1.75 1.75 0 0 0-1.75 1.75V5H4.75a.75.75 0 0 0 0 1.5h.318l.764 9.167A2.25 2.25 0 0 0 8.074 17.75h3.852a2.25 2.25 0 0 0 2.242-2.083l.764-9.167h.318a.75.75 0 0 0 0-1.5H13V4.75A1.75 1.75 0 0 0 11.25 3h-2.5ZM11.5 5v-.25a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25V5h3Z"
                  clipRule="evenodd"
                />
              </svg>
            </ActionIconButton>
          ) : null}
        </div>
      </div>
    </article>
  );
};

export const LoadingState = () => (
  <div className="flex flex-col items-center justify-center py-24 text-center">
    <svg className="h-10 w-10 animate-spin text-[var(--sks-teal)]" fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
    <p className="mt-5 text-sm font-semibold uppercase tracking-[0.22em] text-[var(--sks-text-soft)]">
      Loading library
    </p>
  </div>
);

const EmptyState = ({ title, description, code = 'DOCS' }) => (
  <div className="px-8 py-24 text-center lg:px-10">
    <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[28px] bg-[var(--sks-surface)] text-sm font-extrabold tracking-[0.3em] text-[var(--sks-text-soft)] ring-1 ring-inset ring-[var(--sks-border)]">
      {code}
    </div>
    <p className="mt-6 text-lg font-semibold text-[var(--sks-text)]">{title}</p>
    {description ? (
      <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-[var(--sks-text-soft)]">
        {description}
      </p>
    ) : null}
  </div>
);

const DocumentLibraryPanel = ({
  title,
  summaryLabel,
  description,
  actions,
  error,
  loading,
  childFolders = [],
  documents = [],
  emptyTitle,
  emptyDescription,
  pagination = null,
  onOpenFolder,
  onOpenDocument,
  onDownloadDocument,
  onToggleFavorite,
  onMoveDocument,
  onRenameDocument,
  onDeleteDocument,
  showFolderContext = false,
}) => {
  const hasVisibleContent = childFolders.length > 0 || documents.length > 0;

  return (
    <section className="sks-card overflow-hidden">
      <div className="border-b border-[var(--sks-border)] bg-[linear-gradient(180deg,rgba(247,251,249,0.94)_0%,rgba(255,255,255,0.98)_100%)] px-6 py-6 lg:px-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-['Fraunces'] text-3xl font-semibold tracking-tight text-[var(--sks-text)] sm:text-4xl">
                {title}
              </h1>
              {summaryLabel ? (
                <span className="sks-pill bg-[var(--sks-surface)] text-[var(--sks-text-soft)]">
                  {summaryLabel}
                </span>
              ) : null}
            </div>
            {description ? (
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--sks-text-soft)] sm:text-base">
                {description}
              </p>
            ) : null}
          </div>

          {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
        </div>
      </div>

      {error ? (
        <div className="mx-6 mt-6 rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 lg:mx-8">
          {error}
        </div>
      ) : null}

      {loading ? (
        <LoadingState />
      ) : !hasVisibleContent ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="px-5 py-5 lg:px-6">
          <div className="space-y-4">
            {childFolders.map((folder) => (
              <ChildFolderRow key={folder.id} folder={folder} onOpenFolder={onOpenFolder} />
            ))}

            {documents.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                contextLabel={showFolderContext ? doc.folderName : null}
                onOpenDocument={onOpenDocument}
                onDownloadDocument={onDownloadDocument}
                onToggleFavorite={onToggleFavorite}
                onMoveDocument={onMoveDocument}
                onRenameDocument={onRenameDocument}
                onDeleteDocument={onDeleteDocument}
              />
            ))}
          </div>

          {pagination && pagination.totalPages > 1 ? (
            <div className="mt-6 flex flex-col gap-4 rounded-[28px] border border-[var(--sks-border)] bg-[var(--sks-surface)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[var(--sks-text-soft)]">
                Page {pagination.currentPage} of {pagination.totalPages}
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={pagination.onPrevious}
                  disabled={pagination.currentPage <= 1}
                  className="sks-button-secondary px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={pagination.onNext}
                  disabled={pagination.currentPage >= pagination.totalPages}
                  className="sks-button-secondary px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
};

export default DocumentLibraryPanel;
