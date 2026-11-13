import React from 'react';
import ReactDOM from 'react-dom/client';
import { initI18n } from '@shared/i18n';
import { App } from '@app/App';
import { initPush } from '@app/lib/push';
import { initTheme } from '@app/lib/theme';
import '@shared/index.css';

initTheme();
initI18n();
initPush();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
