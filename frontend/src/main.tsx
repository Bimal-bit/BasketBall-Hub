import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './lib/theme';
import App from './App.tsx';
import './index.css';

// Error boundary for the entire app
try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  createRoot(rootElement).render(
    <StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </StrictMode>
  );
} catch (error) {
  console.error('Failed to render app:', error);
  // Display error to user
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #0a0a0a; color: white; font-family: system-ui, sans-serif; padding: 20px; text-align: center;">
        <div>
          <h1 style="color: #f97316; margin-bottom: 20px;">NBA Live Intelligence</h1>
          <p style="margin-bottom: 10px;">Failed to load application</p>
          <p style="color: #888; font-size: 14px;">Check the browser console for more details</p>
          <button onclick="location.reload()" style="margin-top: 20px; padding: 12px 24px; background: #f97316; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
            Reload Page
          </button>
        </div>
      </div>
    `;
  }
}
