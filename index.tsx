import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// PRODUCTION SAFETY: Polyfill 'process' for the browser environment
// This prevents 'process is not defined' errors which cause immediate white screens
if (typeof (window as any).process === 'undefined') {
  (window as any).process = {
    env: {
      API_KEY: '' // Will be populated by platform if available
    }
  };
}

// Global error handler for production debugging
window.addEventListener('error', (event) => {
  console.error('Global Runtime Error:', event.error);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);