import { Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import './App.css';

function App() {
  return (
    <div className="app-shell">
      <Outlet />
      <Toaster 
        position="bottom-right" 
        toastOptions={{
          style: {
            background: 'white',
            color: '#1e293b',
            boxShadow: '0 10px 40px -10px rgba(15, 23, 42, 0.2)',
            borderRadius: '16px',
            padding: '12px 20px',
            fontWeight: '600',
            fontSize: '13px',
            border: '1px solid rgba(226, 232, 240, 0.8)'
          },
          success: {
            duration: 4000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#ffffff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#f43f5e',
              secondary: '#ffffff',
            },
          },
        }}
      />
    </div>
  );
}

export default App;
