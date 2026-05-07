/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const VIEWER_SESSION_STORAGE_KEY = 'sks.documentViewer.sessions.v1';

const createSummaryState = () => ({
  loading: false,
  error: '',
  data: null,
});

const createAskHistoryState = () => ({
  loading: false,
  error: '',
  items: [],
  loaded: false,
  clearing: false,
});

const createAskState = () => ({
  loading: false,
  error: '',
  pendingQuestion: '',
});

const createNoteState = () => ({
  loading: false,
  saving: false,
  error: '',
  notes: [],
  activeNoteId: null,
  title: 'Study Note',
  savedTitle: 'Study Note',
  content: '',
  savedContent: '',
  updatedAt: null,
  loaded: false,
});

const createDocumentViewerSession = () => ({
  activeTab: 'summary',
  sidebarOpen: true,
  sidebarWidth: 580,
  summaryState: createSummaryState(),
  selectedLanguage: 'en',
  isSummaryModalOpen: false,
  isSummaryHistoryOpen: false,
  isSummaryRefreshConfirmOpen: false,
  summaryInstructionDraft: '',
  summaryInstructionError: '',
  selectedSummarySlot: null,
  askQuestion: '',
  askHistoryState: createAskHistoryState(),
  askState: createAskState(),
  noteState: createNoteState(),
  isNoteHistoryOpen: false,
  isNoteTitleModalOpen: false,
  noteTitleDraft: '',
  aiPanelScrollTopByTab: {},
});

const resolveNextValue = (nextValue, previousValue) =>
  typeof nextValue === 'function' ? nextValue(previousValue) : nextValue;

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const normalizeHydratedSession = (session) => {
  const fallback = createDocumentViewerSession();

  if (!isPlainObject(session)) {
    return fallback;
  }

  return {
    ...fallback,
    ...session,
    summaryState: {
      ...fallback.summaryState,
      ...(isPlainObject(session.summaryState) ? session.summaryState : {}),
      loading: false,
    },
    askHistoryState: {
      ...fallback.askHistoryState,
      ...(isPlainObject(session.askHistoryState)
        ? session.askHistoryState
        : {}),
      loading: false,
      clearing: false,
    },
    askState: {
      ...fallback.askState,
      ...(isPlainObject(session.askState) ? session.askState : {}),
      loading: false,
      pendingQuestion: '',
    },
    noteState: {
      ...fallback.noteState,
      ...(isPlainObject(session.noteState) ? session.noteState : {}),
      loading: false,
      saving: false,
    },
    aiPanelScrollTopByTab: isPlainObject(session.aiPanelScrollTopByTab)
      ? session.aiPanelScrollTopByTab
      : fallback.aiPanelScrollTopByTab,
  };
};

const loadStoredViewerSessions = () => {
  try {
    const rawValue = window.sessionStorage.getItem(VIEWER_SESSION_STORAGE_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : {};

    if (!isPlainObject(parsedValue)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsedValue).map(([documentId, session]) => [
        documentId,
        normalizeHydratedSession(session),
      ]),
    );
  } catch {
    return {};
  }
};

const serializeViewerSessions = (viewerSessions) =>
  Object.fromEntries(
    Object.entries(viewerSessions).map(([documentId, session]) => [
      documentId,
      normalizeHydratedSession(session),
    ]),
  );

const DocViewerContext = createContext({
  docInfo: null,
  setDocInfo: () => {},
  docActions: null,
  setDocActions: () => {},
  viewerSessions: {},
  updateDocumentViewerSession: () => {},
});

