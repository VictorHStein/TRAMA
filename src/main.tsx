import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { applyThemeToDocument, useArchitectureStore } from './state/architectureStore';
import { ErrorBoundary } from './components/layout/ErrorBoundary';

// Fonts are bundled (fontsource) so the app renders identically offline.
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';

import './index.css';

applyThemeToDocument(useArchitectureStore.getState().theme);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
