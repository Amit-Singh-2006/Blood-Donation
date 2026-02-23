import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { GlobalProvider } from './context/GlobalContext';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <GlobalProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </GlobalProvider>
    </AuthProvider>
  </StrictMode>,
);
