/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  const documentsRequestRef = useRef(0);

  const rootFolder = useMemo(() => folders[0] || null, [folders]);
  const activeFolderId = useMemo(
    () => selectedFolderId || rootFolder?.id || null,
    [rootFolder?.id, selectedFolderId],
  );

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
      const nextSelectedFolderId =
        nextSelectedFolder && nextSelectedFolder.id !== nextRootFolder?.id
          ? nextSelectedFolder.id
          : null;

      setFolders(nextFolders);
      setSelectedFolderId(nextSelectedFolderId);
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
    const requestId = documentsRequestRef.current + 1;
    documentsRequestRef.current = requestId;

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

      if (requestId !== documentsRequestRef.current) {
        return;
      }

      setDocuments(result.documents || []);
      setCurrentPage(result.currentPage || 1);
      setTotalPages(result.totalPages || 1);
      setTotal(result.total || 0);
      setError('');
    } catch (err) {
      if (requestId !== documentsRequestRef.current) {
        return;
      }

      setDocuments([]);
      setTotal(0);
      setCurrentPage(1);
      setTotalPages(1);
      setError(err.response?.data?.message || 'Failed to load documents.');
    } finally {
      if (requestId === documentsRequestRef.current) {
        setDocumentsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    void loadDocuments(activeFolderId, 1);
  }, [activeFolderId, loadDocuments]);

  const selectFolder = useCallback((folderId) => {
    setSelectedFolderId(folderId);
  }, []);

  const refreshFolders = useCallback(
    async (preferredFolderId = activeFolderId) => {
      await loadFolders(preferredFolderId);
    },
    [activeFolderId, loadFolders],
  );

  const refreshDocuments = useCallback(
    async (page = currentPage) => {
      await loadDocuments(activeFolderId, page);
    },
    [activeFolderId, currentPage, loadDocuments],
  );

  const goToPage = useCallback(
    async (page) => {
      await loadDocuments(activeFolderId, page);
    },
    [activeFolderId, loadDocuments],
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
