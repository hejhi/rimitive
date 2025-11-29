/**
 * Headless UI Demo Entry Point
 *
 * Renders both React and Lattice implementations side-by-side,
 * demonstrating that the same headless behaviors work across frameworks.
 */
import { createRoot } from 'react-dom/client';
import { ReactApp } from './react/App';
import { mount as mountLattice } from './lattice/App';

// Mount React app
const reactRoot = document.getElementById('react-root');
if (reactRoot) {
  createRoot(reactRoot).render(<ReactApp />);
}

// Mount Lattice app
const latticeRoot = document.getElementById('lattice-root');
if (latticeRoot) {
  mountLattice(latticeRoot);
}
