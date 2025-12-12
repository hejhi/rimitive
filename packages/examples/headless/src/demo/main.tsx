/**
 * Headless UI Demo Entry Point
 *
 * Renders both React and Rimitive implementations side-by-side,
 * demonstrating that the same headless behaviors work across frameworks.
 */
import { createRoot } from 'react-dom/client';
import { ReactApp } from './react/App';
import { mount as mountRimitive } from './rimitive/App';

// Mount React app
const reactRoot = document.getElementById('react-root');
if (reactRoot) {
  createRoot(reactRoot).render(<ReactApp />);
}

// Mount Rimitive app
const rimitiveRoot = document.getElementById('rimitive-root');
if (rimitiveRoot) {
  mountRimitive(rimitiveRoot);
}
