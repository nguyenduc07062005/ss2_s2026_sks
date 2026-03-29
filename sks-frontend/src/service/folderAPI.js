import apiClient from '../services/apiClient.js';

const getFolders = async () => {
  const response = await apiClient.get('/folders');
  return response.data;
};

const getFolderById = async (folderId) => {
  const response = await apiClient.get(`/folders/${folderId}`);
  return response.data;
};

const createFolder = async (name, parentId) => {
  const payload = { name };

  if (parentId) {
    payload.parentId = parentId;
  }

  const response = await apiClient.post('/folders', payload);
  return response.data;
};

const updateFolder = async (folderId, name, parentId) => {
  const payload = { folderId, name };

  if (parentId) {
    payload.parentId = parentId;
  }

  const response = await apiClient.patch('/folders/update', payload);
  return response.data;
};

const moveFolder = async (folderId, newParentId) => {
  const payload = { folderId };

  if (newParentId) {
    payload.newParentId = newParentId;
  }

  const response = await apiClient.patch('/folders/move', payload);
  return response.data;
};

const deleteFolder = async (folderId) => {
  const response = await apiClient.delete('/folders/delete', {
    data: { folderId },
  });
  return response.data;
};

const getDocumentsByFolder = async (folderId, page = 1, limit = 8) => {
  const response = await apiClient.get(`/folders/${folderId}/documents`, {
    params: { page, limit },
  });
  return response.data;
};

const addDocumentToFolder = async (folderId, documentId) => {
  const response = await apiClient.post('/folders/documents/add', {
    folderId,
    documentId,
  });
  return response.data;
};

const removeDocumentFromFolder = async (folderId, documentId) => {
  const response = await apiClient.delete('/folders/documents/remove', {
    data: { folderId, documentId },
  });
  return response.data;
};

export {
  addDocumentToFolder,
  createFolder,
  deleteFolder,
  getDocumentsByFolder,
  getFolderById,
  getFolders,
  moveFolder,
  removeDocumentFromFolder,
  updateFolder,
};
