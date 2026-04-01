import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DocumentLibraryPanel, {
  ActionIconButton,
  formatDateLabel,
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

const DocumentViewer = () => {
  const navigate = useNavigate();
  const { documentId } = useParams();
  const [documentData, setDocumentData] = useState(null);
  const [relatedDocuments, setRelatedDocuments] = useState([]);
  const [fileUrl, setFileUrl] = useState('');
  const [contentType, setContentType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!documentId) {
      return undefined;
    }

    let isActive = true;
    let objectUrl = '';

    const loadDocument = async () => {
      try {
        if (isActive) {
          setLoading(true);
        }

        const [documentResult, relatedResult, fileResult] = await Promise.all([
          getDocumentDetails(documentId),
          getRelatedDocuments(documentId, 4),
          fetchDocumentFile(documentId),
        ]);

        objectUrl = URL.createObjectURL(fileResult.blob);

        if (!isActive) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        setDocumentData(documentResult.document);
        setRelatedDocuments(relatedResult.documents || []);
        setFileUrl(objectUrl);
        setContentType(fileResult.contentType || fileResult.blob.type || '');
        setError('');
      } catch (requestError) {
        if (isActive) {
          setDocumentData(null);
          setRelatedDocuments([]);
          setFileUrl('');
          setError(
            requestError.response?.data?.message || 'Failed to load the document viewer.',
          );
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    void loadDocument();

    return () => {
      isActive = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [documentId]);

  const file = useMemo(
    () => getFilePresentation(documentData || { title: '', fileRef: '' }),
    [documentData],
  );

  const canPreview = useMemo(() => {
    const normalizedType = contentType.toLowerCase();
    return (
      normalizedType.includes('pdf') ||
      normalizedType.startsWith('text/') ||
      file.extension === 'pdf' ||
      file.extension === 'txt'
    );
  }, [contentType, file.extension]);

  const handleToggleFavorite = async (id) => {
    try {
      await toggleFavorite(id);
      setDocumentData((current) =>
        current && current.id === id
          ? { ...current, isFavorite: !current.isFavorite }
          : current,
      );
      setRelatedDocuments((current) =>
        current.map((document) =>
          document.id === id
            ? { ...document, isFavorite: !document.isFavorite }
            : document,
        ),
      );
      setError('');
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || 'Failed to update favorite status.',
      );
    }
  };

  const handleOpenRawFile = async () => {
    if (!documentId) {
      return;
    }

    try {
      await openDocumentFile(documentId);
      setError('');
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || 'Failed to open the file.',
      );
    }
  };

  const handleDownloadDocument = async (id, title) => {
    try {
      await downloadDocumentFile(id, title);
      setError('');
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || 'Failed to download document.',
      );
    }
  };

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-[0_22px_50px_rgba(15,23,42,0.06)]">
        <div className="border-b border-slate-200 px-7 py-7 lg:px-10">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to="/app"
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 transition hover:bg-slate-50"
                >
                  Workspace
                </Link>
                {documentData?.folderName ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                    {documentData.folderName}
                  </span>
                ) : null}
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                {documentData?.title || 'Document viewer'}
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-500">
                Review the selected file in a dedicated page, keep it in favorites, and jump to related documents without returning to the workspace list.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ActionIconButton label="Back to workspace" onClick={() => navigate('/app')}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-5 w-5"
                >
                  <path
                    fillRule="evenodd"
                    d="M12.78 15.53a.75.75 0 0 1-1.06 0l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 1 1 1.06 1.06L9.06 10l3.72 3.72a.75.75 0 0 1 0 1.06Z"
                    clipRule="evenodd"
                  />
                </svg>
              </ActionIconButton>
              <ActionIconButton label="Open raw file" onClick={() => void handleOpenRawFile()}>
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
                onClick={() =>
                  void handleDownloadDocument(documentId, documentData?.title)
                }
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
              {documentData ? (
                <ActionIconButton
                  label={documentData.isFavorite ? 'Remove favorite' : 'Add favorite'}
                  onClick={() => void handleToggleFavorite(documentData.id)}
                  tone={documentData.isFavorite ? 'favorite' : 'default'}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill={documentData.isFavorite ? 'currentColor' : 'none'}
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
              ) : null}
            </div>
          </div>
        </div>

        {error ? (
          <div className="mx-6 mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 lg:mx-8">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <svg className="h-10 w-10 animate-spin text-teal-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : documentData ? (
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr),320px]">
            <div className="border-b border-slate-200 p-6 xl:border-b-0 xl:border-r xl:p-8">
              {canPreview && fileUrl ? (
                <iframe
                  title={documentData.title || 'Document preview'}
                  src={fileUrl}
                  className="min-h-[70vh] w-full rounded-[28px] border border-slate-200 bg-slate-50"
                />
              ) : (
                <div className="flex min-h-[70vh] flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
                  <div
                    className={`flex h-16 w-16 items-center justify-center rounded-3xl text-sm font-bold tracking-[0.22em] ${file.accent}`}
                  >
                    {file.label}
                  </div>
                  <p className="mt-5 text-xl font-semibold text-slate-900">
                    Preview not available for this file type
                  </p>
                  <p className="mt-3 max-w-xl text-base leading-7 text-slate-500">
                    Open the raw file in a new tab or download it to inspect the original content.
                  </p>
                </div>
              )}
            </div>

            <aside className="space-y-6 p-6 xl:p-8">
              <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                  File details
                </p>
                <div className="mt-4 space-y-4 text-sm text-slate-600">
                  <div>
                    <p className="font-semibold text-slate-900">Folder</p>
                    <p className="mt-1">{documentData.folderName || 'Workspace'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Size</p>
                    <p className="mt-1">{documentData.formattedFileSize || 'Unknown size'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Created</p>
                    <p className="mt-1">{formatDateLabel(documentData.createdAt)}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Type</p>
                    <p className="mt-1">{file.extension.toUpperCase()}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                  Workflow
                </p>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                  <p>This page is dedicated to reading one document without losing the workspace structure.</p>
                  <p>Search now stays inside the workspace list, while favorites and reading remain separated for a cleaner flow.</p>
                </div>
              </div>
            </aside>
          </div>
        ) : null}
      </section>

      <DocumentLibraryPanel
        title="Related documents"
        summaryLabel={`${relatedDocuments.length} items`}
        description="Use related documents to jump through nearby material without returning to the full workspace list."
        error=""
        loading={loading}
        documents={relatedDocuments}
        emptyTitle="No related documents"
        emptyDescription="Upload more material or add document metadata to improve cross-document discovery."
        onOpenFolder={() => {}}
        onOpenDocument={(id) => navigate(`/app/documents/${id}`)}
        onDownloadDocument={handleDownloadDocument}
        onToggleFavorite={handleToggleFavorite}
        onMoveDocument={null}
        onRenameDocument={null}
        onDeleteDocument={null}
        showFolderContext
      />
    </div>
  );
};

export default DocumentViewer;
