import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import App from './App.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { DocumentsProvider } from './components/DocumentsContext.jsx';
import { DocViewerProvider } from './context/DocViewerContext.jsx';

const WorkspaceShell = lazy(() => import('./components/workspace/WorkspaceShell.jsx'));
const Login = lazy(() => import('./components/auth/Login.jsx'));
const Register = lazy(() => import('./components/auth/Register.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const DocumentViewer = lazy(() => import('./pages/DocumentViewer.jsx'));
const Favorites = lazy(() => import('./pages/Favorites.jsx'));
const Home = lazy(() => import('./pages/Home.jsx'));
const StudyGPS = lazy(() => import('./pages/StudyGPS.jsx'));

const renderRoute = (element) => (
  <Suspense fallback={null}>{element}</Suspense>
);

const Layout = () => {
  return (
    <Routes>
      <Route path="/" element={<App />}>
        <Route index element={renderRoute(<Home />)} />
        <Route path="login" element={renderRoute(<Login />)} />
        <Route path="register" element={renderRoute(<Register />)} />
        <Route path="home" element={<Navigate to="/" replace />} />
        <Route
          element={
            <ProtectedRoute>
              <DocumentsProvider>
                <DocViewerProvider>
                  {renderRoute(<WorkspaceShell />)}
                </DocViewerProvider>
              </DocumentsProvider>
            </ProtectedRoute>
          }
        >
          <Route path="app">
            <Route index element={renderRoute(<Dashboard />)} />
            <Route path="home" element={<Navigate to="/app" replace />} />
            <Route path="study-gps" element={renderRoute(<StudyGPS />)} />
            <Route path="favorites" element={renderRoute(<Favorites />)} />
            <Route
              path="documents/:documentId"
              element={renderRoute(<DocumentViewer />)}
            />
          </Route>
        </Route>
        <Route path="dashboard" element={<Navigate to="/app" replace />} />
        <Route path="documents" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};

export default Layout;
