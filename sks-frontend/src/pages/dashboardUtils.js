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

export const buildSearchSnippetText = (document) => {
  return normalizeReadableText(document?.matchReason || '');
};

export const buildSearchRelevanceLabel = (document) =>
  normalizeReadableText(document?.matchLabel || '');

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
