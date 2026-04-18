const RECENT_DOCUMENTS_STORAGE_KEY = 'sks.recent-documents';
const MAX_RECENT_DOCUMENTS = 20;

const canUseStorage = () => {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.localStorage !== 'undefined'
    );
  } catch {
    return false;
  }
};

const parseRecentDocumentEntries = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  const entriesById = new Map();

  value.forEach((entry) => {
    const documentId =
      typeof entry?.documentId === 'string' ? entry.documentId.trim() : '';
    const openedAt =
      typeof entry?.openedAt === 'string' && !Number.isNaN(Date.parse(entry.openedAt))
        ? entry.openedAt
        : '';

    if (!documentId || !openedAt) {
      return;
    }

    const existingEntry = entriesById.get(documentId);

    if (
      !existingEntry ||
      Date.parse(openedAt) > Date.parse(existingEntry.openedAt)
    ) {
      entriesById.set(documentId, { documentId, openedAt });
    }
  });

  return Array.from(entriesById.values()).sort(
    (left, right) => Date.parse(right.openedAt) - Date.parse(left.openedAt),
  );
};

const saveRecentDocumentEntries = (entries) => {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(
      RECENT_DOCUMENTS_STORAGE_KEY,
      JSON.stringify(entries.slice(0, MAX_RECENT_DOCUMENTS)),
    );
  } catch {
    // Ignore browser storage failures and keep the dashboard usable.
  }
};

const getRecentDocumentEntries = (limit = MAX_RECENT_DOCUMENTS) => {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(RECENT_DOCUMENTS_STORAGE_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];
    return parseRecentDocumentEntries(parsedValue).slice(0, limit);
  } catch {
    return [];
  }
};

const rememberRecentDocument = (documentId) => {
  if (typeof documentId !== 'string' || !documentId.trim()) {
    return [];
  }

  const nextEntry = {
    documentId: documentId.trim(),
    openedAt: new Date().toISOString(),
  };

  const nextEntries = [
    nextEntry,
    ...getRecentDocumentEntries().filter(
      (entry) => entry.documentId !== nextEntry.documentId,
    ),
  ].slice(0, MAX_RECENT_DOCUMENTS);

  saveRecentDocumentEntries(nextEntries);
  return nextEntries;
};

const removeRecentDocument = (documentId) => {
  if (typeof documentId !== 'string' || !documentId.trim()) {
    return [];
  }

  const nextEntries = getRecentDocumentEntries().filter(
    (entry) => entry.documentId !== documentId.trim(),
  );

  saveRecentDocumentEntries(nextEntries);
  return nextEntries;
};

export {
  getRecentDocumentEntries,
  rememberRecentDocument,
  removeRecentDocument,
};
