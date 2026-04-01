import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DocumentLibraryPanel from '../components/workspace/DocumentLibraryPanel.jsx';
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

  useEffect(() => {
    let isActive = true;

    const loadFavorites = async () => {
      try {
        if (isActive) {
          setLoading(true);
        }

        const result = await getFavorites();
        if (isActive) {
          setDocuments(result.favorites || []);
          setError('');
        }
      } catch (requestError) {
        if (isActive) {
          setDocuments([]);
          setError(
            requestError.response?.data?.message || 'Failed to load favorites.',
          );
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    void loadFavorites();

    return () => {
      isActive = false;
    };
  }, []);

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

  const handleToggleFavorite = async (documentId) => {
    try {
      await toggleFavorite(documentId);
      setDocuments((current) =>
        current.filter((document) => document.id !== documentId),
      );
      setError('');
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || 'Failed to update favorite status.',
      );
    }
  };

  return (
    <DocumentLibraryPanel
      title="Favorites"
      summaryLabel={`${documents.length} saved`}
      description="Keep the documents you return to most often in one place."
      error={error}
      loading={loading}
      documents={documents}
      emptyTitle="No favorites yet"
      emptyDescription="Mark a document as favorite from the workspace or search page to build a quick access list."
      onOpenDocument={handleOpenDocument}
      onDownloadDocument={handleDownloadDocument}
      onToggleFavorite={handleToggleFavorite}
      onMoveDocument={null}
      onRenameDocument={null}
      onDeleteDocument={null}
      onOpenFolder={() => {}}
      showFolderContext
    />
  );
};

export default Favorites;