export const DocViewerProvider = ({ children }) => {
  const [docInfo, setDocInfo] = useState(null);
  const [docActions, setDocActions] = useState(null);
  const [viewerSessions, setViewerSessions] = useState(loadStoredViewerSessions);

  const clearDocViewer = useCallback(() => {
    setDocInfo(null);
    setDocActions(null);
  }, []);

  const updateDocumentViewerSession = useCallback((documentId, updater) => {
    if (!documentId) return;

    setViewerSessions((currentSessions) => {
      const currentSession =
        currentSessions[documentId] || createDocumentViewerSession();
      const nextSession =
        typeof updater === 'function'
          ? updater(currentSession)
          : { ...currentSession, ...updater };

      if (nextSession === currentSession) {
        return currentSessions;
      }

      return {
        ...currentSessions,
        [documentId]: nextSession,
      };
    });
  }, []);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        VIEWER_SESSION_STORAGE_KEY,
        JSON.stringify(serializeViewerSessions(viewerSessions)),
      );
    } catch {
      // Ignore private browsing or quota failures; in-memory state still works.
    }
  }, [viewerSessions]);

  const value = useMemo(
    () => ({
      docInfo,
      setDocInfo,
      docActions,
      setDocActions,
      clearDocViewer,
      viewerSessions,
      updateDocumentViewerSession,
    }),
    [
      clearDocViewer,
      docActions,
      docInfo,
      updateDocumentViewerSession,
      viewerSessions,
    ],
  );

  return (
    <DocViewerContext.Provider value={value}>
      {children}
    </DocViewerContext.Provider>
  );
};

export const useDocViewer = () => useContext(DocViewerContext);

export const useDocumentViewerSession = (documentId) => {
  const { viewerSessions, updateDocumentViewerSession } =
    useContext(DocViewerContext);

  const session = useMemo(() => {
    if (!documentId) {
      return createDocumentViewerSession();
    }

    return viewerSessions[documentId] || createDocumentViewerSession();
  }, [documentId, viewerSessions]);

  const setSessionField = useCallback(
    (field, nextValue) => {
      updateDocumentViewerSession(documentId, (currentSession) => ({
        ...currentSession,
        [field]: resolveNextValue(nextValue, currentSession[field]),
      }));
    },
    [documentId, updateDocumentViewerSession],
  );

  return useMemo(
    () => ({
      ...session,
      setActiveTab: (nextValue) => setSessionField('activeTab', nextValue),
      setSidebarOpen: (nextValue) => setSessionField('sidebarOpen', nextValue),
      setSidebarWidth: (nextValue) =>
        setSessionField('sidebarWidth', nextValue),
      setSummaryState: (nextValue) =>
        setSessionField('summaryState', nextValue),
      setSelectedLanguage: (nextValue) =>
        setSessionField('selectedLanguage', nextValue),
      setIsSummaryModalOpen: (nextValue) =>
        setSessionField('isSummaryModalOpen', nextValue),
      setIsSummaryHistoryOpen: (nextValue) =>
        setSessionField('isSummaryHistoryOpen', nextValue),
      setIsSummaryRefreshConfirmOpen: (nextValue) =>
        setSessionField('isSummaryRefreshConfirmOpen', nextValue),
      setSummaryInstructionDraft: (nextValue) =>
        setSessionField('summaryInstructionDraft', nextValue),
      setSummaryInstructionError: (nextValue) =>
        setSessionField('summaryInstructionError', nextValue),
      setSelectedSummarySlot: (nextValue) =>
        setSessionField('selectedSummarySlot', nextValue),
      setAskQuestion: (nextValue) =>
        setSessionField('askQuestion', nextValue),
      setAskHistoryState: (nextValue) =>
        setSessionField('askHistoryState', nextValue),
      setAskState: (nextValue) => setSessionField('askState', nextValue),
      setNoteState: (nextValue) => setSessionField('noteState', nextValue),
      setIsNoteHistoryOpen: (nextValue) =>
        setSessionField('isNoteHistoryOpen', nextValue),
      setIsNoteTitleModalOpen: (nextValue) =>
        setSessionField('isNoteTitleModalOpen', nextValue),
      setNoteTitleDraft: (nextValue) =>
        setSessionField('noteTitleDraft', nextValue),
      setAiPanelScrollTopByTab: (nextValue) =>
        setSessionField('aiPanelScrollTopByTab', nextValue),
    }),
    [session, setSessionField],
  );
};
