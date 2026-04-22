import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// WORKAROUND: Suppress ResizeObserver loop errors that are benign but trigger console noise 
// or development error overlays. These are common with complex layout libraries like 
// React Flow and react-pdf.
const resizeObserverLoopErr = 'ResizeObserver loop completed with undelivered notifications';
const resizeObserverLimitErr = 'ResizeObserver loop limit exceeded';

window.addEventListener('error', (e) => {
  if (e.message === resizeObserverLoopErr || e.message === resizeObserverLimitErr) {
    e.stopImmediatePropagation();
  }
});

window.addEventListener('unhandledrejection', (e) => {
  if (e.reason && (e.reason.message === resizeObserverLoopErr || e.reason.message === resizeObserverLimitErr)) {
    e.stopImmediatePropagation();
  }
});

import { ReactFlowProvider } from '@xyflow/react';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReactFlowProvider>
      <App />
    </ReactFlowProvider>
  </StrictMode>,
);
