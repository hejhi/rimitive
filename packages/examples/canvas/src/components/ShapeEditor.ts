/**
 * ShapeEditor Component (Canvas)
 *
 * Main canvas scene component that composes shapes and selection indicator.
 * Uses el() and map() for declarative rendering.
 *
 * Event handling uses pure geometric hit testing - no side effects or
 * node-to-data mappings needed.
 */
import { canvas } from '../service';
import type { CanvasPointerEvent } from '../service';
import { useShapeEditor, type ShapeType } from '../behaviors/useShapeEditor';
import { Shape } from './Shape';
import { SelectionIndicator } from './SelectionIndicator';

const { group, map } = canvas;

interface ShapeEditorProps {
  canvasWidth?: number;
  canvasHeight?: number;
  initialShapes?: Array<{ type: ShapeType }>;
}

/**
 * ShapeEditor component
 *
 * Creates an interactive shape editing canvas with:
 * - Draggable shapes (circles and rectangles)
 * - Selection indicator
 * - Pure geometric hit testing (no WeakMap side effects)
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
    hitTest,
  } = useShapeEditor({
    canvasWidth,
    canvasHeight,
  });

  // Add initial shapes
  for (const { type } of initialShapes) {
    addShape(type);
  }

  // Event handlers using pure geometric hit testing
  const handlePointerDown = (e: CanvasPointerEvent) => {
    const shape = hitTest(e.x, e.y);
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
    shapes: group(
      map(shapes, (shape) => shape.id)((shapeSignal) => Shape(shapeSignal())),
      SelectionIndicator({ selectedShape })
    ),
  };
};
