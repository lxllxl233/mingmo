import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/shell/App';
import './ui/styles.css';

const container = document.getElementById('root');

if (container === null) {
  throw new Error('missing #root');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
