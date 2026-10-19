import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './components/common/ErrorBoundary';
import { ChatProvider } from './context/ChatContext';
import { CompanionProvider } from './context/CompanionContext';
import { ToastProvider } from './context/ToastContext';
import { I18nProvider } from './i18n/I18nContext';
import { UserProvider } from './context/UserContext';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <I18nProvider>
          <ToastProvider>
            <UserProvider>
              <ChatProvider>
                <CompanionProvider>
                  <App />
                </CompanionProvider>
              </ChatProvider>
            </UserProvider>
          </ToastProvider>
        </I18nProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
