import { Navigate, Route, Routes } from 'react-router-dom';
import App from './App.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { DocumentsProvider } from './components/DocumentsContext.jsx';
import { DocViewerProvider } from './context/DocViewerContext.jsx';
import WorkspaceShell from './components/workspace/WorkspaceShell.jsx';
import Login from './components/auth/Login.jsx';
import Register from './components/auth/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import DocumentViewer from './pages/DocumentViewer.jsx';
import Favorites from './pages/Favorites.jsx';
import Home from './pages/Home.jsx';

const Layout = () => {
  return (
    <Routes>
      <Route path="/" element={<App />}>
        <Route index element={<Navigate to="/app/home" replace />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route
          path="app"
          element={
            <ProtectedRoute>
              <DocumentsProvider>
                <DocViewerProvider>
                  <WorkspaceShell />
                </DocViewerProvider>
              </DocumentsProvider>
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="home" element={<Home />} />
          <Route path="favorites" element={<Favorites />} />
          <Route path="documents/:documentId" element={<DocumentViewer />} />
        </Route>
        <Route path="dashboard" element={<Navigate to="/app" replace />} />
        <Route path="documents" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};

export default Layout;
