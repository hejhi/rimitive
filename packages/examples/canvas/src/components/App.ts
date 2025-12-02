/**
 * App Component
 *
 * Composes DOM (toolbar) and Canvas (scene) in a single tree.
 * Demonstrates the composable adapter pattern where canvas.cvs('canvas')
 * acts as a boundary - a DOM element externally, scene graph root internally.
 *
 * Event handling uses addEventListener on the canvas element itself,
 * matching DOM patterns. Hit testing provides the target canvas node.
 */
import { canvas, dom } from '../service';
import { ShapeEditor } from './ShapeEditor';
import { Toolbar } from './Toolbar';

const { on, canvasRoot } = canvas;
const { div, p, strong, code, h1 } = dom;

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
  return div.props({ className: 'app' })(
    h1('Lattice Canvas'),
    p.props({ className: 'subtitle' })(
      'Reactive canvas rendering with signals'
    ),

    div.props({ className: 'canvas-container' })(
      // Canvas element: DOM node externally, scene graph root internally
      // Event listeners attached via lifecycle callbacks with hit testing
      canvasRoot
        .props({
          width: canvasWidth,
          height: canvasHeight,
          clearColor: '#16213e',
        })
        .ref(
          on('pointerdown', handlePointerDown),
          on('pointermove', handlePointerMove),
          on('pointerup', handlePointerUp)
        )(shapes)
    ),

    // DOM toolbar - passes actions to canvas scene
    Toolbar({
      onAddShape: addShape,
      onClearAll: clearAll,
    }),

    div.props({ className: 'info' })(
      strong('Click on shapes'),
      ' to select them. ',
      strong('Drag'),
      ' to move selected shape. Shapes are reactive - powered by ',
      code('@lattice/signals'),
      ' and rendered with a custom canvas adapter.'
    )
  );
};
