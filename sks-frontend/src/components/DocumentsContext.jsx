/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getFolders, getDocumentsByFolder } from '../service/folderAPI.js';

const DocumentsContext = createContext(null);
const ITEMS_PER_PAGE = 8;

const findFolderById = (folders, folderId) => {
  for (const folder of folders) {
    if (folder.id === folderId) {
      return folder;
    }

    const childFolder = findFolderById(folder.children || [], folderId);
    if (childFolder) {
      return childFolder;
    }
  }

  return null;
};

const flattenFolders = (folders, depth = 0) =>
  folders.flatMap((folder) => [
    {
      id: folder.id,
      name: folder.name,
      depth,
      parentId: folder.parentId ?? null,
    },
    ...flattenFolders(folder.children || [], depth + 1),
  ]);

export const DocumentsProvider = ({ children }) => {
  const [folders, setFolders] = useState([]);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');

  const rootFolder = useMemo(() => folders[0] || null, [folders]);

  const selectedFolder = useMemo(() => {
    if (!selectedFolderId) {
      return rootFolder;
    }

    return findFolderById(folders, selectedFolderId) || rootFolder;
  }, [folders, rootFolder, selectedFolderId]);

  const folderOptions = useMemo(() => flattenFolders(folders), [folders]);

  const loadFolders = useCallback(async (preferredFolderId = null) => {
    try {
      setFoldersLoading(true);
      const result = await getFolders();
      const nextFolders = result.folders || [];
      const nextRootFolder = nextFolders[0] || null;
      const nextSelectedFolder = preferredFolderId
        ? findFolderById(nextFolders, preferredFolderId)
        : null;

      setFolders(nextFolders);
      setSelectedFolderId(nextSelectedFolder?.id || nextRootFolder?.id || null);
      setError('');
    } catch (err) {
      setFolders([]);
      setSelectedFolderId(null);
      setDocuments([]);
      setTotal(0);
      setCurrentPage(1);
      setTotalPages(1);
      setError(err.response?.data?.message || 'Failed to load folders.');
    } finally {
      setFoldersLoading(false);
    }
  }, []);

  const loadDocuments = useCallback(async (folderId, page = 1) => {
    if (!folderId) {
      setDocuments([]);
      setTotal(0);
      setCurrentPage(1);
      setTotalPages(1);
      setDocumentsLoading(false);
      return;
    }

    try {
      setDocumentsLoading(true);
      const result = await getDocumentsByFolder(folderId, page, ITEMS_PER_PAGE);
      setDocuments(result.documents || []);
      setCurrentPage(result.currentPage || 1);
      setTotalPages(result.totalPages || 1);
      setTotal(result.total || 0);
      setError('');
    } catch (err) {
      setDocuments([]);
      setTotal(0);
      setCurrentPage(1);
      setTotalPages(1);
      setError(err.response?.data?.message || 'Failed to load documents.');
    } finally {
      setDocumentsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    if (!selectedFolderId) {
      setDocumentsLoading(false);
      return;
    }

    void loadDocuments(selectedFolderId, 1);
  }, [loadDocuments, selectedFolderId]);

  const selectFolder = useCallback((folderId) => {
    setSelectedFolderId(folderId);
  }, []);

  const refreshFolders = useCallback(
    async (preferredFolderId = selectedFolderId) => {
      await loadFolders(preferredFolderId);
    },
    [loadFolders, selectedFolderId],
  );

  const refreshDocuments = useCallback(
    async (page = currentPage) => {
      await loadDocuments(selectedFolderId, page);
    },
    [currentPage, loadDocuments, selectedFolderId],
  );

  const goToPage = useCallback(
    async (page) => {
      await loadDocuments(selectedFolderId, page);
    },
    [loadDocuments, selectedFolderId],
  );

  const value = useMemo(
    () => ({
      folders,
      foldersLoading,
      rootFolder,
      folderOptions,
      selectedFolder,
      selectedFolderId,
      selectFolder,
      refreshFolders,
      documents,
      documentsLoading,
      total,
      currentPage,
      totalPages,
      refreshDocuments,
      goToPage,
      itemsPerPage: ITEMS_PER_PAGE,
      error,
      setError,
    }),
    [
      currentPage,
      documents,
      documentsLoading,
      error,
      folderOptions,
      folders,
      foldersLoading,
      goToPage,
      refreshDocuments,
      refreshFolders,
      rootFolder,
      selectFolder,
      selectedFolder,
      selectedFolderId,
      total,
      totalPages,
    ],
  );

  return (
    <DocumentsContext.Provider value={value}>
      {children}
    </DocumentsContext.Provider>
  );
};

export const useDocumentsContext = () => {
  const context = useContext(DocumentsContext);

  if (!context) {
    throw new Error(
      'useDocumentsContext must be used inside a DocumentsProvider',
    );
  }

  return context;
};
