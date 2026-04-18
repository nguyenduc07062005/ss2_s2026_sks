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

const getNarrativeSummaryBody = (summary) => {
  if (
    summary?.format === 'narrative' &&
    typeof summary?.body === 'string' &&
    summary.body.trim()
  ) {
    return normalizeText(summary.body);
  }

  return '';
};

const getSummaryLeadText = (summary) =>
  getNarrativeSummaryBody(summary) || normalizeText(summary?.overview || '');

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

const buildMindMapClusterPreviewSummary = (keyPoints, language) => {
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

const buildSummaryText = (summary) => {
  const narrativeBody = getNarrativeSummaryBody(summary);

  if (narrativeBody) {
    return [summary.title, narrativeBody].filter(Boolean).join('\n\n').trim();
  }

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

const buildSummaryMindMap = (summary, language = 'en') => {
  const leadText = getSummaryLeadText(summary);
  const overviewNode = {
    id: 'overview',
    label: language === 'vi' ? 'Tong quan' : 'Overview',
    summary: truncateText(leadText, 420),
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
    summary: buildMindMapClusterPreviewSummary(
      summary.key_points || [],
      language,
    ),
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
    summary: truncateText(leadText, 420),
    kind: 'root',
    children: [overviewNode, clusterNode, takeawayNode],
  };
};

const buildMindMapFallbackResponse = (summary, requestedLanguage) => {
  const resolvedLanguage = summary.language || requestedLanguage;

  return {
    message: 'Document mind map generated successfully',
    mindMap: buildSummaryMindMap(summary, resolvedLanguage),
    summary: buildSummaryText(summary),
    language: resolvedLanguage,
    generatedAt: summary.generatedAt || new Date().toISOString(),
    cached: Boolean(summary.cached),
    compatibilityMode: true,
  };
};

const askDocument = async (documentId, question) => {
  const response = await apiClient.post(`/rag/documents/${documentId}/ask`, {
    question,
  });
  return response.data;
};

const getDocumentAskHistory = async (documentId) => {
  const response = await apiClient.get(`/rag/documents/${documentId}/ask/history`);
  return response.data;
};

const clearDocumentAskHistory = async (documentId) => {
  const response = await apiClient.delete(`/rag/documents/${documentId}/ask/history`);
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
    slot: options.slot,
    instruction:
      typeof options.instruction === "string" ? options.instruction : undefined,
  });
  return response.data;
};

const getDocumentMindMap = async (
  documentId,
  language = 'en',
  options = {},
) => {
  try {
    const response = await apiClient.post(`/rag/documents/${documentId}/mindmap`, {
      language,
      forceRefresh: Boolean(options.forceRefresh),
    });
    return response.data;
  } catch (error) {
    if (error.response?.status !== 404) {
      throw error;
    }

    const summary = await getDocumentSummary(documentId, language, {
      forceRefresh: options.forceRefresh,
    });

    return buildMindMapFallbackResponse(summary, language);
  }
};

export {
  askDocument,
  clearDocumentAskHistory,
  getDocumentAskHistory,
  getDocumentMindMap,
  getDocumentSummary,
};
