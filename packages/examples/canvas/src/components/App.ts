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
import type { CanvasPointerEvent } from '../service';
import { ShapeEditor } from './ShapeEditor';
import { Toolbar } from './Toolbar';
import type { ShapeType } from '../behaviors/useShapeEditor';

interface AppProps {
  canvasWidth: number;
  canvasHeight: number;
}

export const App = (props: AppProps) => {
  const { canvasWidth, canvasHeight } = props;

  // Actions and event handlers will be populated when ShapeEditor is ready
  let addShape: (type: ShapeType) => void = () => {};
  let clearAll: () => void = () => {};
  let handlePointerDown: (e: CanvasPointerEvent) => void = () => {};
  let handlePointerMove: (e: CanvasPointerEvent) => void = () => {};
  let handlePointerUp: (e: CanvasPointerEvent) => void = () => {};

  // Get the scene content (the group with shapes)
  const sceneContent = ShapeEditor({
    canvasWidth,
    canvasHeight,
    initialShapes: [
      { type: 'circle' },
      { type: 'circle' },
      { type: 'rect' },
      { type: 'rect' },
      { type: 'circle' },
    ],
    onReady: (actions) => {
      addShape = actions.addShape;
      clearAll = actions.clearAll;
      handlePointerDown = actions.handlePointerDown;
      handlePointerMove = actions.handlePointerMove;
      handlePointerUp = actions.handlePointerUp;
    },
  });

  // Single composed tree: DOM with embedded canvas
  // canvas.el('canvas') creates an HTMLCanvasElement that acts as the boundary
  return dom.el('div', { className: 'app' })(
    dom.el('h1')('Lattice Canvas'),
    dom.el('p', { className: 'subtitle' })('Reactive canvas rendering with signals'),

    dom.el('div', { className: 'canvas-container' })(
      // Canvas element: DOM node externally, scene graph root internally
      // Event listeners attached via lifecycle callbacks with hit testing
      canvas.el('canvas', {
        width: canvasWidth,
        height: canvasHeight,
        clearColor: '#16213e',
      })(
        sceneContent
      )(
        canvas.addEventListener('pointerdown', (e) => handlePointerDown(e)),
        canvas.addEventListener('pointermove', (e) => handlePointerMove(e)),
        canvas.addEventListener('pointerup', (e) => handlePointerUp(e))
      )
    ),

    // DOM toolbar - passes actions to canvas scene
    Toolbar({
      onAddShape: (type) => addShape(type),
      onClearAll: () => clearAll(),
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
