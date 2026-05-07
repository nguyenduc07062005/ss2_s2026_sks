import apiClient from "../services/apiClient.js";

const askDocument = async (
  documentId,
  question,
  mode = "document_assisted",
) => {
  const response = await apiClient.post(`/rag/documents/${documentId}/ask`, {
    question,
    mode,
  });
  return response.data;
};

const getDocumentAskHistory = async (documentId) => {
  const response = await apiClient.get(
    `/rag/documents/${documentId}/ask/history`,
  );
  return response.data;
};

const clearDocumentAskHistory = async (documentId) => {
  const response = await apiClient.delete(
    `/rag/documents/${documentId}/ask/history`,
  );
  return response.data;
};

const getDocumentSummary = async (
  documentId,
  language = "en",
  options = {},
) => {
  const response = await apiClient.post(
    `/rag/documents/${documentId}/summary`,
    {
      language,
      forceRefresh: Boolean(options.forceRefresh),
      slot: options.slot,
      instruction:
        typeof options.instruction === "string"
          ? options.instruction
          : undefined,
    },
  );
  return response.data;
};

const generateQuiz = async (payload) => {
  const response = await apiClient.post("/rag/quiz/generate", payload);
  return response.data;
};

const getQuizChatHistory = async () => {
  const response = await apiClient.get("/rag/quiz/chat/history");
  return response.data;
};

const sendQuizChatMessage = async (payload) => {
  const response = await apiClient.post("/rag/quiz/chat", payload);
  return response.data;
};

const clearQuizChatHistory = async () => {
  const response = await apiClient.delete("/rag/quiz/chat/history");
  return response.data;
};

const getStudyGpsPlan = async () => {
  const response = await apiClient.get("/rag/study-gps");
  return response.data;
};

const generateStudyGpsPlan = async (payload) => {
  const response = await apiClient.post("/rag/study-gps", payload);
  return response.data;
};

const sendStudyGpsDayChat = async (payload) => {
  const response = await apiClient.post("/rag/study-gps/day-chat", payload);
  return response.data;
};

const startStudyGpsDayChat = async (day) => {
  const response = await apiClient.post("/rag/study-gps/day-chat/start", {
    day,
  });
  return response.data;
};

const getStudyGpsDayChatHistory = async (day) => {
  const response = await apiClient.get(
    `/rag/study-gps/day-chat/${day}/history`,
  );
  return response.data;
};

const clearStudyGpsDayChatHistory = async (day) => {
  const response = await apiClient.delete(
    `/rag/study-gps/day-chat/${day}/history`,
  );
  return response.data;
};

const clearStudyGpsPlan = async () => {
  const response = await apiClient.delete("/rag/study-gps");
  return response.data;
};

export {
  askDocument,
  clearQuizChatHistory,
  clearStudyGpsDayChatHistory,
  clearStudyGpsPlan,
  clearDocumentAskHistory,
  generateStudyGpsPlan,
  generateQuiz,
  getDocumentAskHistory,
  getDocumentSummary,
  getQuizChatHistory,
  getStudyGpsDayChatHistory,
  getStudyGpsPlan,
  sendQuizChatMessage,
  sendStudyGpsDayChat,
  startStudyGpsDayChat,
};
