import React from 'react';
import ReactDOM from 'react-dom/client';
import { initI18n } from '@shared/i18n';
import { App } from '@admin/App';
import '@shared/index.css';
import { ErrorBoundary } from '@shared/components/layout/ErrorBoundary';

const HOME_PATH = '/dashboard';

initI18n();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary homePath={HOME_PATH}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
