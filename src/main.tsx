import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register service worker for complete installable Progressive Web App (PWA) compliance
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const isLocalhost = Boolean(
      window.location.hostname === 'localhost' ||
      window.location.hostname === '[::1]' ||
      window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
    );

    if (isLocalhost) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
    } else {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('LeadPilot PWA ServiceWorker registered with scope: ', registration.scope);
        })
        .catch((error) => {
          console.error('LeadPilot PWA ServiceWorker registration failed: ', error);
        });
    }
  });
}

