import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/newsreader/500.css';
import '@fontsource/newsreader/600.css';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import '../app/static/css/tokens.css';
import '../app/static/css/app.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
