import apiClient from "../services/apiClient.js";

const normalizeText = (value = "") => String(value).replace(/\s+/g, " ").trim();

const normalizeMindMapStudyNote = (note) => {
  if (!note || typeof note !== "object") return null;

  const overview = normalizeText(note.overview);
  const explanation = normalizeText(note.explanation);
  const keyPoints = Array.isArray(note.keyPoints)
    ? note.keyPoints.map(normalizeText).filter(Boolean)
    : Array.isArray(note.key_points)
      ? note.key_points.map(normalizeText).filter(Boolean)
      : [];
  const studyFocus = normalizeText(note.studyFocus || note.study_focus);

  if (!overview && !explanation && keyPoints.length === 0 && !studyFocus) {
    return null;
  }

  return {
    overview,
    explanation,
    keyPoints,
    studyFocus,
  };
};

const normalizeMindMapNode = (node, fallbackId = "root") => {
  if (!node || typeof node !== "object") return null;

  const label = normalizeText(node.label);
  const summary = normalizeText(node.summary);
  const children = Array.isArray(node.children)
    ? node.children
        .map((child, index) =>
          normalizeMindMapNode(child, `${fallbackId}-${index + 1}`),
        )
        .filter(Boolean)
    : [];

  if (!label) return null;

  return {
    ...node,
    id: node.id || fallbackId,
    label,
    summary,
    studyNote: normalizeMindMapStudyNote(node.studyNote),
    children,
  };
};

const normalizeMindMapArtifact = (artifact) => {
  if (!artifact || typeof artifact !== "object") return null;

  const root = normalizeMindMapNode(artifact.root, "root");

  if (!root) return null;

  return {
    ...artifact,
    root,
  };
};

const normalizeMindMapResponse = (response) => {
  const mindMap = normalizeMindMapNode(response?.mindMap, "root");
  const versions = Array.isArray(response?.versions)
    ? response.versions.map(normalizeMindMapArtifact).filter(Boolean)
    : [];

  return {
    ...response,
    mindMap,
    versions,
  };
};

const askDocument = async (documentId, question) => {
  const response = await apiClient.post(`/rag/documents/${documentId}/ask`, {
    question,
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

const getDocumentMindMap = async (
  documentId,
  language = "en",
  options = {},
) => {
  const response = await apiClient.post(
    `/rag/documents/${documentId}/mindmap`,
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
  return normalizeMindMapResponse(response.data);
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
  clearStudyGpsDayChatHistory,
  clearStudyGpsPlan,
  clearDocumentAskHistory,
  generateStudyGpsPlan,
  getDocumentAskHistory,
  getDocumentMindMap,
  getDocumentSummary,
  getStudyGpsDayChatHistory,
  getStudyGpsPlan,
  sendStudyGpsDayChat,
  startStudyGpsDayChat,
};
