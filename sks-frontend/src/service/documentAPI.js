import apiClient from '../services/apiClient.js';

const uploadDocument = async (file, title, folderId) => {
  const formData = new FormData();
  formData.append('file', file);
  if (title) {
    formData.append('title', title);
  }
  if (folderId) {
    formData.append('folderId', folderId);
  }

  const response = await apiClient.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

const getDocuments = async (page = 1, limit = 10) => {
  const response = await apiClient.get(`/documents?page=${page}&limit=${limit}`);
  return response.data;
};

const deleteDocument = async (documentId) => {
  const response = await apiClient.delete('/documents/delete', {
    data: { documentId },
  });
  return response.data;
};

const toggleFavorite = async (documentId) => {
  const response = await apiClient.post(`/documents/${documentId}/toggle-favorite`);
  return response.data;
};

const getFavorites = async () => {
  const response = await apiClient.get('/documents/favorites');
  return response.data;
};

const searchDocuments = async (query, options = {}) => {
  const normalizedOptions =
    typeof options === 'number' ? { limit: options } : options;
  const response = await apiClient.get('/documents/search', {
    params: {
      q: query,
      limit: normalizedOptions.limit ?? 10,
      page: normalizedOptions.page ?? 1,
      ...(normalizedOptions.folderId ? { folderId: normalizedOptions.folderId } : {}),
    },
  });
  return response.data;
};

const getRelatedDocuments = async (documentId, limit = 6) => {
  const response = await apiClient.get(`/documents/${documentId}/related`, {
    params: { limit },
  });
  return response.data;
};

const getDocumentDetails = async (documentId) => {
  const response = await apiClient.get(`/documents/${documentId}`);
  return response.data;
};

const updateDocumentName = async (documentId, newDocumentName) => {
  const response = await apiClient.patch(`/documents/${documentId}/update-name`, {
    newDocumentName,
  });
  return response.data;
};

const fetchDocumentFile = async (documentId) => {
  const response = await apiClient.get(`/documents/${documentId}/file`, {
    responseType: 'blob',
  });

  return {
    blob: response.data,
    contentType: response.headers['content-type'] || response.data.type || '',
  };
};

const openDocumentFile = async (documentId) => {
  const popup = window.open('', '_blank');

  try {
    const { blob } = await fetchDocumentFile(documentId);
    const objectUrl = URL.createObjectURL(blob);

    if (popup) {
      popup.opener = null;
      popup.location.href = objectUrl;
    } else {
      const link = document.createElement('a');
      link.href = objectUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();
    }

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (error) {
    popup?.close();
    throw error;
  }
};

const downloadDocumentFile = async (documentId, title) => {
  const { blob } = await fetchDocumentFile(documentId);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = objectUrl;
  if (title) {
    link.download = title;
  }

  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
};

export {
  uploadDocument,
  getDocuments,
  deleteDocument,
  toggleFavorite,
  getFavorites,
  searchDocuments,
  getRelatedDocuments,
  getDocumentDetails,
  fetchDocumentFile,
  openDocumentFile,
  downloadDocumentFile,
  updateDocumentName,
};
