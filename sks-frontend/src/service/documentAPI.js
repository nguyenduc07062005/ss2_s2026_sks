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

const searchDocuments = async (query, limit = 10) => {
  const response = await apiClient.get('/documents/search', {
    params: { q: query, limit },
  });
  return response.data;
};

const getRelatedDocuments = async (documentId, limit = 6) => {
  const response = await apiClient.get(`/documents/${documentId}/related`, {
    params: { limit },
  });
  return response.data;
};

const getDocumentFile = (documentId) => {
  return `${apiClient.defaults.baseURL}/documents/${documentId}/file`;
};

const updateDocumentName = async (documentId, newDocumentName) => {
  const response = await apiClient.patch(`/documents/${documentId}/update-name`, {
    newDocumentName,
  });
  return response.data;
};

export {
  uploadDocument,
  getDocuments,
  deleteDocument,
  toggleFavorite,
  getFavorites,
  searchDocuments,
  getRelatedDocuments,
  getDocumentFile,
  updateDocumentName,
};
