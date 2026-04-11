import { createContext, useContext, useState, useCallback } from 'react';

const DocViewerContext = createContext({
  docInfo: null,
  setDocInfo: () => {},
  docActions: null,
  setDocActions: () => {},
});

export const DocViewerProvider = ({ children }) => {
  const [docInfo, setDocInfo] = useState(null);
  const [docActions, setDocActions] = useState(null);

  const clearDocViewer = useCallback(() => {
    setDocInfo(null);
    setDocActions(null);
  }, []);

  return (
    <DocViewerContext.Provider value={{ docInfo, setDocInfo, docActions, setDocActions, clearDocViewer }}>
      {children}
    </DocViewerContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useDocViewer = () => useContext(DocViewerContext);
