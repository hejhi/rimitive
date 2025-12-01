/**
 * ShapeEditor Component (Canvas)
 *
 * Main canvas scene component that composes shapes and selection indicator.
 * Uses el(), map(), and lifecycle callbacks just like DOM components.
 *
 * Event handling is done at the canvas level via addEventListener,
 * not on individual shape nodes.
 */
import { canvas } from '../service';
import type { CanvasNode, CanvasPointerEvent } from '../service';
import {
  useShapeEditor,
  type ShapeData,
  type ShapeType,
} from '../behaviors/useShapeEditor';
import { Shape } from './Shape';
import { SelectionIndicator } from './SelectionIndicator';

const { el, map } = canvas;

interface ShapeEditorProps {
  canvasWidth?: number;
  canvasHeight?: number;
  initialShapes?: Array<{ type: ShapeType }>;
  onReady?: (actions: {
    addShape: (type: ShapeType) => void;
    clearAll: () => void;
    handlePointerDown: (e: CanvasPointerEvent) => void;
    handlePointerMove: (e: CanvasPointerEvent) => void;
    handlePointerUp: (e: CanvasPointerEvent) => void;
  }) => void;
}

/**
 * ShapeEditor component
 *
 * Creates an interactive shape editing canvas with:
 * - Draggable shapes (circles and rectangles)
 * - Selection indicator
 * - Event handlers exposed via onReady callback
 */
export const ShapeEditor = (props: ShapeEditorProps = {}) => {
  const { canvasWidth = 600, canvasHeight = 400, initialShapes = [] } = props;

  // Use the headless behavior for state management
  const {
    addShape,
    shapes,
    dragOffset,
    selectedShape,
    moveShape,
    clearAll,
    startDrag,
    endDrag,
    isDragging,
  } = useShapeEditor({
    canvasWidth,
    canvasHeight,
  });

  // Add initial shapes
  for (const { type } of initialShapes) {
    addShape(type);
  }

  // Track node-to-shape mapping for hit testing
  const shapeNodeToData = new WeakMap<CanvasNode, ShapeData>();

  // Event handlers - called from canvas addEventListener
  const handlePointerDown = (e: CanvasPointerEvent) => {
    const shape = e.target ? shapeNodeToData.get(e.target) : undefined;
    if (!shape) return;
    startDrag(shape.id, { x: e.x, y: e.y });
  };

  const handlePointerMove = (e: CanvasPointerEvent) => {
    if (!isDragging()) return;

    const selected = selectedShape();
    if (!selected) return;

    moveShape(selected.id, e.x - dragOffset.x(), e.y - dragOffset.y());
  };

  const handlePointerUp = endDrag;

  // The scene: a group containing all shapes and the selection indicator
  return {
    addShape,
    clearAll,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    shapes: el('group')(
      // Render all shapes using map()
      map(
        shapes,
        (shape) => shape.id
      )((shapeSignal) => {
        const shape = shapeSignal();

        // Create shape element
        const shapeEl = Shape(shape);

        // Register for hit testing via lifecycle callback
        return shapeEl((node) => {
          shapeNodeToData.set(node, shape);
          return () => {
            shapeNodeToData.delete(node);
          };
        });
      }),
      // Selection indicator on top
      SelectionIndicator({ selectedShape })
    )(),
  };
};
