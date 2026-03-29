import { Navigate, Route, Routes } from 'react-router-dom';
import App from './App.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { DocumentsProvider } from './components/DocumentsContext.jsx';
import Login from './components/auth/Login.jsx';
import Register from './components/auth/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Documents from './pages/Documents.jsx';

const Layout = () => {
  return (
    <Routes>
      <Route path="/" element={<App />}>
        <Route
          index
          element={
            <ProtectedRoute>
              <DocumentsProvider>
                <Dashboard />
              </DocumentsProvider>
            </ProtectedRoute>
          }
        />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="dashboard" element={<Navigate to="/" replace />} />
        <Route
          path="documents"
          element={
            <ProtectedRoute>
              <DocumentsProvider>
                <Documents />
              </DocumentsProvider>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};

export default Layout;
