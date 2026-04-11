import apiClient from '../services/apiClient.js';

const normalizeText = (value = '') => String(value).replace(/\s+/g, ' ').trim();

const truncateText = (value, maxLength) => {
  const normalizedValue = normalizeText(value);

  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  const roughSlice = normalizedValue.slice(0, maxLength).trimEnd();
  const lastWordBoundary = roughSlice.lastIndexOf(' ');
  const safeSlice =
    lastWordBoundary > Math.floor(maxLength / 2)
      ? roughSlice.slice(0, lastWordBoundary)
      : roughSlice;

  return `${safeSlice}...`;
};

const buildMindMapInsightLabel = (point) => {
  const normalizedPoint = normalizeText(point).replace(/^[-*]\s*/, '');
  const condensedLabel = normalizedPoint.split(/\s+/).slice(0, 6).join(' ');

  return truncateText(condensedLabel || normalizedPoint, 44);
};

const buildMindMapClusterSummary = (keyPoints, language) => {
  if (!Array.isArray(keyPoints) || keyPoints.length === 0) {
    return language === 'vi'
      ? 'Khong co y chinh nao duoc trich xuat tu tai lieu.'
      : 'No key ideas were extracted from the document.';
  }

  return language === 'vi'
    ? `${keyPoints.length} y chinh duoc tong hop tu noi dung tai lieu.`
    : `${keyPoints.length} key ideas synthesized from the document content.`;
};

const buildMindMapClusterStudySummary = (keyPoints, language) => {
  const baseSummary = buildMindMapClusterSummary(keyPoints, language);
  const previewPoints = (keyPoints || [])
    .slice(0, 2)
    .map((point) => normalizeText(point))
    .filter(Boolean);

  if (previewPoints.length === 0) {
    return baseSummary;
  }

  const previewLabel = language === 'vi'
    ? `Trong do noi bat: ${previewPoints.join(' ')}`
    : `Most important ideas: ${previewPoints.join(' ')}`;

  return truncateText(`${baseSummary} ${previewLabel}`, 320);
};

const buildSummaryPlainText = (summary) => {
  const sections = [
    summary.title,
    summary.overview,
    'Key points:',
    ...(Array.isArray(summary.key_points)
      ? summary.key_points.map((point) => `- ${point}`)
      : []),
    'Conclusion:',
    summary.conclusion,
  ];

  return sections.join('\n').trim();
};

const buildMindMapFromSummary = (summary, language = 'en') => {
  const overviewNode = {
    id: 'overview',
    label: language === 'vi' ? 'Tong quan' : 'Overview',
    summary: truncateText(summary.overview, 420),
    kind: 'overview',
    children: [],
  };
  const insightNodes = (summary.key_points || []).map((point, index) => {
    return {
      id: `insight-${index + 1}`,
      label: buildMindMapInsightLabel(point),
      summary: truncateText(point, 320),
      kind: 'insight',
      children: [],
    };
  });
  const clusterNode = {
    id: 'key-ideas',
    label: language === 'vi' ? 'Y chinh' : 'Key ideas',
    summary: buildMindMapClusterStudySummary(summary.key_points || [], language),
    kind: 'cluster',
    children: insightNodes,
  };
  const takeawayNode = {
    id: 'takeaway',
    label: language === 'vi' ? 'Ket luan' : 'Takeaway',
    summary: truncateText(summary.conclusion, 320),
    kind: 'takeaway',
    children: [],
  };

  return {
    id: 'root',
    label: truncateText(summary.title, 56),
    summary: truncateText(summary.overview, 420),
    kind: 'root',
    children: [overviewNode, clusterNode, takeawayNode],
  };
};

const askDocument = async (documentId, question) => {
  const response = await apiClient.post(`/rag/documents/${documentId}/ask`, {
    question,
  });
  return response.data;
};

const getDocumentSummary = async (
  documentId,
  language = 'en',
  options = {},
) => {
  const response = await apiClient.post(`/rag/documents/${documentId}/summary`, {
    language,
    forceRefresh: Boolean(options.forceRefresh),
  });
  return response.data;
};

const getDocumentMindMap = async (documentId, language = 'en') => {
  try {
    const response = await apiClient.post(`/rag/documents/${documentId}/mindmap`, { language });
    return response.data;
  } catch (error) {
    if (error.response?.status !== 404) {
      throw error;
    }

    const summary = await getDocumentSummary(documentId, language);

    return {
      message: 'Document mind map generated successfully',
      mindMap: buildMindMapFromSummary(summary, summary.language || language),
      summary: buildSummaryPlainText(summary),
      language: summary.language || language,
      generatedAt: summary.generatedAt || new Date().toISOString(),
      cached: Boolean(summary.cached),
      compatibilityMode: true,
    };
  }
};

const getDocumentDiagram = async (documentId) => {
  const response = await apiClient.post(`/rag/documents/${documentId}/diagram`);
  return response.data;
};

export {
  askDocument,
  getDocumentMindMap,
  getDocumentDiagram,
  getDocumentSummary,
};
