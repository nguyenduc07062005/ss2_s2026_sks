import apiClient from '../services/apiClient.js';

const askDocument = async (documentId, question) => {
  const response = await apiClient.post(`/rag/documents/${documentId}/ask`, {
    question,
  });
  return response.data;
};

const getDocumentSummary = async (documentId, language = 'en') => {
  const response = await apiClient.post(`/rag/documents/${documentId}/summary`, { language });
  return response.data;
};

const getDocumentDiagram = async (documentId) => {
  const response = await apiClient.post(`/rag/documents/${documentId}/diagram`);
  return response.data;
};

export {
  askDocument,
  getDocumentDiagram,
  getDocumentSummary,
};
