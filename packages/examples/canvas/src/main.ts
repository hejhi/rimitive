/**
 * Canvas Example - Main Entry Point
 *
 * Demonstrates composable renderer pattern:
 * - Single composed tree with DOM and Canvas elements
 * - canvas.el('canvas') acts as the boundary between renderers
 * - Shared signals for reactive state across both
 */
import { dom } from './service';
import { App } from './components/App';

// Mount the entire app - DOM and Canvas composed together
const appRef = dom.mount(
  App({
    canvasWidth: 600,
    canvasHeight: 400,
  })
);

// Append to document
const root = document.getElementById('root');
if (root) {
  root.appendChild(appRef.element as Node);
}

console.log('Lattice Canvas Example loaded!');
console.log('- Click shapes to select');
console.log('- Drag to move');
console.log('- Use buttons to add more shapes');
