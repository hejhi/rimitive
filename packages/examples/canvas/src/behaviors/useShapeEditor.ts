/**
 * ShapeEditor Behavior - Framework Agnostic
 *
 * Headless component for managing a collection of draggable shapes.
 * Handles selection, creation, deletion, and position updates.
 *
 * Uses the `use*` naming convention to indicate it returns reactive values.
 */
import { signal, computed } from '../service';

export type ShapeType = 'circle' | 'rect';

export interface ShapeData {
  id: number;
  type: ShapeType;
  x: ReturnType<typeof signal<number>>;
  y: ReturnType<typeof signal<number>>;
  color: string;
  size: number;
}

const COLORS = [
  '#e94560',
  '#0f3460',
  '#00b4d8',
  '#90be6d',
  '#f9c74f',
  '#9b5de5',
];

function randomColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)]!;
}

export interface UseShapeEditorOptions {
  canvasWidth?: number;
  canvasHeight?: number;
}

export const useShapeEditor = (options: UseShapeEditorOptions = {}) => {
  const { canvasWidth = 600, canvasHeight = 400 } = options;

  // Core state
  let nextId = 1;
  const shapes = signal<ShapeData[]>([]);
  const selectedId = signal<number | null>(null);
  const isDragging = signal(false);
  const dragOffsetX = signal(0);
  const dragOffsetY = signal(0);

  // Derived state
  const selectedShape = computed(() => {
    const id = selectedId();
    return shapes().find((s) => s.id === id) ?? null;
  });

  const shapeCount = computed(() => shapes().length);

  // Actions
  const addShape = (type: ShapeType): ShapeData => {
    const id = nextId++;
    const shape: ShapeData = {
      id,
      type,
      x: signal(50 + Math.random() * (canvasWidth - 100)),
      y: signal(50 + Math.random() * (canvasHeight - 100)),
      color: randomColor(),
      size: 25 + Math.random() * 25,
    };

    shapes([...shapes(), shape]);
    return shape;
  };

  const removeShape = (id: number): void => {
    shapes(shapes().filter((s) => s.id !== id));
    if (selectedId() === id) {
      selectedId(null);
    }
  };

  const selectShape = (id: number | null): void => {
    selectedId(id);
  };

  const clearAll = (): void => {
    shapes([]);
    selectedId(null);
  };

  const moveShape = (id: number, x: number, y: number): void => {
    const shape = shapes().find((s) => s.id === id);
    if (shape) {
      shape.x(x);
      shape.y(y);
    }
  };

  const startDrag = (shapeId: number, { x, y }: { x: number; y: number }) => {
    selectShape(shapeId);
    const shape = selectedShape();

    if (shape) {
      dragOffsetX(x - shape.x());
      dragOffsetY(y - shape.y());
      isDragging(true);
    }
  };
  const endDrag = () => isDragging(false);

  return {
    // Reactive state
    shapes,
    selectedId,
    selectedShape,
    shapeCount,
    dragOffset: {
      x: dragOffsetX,
      y: dragOffsetY,
    },

    // Actions
    addShape,
    removeShape,
    selectShape,
    clearAll,
    moveShape,
    startDrag,
    endDrag,
    isDragging,
  };
};
