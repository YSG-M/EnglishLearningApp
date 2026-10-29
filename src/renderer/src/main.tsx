import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { api } from './api/client';
import './styles/global.css';

window.addEventListener('error', (e) => {
  void api.log.write('error', `window error: ${e.message}`, { source: e.filename, line: e.lineno });
});
window.addEventListener('unhandledrejection', (e) => {
  const reason =
    e.reason instanceof Error ? `${e.reason.message}\n${e.reason.stack ?? ''}` : String(e.reason);
  void api.log.write('error', `unhandled rejection: ${reason}`);
});

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
