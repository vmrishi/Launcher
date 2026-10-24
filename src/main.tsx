import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
if (new URLSearchParams(location.search).has('donut')) {
  document.documentElement.classList.add('radial-root');
  document.body.classList.add('radial-body');
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
