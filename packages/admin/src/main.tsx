import React from 'react';
import ReactDOM from 'react-dom/client';
import { initI18n } from '@shared/i18n';
import { App } from '@admin/App';
import '@shared/index.css';

initI18n();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
