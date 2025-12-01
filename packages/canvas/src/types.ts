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
// Props types for el() autocomplete
// These define what props users can pass to el('rect', {...}), etc.
// Separate from runtime CanvasNode structure.
// ============================================================================

/**
 * Common transform and style props shared by all canvas elements
 */
export interface CanvasBaseProps {
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
 * Props for canvas bridge element (the <canvas> HTML element)
 */
export interface CanvasProps {
  /** Canvas width in pixels */
  width?: number;
  /** Canvas height in pixels */
  height?: number;
  /** Whether to clear before each paint */
  autoClear?: boolean;
  /** Background color when clearing */
  clearColor?: string;
}

/**
 * Props for group element
 */
export type GroupProps = CanvasBaseProps;

/**
 * Props for rectangle element
 */
export interface RectProps extends CanvasBaseProps {
  /** Rectangle width */
  width?: number;
  /** Rectangle height */
  height?: number;
  /** Corner radius for rounded rectangles */
  cornerRadius?: number;
}

/**
 * Props for circle/ellipse element
 */
export interface CircleProps extends CanvasBaseProps {
  /** Circle radius (or default for ellipse) */
  radius?: number;
  /** Horizontal radius for ellipse */
  radiusX?: number;
  /** Vertical radius for ellipse */
  radiusY?: number;
}

/**
 * Props for line element
 */
export interface LineProps extends CanvasBaseProps {
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
 * Props for path element
 */
export interface PathProps extends CanvasBaseProps {
  /** SVG path data string */
  d?: string;
}

/**
 * Props for text element
 */
export interface TextProps extends CanvasBaseProps {
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
 * Props for image element
 */
export interface ImageProps extends CanvasBaseProps {
  /** Image source URL */
  src?: string;
  /** Image width (defaults to natural width) */
  width?: number;
  /** Image height (defaults to natural height) */
  height?: number;
}

// ============================================================================
// Element types for RendererConfig
// These combine CanvasNode (for RefSpec compatibility) with Props (for autocomplete)
// ============================================================================

/**
 * Group element - CanvasNode with group props
 */
export interface GroupElement extends CanvasNode, GroupProps {}

/**
 * Rect element - CanvasNode with rect props
 */
export interface RectElement extends CanvasNode, RectProps {}

/**
 * Circle element - CanvasNode with circle props
 */
export interface CircleElement extends CanvasNode, CircleProps {}

/**
 * Line element - CanvasNode with line props
 */
export interface LineElement extends CanvasNode, LineProps {}

/**
 * Path element - CanvasNode with path props
 */
export interface PathElement extends CanvasNode, PathProps {}

/**
 * Text element - CanvasNode with text props
 */
export interface TextElement extends CanvasNode, TextProps {}

/**
 * Image element - CanvasNode with image props
 */
export interface ImageElement extends CanvasNode, ImageProps {}

// ============================================================================
// Renderer config
// ============================================================================

export interface CanvasRendererConfig extends RendererConfig {
  props: {
    canvas: CanvasProps;
    group: GroupProps;
    rect: RectProps;
    circle: CircleProps;
    line: LineProps;
    path: PathProps;
    text: TextProps;
    image: ImageProps;
  };
  elements: {
    canvas: CanvasBridgeElement;
    group: CanvasNode;
    rect: CanvasNode;
    circle: CanvasNode;
    line: CanvasNode;
    path: CanvasNode;
    text: CanvasNode;
    image: CanvasNode;
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
