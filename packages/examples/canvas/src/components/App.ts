/**
 * App Component
 *
 * Composes DOM (toolbar) and Canvas (scene) in a single tree.
 * Demonstrates the new composable renderer pattern where canvas.el('canvas')
 * acts as a boundary - a DOM element externally, scene graph root internally.
 *
 * Event handling uses addEventListener on the canvas element itself,
 * matching DOM patterns. Hit testing provides the target canvas node.
 */
import { canvas, dom } from '../service';
import { ShapeEditor } from './ShapeEditor';
import { Toolbar } from './Toolbar';

const { cvs, on } = canvas;
const { el } = dom;

interface AppProps {
  canvasWidth: number;
  canvasHeight: number;
}

export const App = ({ canvasWidth, canvasHeight }: AppProps) => {
  // Get the scene content (the group with shapes)
  const {
    shapes,
    addShape,
    clearAll,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = ShapeEditor({
    canvasWidth,
    canvasHeight,
    initialShapes: [
      { type: 'circle' },
      { type: 'circle' },
      { type: 'rect' },
      { type: 'rect' },
      { type: 'circle' },
    ],
  });

  // Single composed tree: DOM with embedded canvas
  // canvas.el('canvas') creates an HTMLCanvasElement that acts as the boundary
  return el('div', { className: 'app' })(
    el('h1')('Lattice Canvas'),
    el('p', { className: 'subtitle' })(
      'Reactive canvas rendering with signals'
    ),

    el('div', { className: 'canvas-container' })(
      // Canvas element: DOM node externally, scene graph root internally
      // Event listeners attached via lifecycle callbacks with hit testing
      cvs('canvas', {
        width: canvasWidth,
        height: canvasHeight,
        clearColor: '#16213e',
      })(shapes)(
        on('pointerdown', handlePointerDown),
        on('pointermove', handlePointerMove),
        on('pointerup', handlePointerUp)
      )
    ),

    // DOM toolbar - passes actions to canvas scene
    Toolbar({
      onAddShape: addShape,
      onClearAll: clearAll,
    }),

    el('div', { className: 'info' })(
      el('strong')('Click on shapes'),
      ' to select them. ',
      el('strong')('Drag'),
      ' to move selected shape. Shapes are reactive - powered by ',
      el('code')('@lattice/signals'),
      ' and rendered with ',
      el('code')('@lattice/canvas'),
      '.'
    )
  );
};
