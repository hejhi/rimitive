import type { RendererConfig } from '@lattice/view/types';

// ============================================================================
// Runtime types (used internally by renderer)
// ============================================================================

export interface CanvasNode {
  type: string;
  props: Record<string, unknown>;
  children: CanvasNode[];
  parent: CanvasNode | null;
  bounds?: { x: number; y: number; width: number; height: number };
  dirty: boolean;
}

/**
 * Extended HTMLCanvasElement that holds a reference to its scene graph root
 * Used as the bridge between DOM and canvas rendering
 */
export interface CanvasBridgeElement extends HTMLCanvasElement {
  /** The root node of this canvas's scene graph */
  __sceneRoot: CanvasNode;
  /** The 2D rendering context */
  __ctx: CanvasRenderingContext2D;
  /** Options for this canvas */
  __options: {
    autoClear: boolean;
    clearColor?: string;
  };
  /** Whether a paint is scheduled */
  __frameRequested: boolean;
  /** Paint function for this canvas */
  __paint: () => void;
  /** Mark dirty and schedule repaint */
  __markDirty: () => void;
}

/**
 * Union type for canvas renderer nodes - either a scene graph node or a bridge element
 */
export type CanvasElement = CanvasNode | CanvasBridgeElement;

// ============================================================================
// Element types with typed props
// These extend the runtime types AND include typed props for autocomplete.
// TypeScript sees the props for type-checking, runtime uses node.props bag.
// ============================================================================

/**
 * Common transform and style props shared by all canvas elements
 */
interface CanvasBaseProps {
  /** X position (translation) */
  x?: number;
  /** Y position (translation) */
  y?: number;
  /** Rotation in radians */
  rotation?: number;
  /** Horizontal scale factor */
  scaleX?: number;
  /** Vertical scale factor */
  scaleY?: number;
  /** Opacity (0-1) */
  opacity?: number;
  /** Fill color */
  fill?: string;
  /** Stroke color */
  stroke?: string;
  /** Stroke width */
  strokeWidth?: number;
  /** Line cap style */
  lineCap?: CanvasLineCap;
  /** Line join style */
  lineJoin?: CanvasLineJoin;
}

/**
 * Canvas bridge element with typed props
 * Extends CanvasBridgeElement (for lifecycle callbacks) with prop types (for el() autocomplete)
 */
export interface CanvasBridgeProps extends CanvasBridgeElement {
  /** Canvas width in pixels */
  width: number;
  /** Canvas height in pixels */
  height: number;
  /** Whether to clear before each paint */
  autoClear?: boolean;
  /** Background color when clearing */
  clearColor?: string;
}

/**
 * Group element with typed props
 */
export interface GroupElement extends CanvasNode, CanvasBaseProps {}

/**
 * Rectangle element with typed props
 */
export interface RectElement extends CanvasNode, CanvasBaseProps {
  /** Rectangle width */
  width?: number;
  /** Rectangle height */
  height?: number;
  /** Corner radius for rounded rectangles */
  cornerRadius?: number;
}

/**
 * Circle/ellipse element with typed props
 */
export interface CircleElement extends CanvasNode, CanvasBaseProps {
  /** Circle radius (or default for ellipse) */
  radius?: number;
  /** Horizontal radius for ellipse */
  radiusX?: number;
  /** Vertical radius for ellipse */
  radiusY?: number;
}

/**
 * Line element with typed props
 */
export interface LineElement extends CanvasNode, CanvasBaseProps {
  /** Start X coordinate */
  x1?: number;
  /** Start Y coordinate */
  y1?: number;
  /** End X coordinate */
  x2?: number;
  /** End Y coordinate */
  y2?: number;
}

/**
 * Path element with typed props
 */
export interface PathElement extends CanvasNode, CanvasBaseProps {
  /** SVG path data string */
  d?: string;
}

/**
 * Text element with typed props
 */
export interface TextElement extends CanvasNode, CanvasBaseProps {
  /** Text content */
  text?: string;
  /** Alternative text content prop */
  value?: string;
  /** Font size in pixels */
  fontSize?: number;
  /** Font family */
  fontFamily?: string;
  /** Text alignment */
  textAlign?: CanvasTextAlign;
  /** Text baseline */
  textBaseline?: CanvasTextBaseline;
}

/**
 * Image element with typed props
 */
export interface ImageElement extends CanvasNode, CanvasBaseProps {
  /** Image source URL */
  src?: string;
  /** Image width (defaults to natural width) */
  width?: number;
  /** Image height (defaults to natural height) */
  height?: number;
}

// ============================================================================
// Renderer config
// ============================================================================

export interface CanvasRendererConfig extends RendererConfig {
  elements: {
    canvas: CanvasBridgeProps;
    group: GroupElement;
    rect: RectElement;
    circle: CircleElement;
    line: LineElement;
    path: PathElement;
    text: TextElement;
    image: ImageElement;
  };
  events: {
    click: CanvasPointerEvent;
    pointerdown: CanvasPointerEvent;
    pointermove: CanvasPointerEvent;
    pointerup: CanvasPointerEvent;
  };
  baseElement: CanvasElement;
}

export interface CanvasPointerEvent {
  x: number;
  y: number;
  target: CanvasNode | null;
  nativeEvent: PointerEvent;
}
