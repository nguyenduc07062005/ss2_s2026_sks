export const FOLDER_ACCENTS = [
  'bg-cyan-500',
  'bg-blue-500',
  'bg-sky-500',
  'bg-teal-500',
];

export const findFolderTrail = (folders, targetId, trail = []) => {
  for (const folder of folders) {
    const nextTrail = [...trail, folder];

    if (folder.id === targetId) {
      return nextTrail;
    }

    const nestedTrail = findFolderTrail(folder.children || [], targetId, nextTrail);
    if (nestedTrail.length > 0) {
      return nestedTrail;
    }
  }

  return [];
};

export const findFolderById = (folders, targetId) => {
  for (const folder of folders) {
    if (folder.id === targetId) {
      return folder;
    }

    const nestedFolder = findFolderById(folder.children || [], targetId);
    if (nestedFolder) {
      return nestedFolder;
    }
  }

  return null;
};

export const formatDateLabel = (value) => {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const normalizeReadableText = (value) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';

const getReadableSearchWords = (value) =>
  normalizeReadableText(value)
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase())
    .filter(Boolean);

const isReadableConceptText = (value) => {
  const words = getReadableSearchWords(value);
  const alphabeticWords = words.filter((word) => /[\p{L}]/u.test(word));
  const numericWords = words.filter((word) => /^\d+$/.test(word));

  if (alphabeticWords.length === 0) {
    return false;
  }

  if (words.length > 1 && alphabeticWords.length < 2) {
    return false;
  }

  const uniqueAlphabeticWords = new Set(alphabeticWords);

  if (alphabeticWords.length >= 2 && uniqueAlphabeticWords.size === 1) {
    return false;
  }

  return !(numericWords.length >= 2 && uniqueAlphabeticWords.size < 2);
};

const isReadableSnippetText = (value) => {
  const normalized = normalizeReadableText(value);

  if (!normalized) {
    return false;
  }

  const words = getReadableSearchWords(normalized);
  const alphabeticWords = words.filter((word) => /[\p{L}]/u.test(word));
  const numericWords = words.filter((word) => /^\d+$/.test(word));

  if (alphabeticWords.length < 3) {
    return false;
  }

  const uniqueAlphabeticWords = new Set(alphabeticWords);

  if (numericWords.length >= 2 && uniqueAlphabeticWords.size < 3) {
    return false;
  }

  const repeatedWordCounts = alphabeticWords.reduce((counts, word) => {
    counts.set(word, (counts.get(word) ?? 0) + 1);
    return counts;
  }, new Map());
  const maxRepeatedCount = Math.max(0, ...repeatedWordCounts.values());

  return !(maxRepeatedCount >= 3 && uniqueAlphabeticWords.size <= 2);
};

const formatTopicList = (concepts) => {
  const readableConcepts = (Array.isArray(concepts) ? concepts : [])
    .map((concept) => normalizeReadableText(concept))
    .filter((concept) => concept && isReadableConceptText(concept))
    .slice(0, 2);

  if (readableConcepts.length === 0) {
    return '';
  }

  return readableConcepts.join(', ');
};

const getSnippetTopicText = (snippet) => {
  const normalizedSnippet = normalizeReadableText(snippet || '');

  if (!isReadableSnippetText(normalizedSnippet)) {
    return '';
  }

  const firstSentence = normalizedSnippet.match(/[^.!?]+[.!?]?/u)?.[0] || normalizedSnippet;
  const compactText = normalizeReadableText(firstSentence).replace(/[.?!]+$/u, '');
  const words = compactText.split(/\s+/).filter(Boolean).slice(0, 18);

  return normalizeReadableText(words.join(' '));
};

export const buildSearchTopicText = (document, searchQuery = '') => {
  const conceptText = formatTopicList(document?.matchedConcepts);

  if (conceptText) {
    return conceptText;
  }

  const snippetTopicText = getSnippetTopicText(document?.matchSnippet);

  if (snippetTopicText) {
    return snippetTopicText;
  }

  return normalizeReadableText(searchQuery);
};

export const buildSearchSnippetText = (document) => {
  const normalizedSnippet = normalizeReadableText(document?.matchSnippet || '');

  if (!isReadableSnippetText(normalizedSnippet)) {
    return '';
  }

  const firstSentence =
    normalizedSnippet.match(/[^.!?]+[.!?]?/u)?.[0] || normalizedSnippet;

  return normalizeReadableText(firstSentence);
};

export const buildSearchLocationText = (document) => {
  const sectionTitle = normalizeReadableText(document?.matchSectionTitle || '');
  const pageNumber =
    typeof document?.matchPageNumber === 'number' ? document.matchPageNumber : null;
  const parts = [];

  if (sectionTitle) {
    parts.push(sectionTitle);
  }

  if (pageNumber) {
    parts.push(`Page ${pageNumber}`);
  }

  return parts.join(' · ');
};

export const buildSearchRelevanceLabel = (document) =>
  normalizeReadableText(
    document?.relevanceLabel ||
      (document?.matchType === 'keyword_fallback'
        ? 'Keyword match'
        : document?.matchType === 'semantic'
          ? 'Semantic match'
          : ''),
  );

export const buildSearchMatchTypeLabel = (document) => {
  if (document?.matchType === 'semantic') {
    return 'Semantic match';
  }

  if (document?.matchType === 'keyword_fallback') {
    return 'Keyword fallback';
  }

  return '';
};

export const buildPaginationItems = (currentPage, totalPages) => {
  const visiblePages = [];

  for (let page = 1; page <= totalPages; page += 1) {
    if (page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1) {
      visiblePages.push(page);
    }
  }

  return visiblePages.reduce((items, page, index) => {
    const previousPage = visiblePages[index - 1];

    if (index > 0 && previousPage && page - previousPage > 1) {
      items.push(`gap-${page}`);
    }

    items.push(page);
    return items;
  }, []);
};

const getFileExtension = (value) => {
  const normalized = typeof value === 'string' ? value.trim() : '';

  if (!normalized) {
    return '';
  }

  const sanitized = normalized.split(/[?#]/)[0];
  const lastSegment = sanitized.split(/[\\/]/).pop() || sanitized;

  if (!lastSegment.includes('.')) {
    return '';
  }

  return lastSegment.split('.').pop().toLowerCase();
};

export const getDocumentType = (document) => {
  const extension =
    getFileExtension(document?.title) || getFileExtension(document?.fileRef);

  if (extension === 'pdf') {
    return { label: 'PDF', tone: 'bg-rose-50 text-rose-600' };
  }

  if (extension === 'docx' || extension === 'doc') {
    return { label: 'DOC', tone: 'bg-teal-50 text-teal-700' };
  }

  if (extension === 'pptx' || extension === 'ppt') {
    return { label: 'PPT', tone: 'bg-cyan-50 text-cyan-700' };
  }

  if (extension === 'txt') {
    return { label: 'TXT', tone: 'bg-emerald-50 text-emerald-700' };
  }

  return { label: 'FILE', tone: 'bg-teal-50 text-teal-700' };
};
