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
import { dom, canvas } from '../service';
import { ShapeEditor } from './ShapeEditor';
import { Toolbar } from './Toolbar';

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
  return dom.el('div', { className: 'app' })(
    dom.el('h1')('Lattice Canvas'),
    dom.el('p', { className: 'subtitle' })(
      'Reactive canvas rendering with signals'
    ),

    dom.el('div', { className: 'canvas-container' })(
      // Canvas element: DOM node externally, scene graph root internally
      // Event listeners attached via lifecycle callbacks with hit testing
      canvas.el('canvas', {
        width: canvasWidth,
        height: canvasHeight,
        clearColor: '#16213e',
      })(shapes)(
        canvas.addEventListener('pointerdown', handlePointerDown),
        canvas.addEventListener('pointermove', handlePointerMove),
        canvas.addEventListener('pointerup', handlePointerUp)
      )
    ),

    // DOM toolbar - passes actions to canvas scene
    Toolbar({
      onAddShape: addShape,
      onClearAll: clearAll,
    }),

    dom.el('div', { className: 'info' })(
      dom.el('strong')('Click on shapes'),
      ' to select them. ',
      dom.el('strong')('Drag'),
      ' to move selected shape. Shapes are reactive - powered by ',
      dom.el('code')('@lattice/signals'),
      ' and rendered with ',
      dom.el('code')('@lattice/canvas'),
      '.'
    )
  );
};
