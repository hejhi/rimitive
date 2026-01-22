/**
 * Canvas Adapter Types
 *
 * This is a reference implementation demonstrating how to build a custom
 * NodeAdapter for non-DOM targets. The canvas adapter creates a scene graph
 * that gets rendered to an HTML canvas element.
 */

import type { TreeConfig } from '@rimitive/view/types';

// ============================================================================
// Runtime types (used internally by adapter)
// ============================================================================

export type CanvasNode = {
  type: string;
  props: Record<string, unknown>;
  children: CanvasNode[];
  parent: CanvasNode | null;
  bounds?: { x: number; y: number; width: number; height: number };
  dirty: boolean;
};

/**
 * Extended HTMLCanvasElement that holds a reference to its scene graph root
 * Used as the bridge between DOM and canvas rendering
 */
export type CanvasBridgeElement = HTMLCanvasElement & {
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
};

/**
 * Union type for canvas adapter nodes - either a scene graph node or a bridge element
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
export type CanvasBaseProps = {
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
};

/**
 * Writable HTML attributes from HTMLCanvasElement
 * Excludes methods, readonly properties, and 'style' (handled separately)
 */
type HTMLCanvasAttributes = Partial<
  Pick<
    HTMLCanvasElement,
    | 'width'
    | 'height'
    | 'className'
    | 'id'
    | 'title'
    | 'tabIndex'
    | 'hidden'
    | 'draggable'
    | 'dir'
    | 'lang'
    | 'accessKey'
  >
> & {
  /** Inline styles - accepts string or style object */
  style?: string | Partial<CSSStyleDeclaration>;
};

/**
 * Props for canvas bridge element (the <canvas> HTML element)
 *
 * Extends HTMLCanvasElement attributes with canvas-specific rendering options.
 * All props are forwarded to the underlying canvas element.
 */
export type CanvasProps = HTMLCanvasAttributes & {
  /** Whether to clear before each paint (default: true) */
  autoClear?: boolean;
  /** Background color when clearing */
  clearColor?: string;
  /** Additional attributes are forwarded to HTMLCanvasElement */
  [key: string]: unknown;
};

/**
 * Props for group element
 */
export type GroupProps = CanvasBaseProps;

/**
 * Props for rectangle element
 */
export type RectProps = CanvasBaseProps & {
  /** Rectangle width */
  width?: number;
  /** Rectangle height */
  height?: number;
  /** Corner radius for rounded rectangles */
  cornerRadius?: number;
};

/**
 * Props for circle/ellipse element
 */
export type CircleProps = CanvasBaseProps & {
  /** Circle radius (or default for ellipse) */
  radius?: number;
  /** Horizontal radius for ellipse */
  radiusX?: number;
  /** Vertical radius for ellipse */
  radiusY?: number;
};

/**
 * Props for line element
 */
export type LineProps = CanvasBaseProps & {
  /** Start X coordinate */
  x1?: number;
  /** Start Y coordinate */
  y1?: number;
  /** End X coordinate */
  x2?: number;
  /** End Y coordinate */
  y2?: number;
};

/**
 * Props for path element
 */
export type PathProps = CanvasBaseProps & {
  /** SVG path data string */
  d?: string;
};

/**
 * Props for text element
 */
export type TextProps = CanvasBaseProps & {
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
};

/**
 * Props for image element
 */
export type ImageProps = CanvasBaseProps & {
  /** Image source URL */
  src?: string;
  /** Image width (defaults to natural width) */
  width?: number;
  /** Image height (defaults to natural height) */
  height?: number;
};

// ============================================================================
// Element types for RendererConfig
// These combine CanvasNode (for RefSpec compatibility) with Props (for autocomplete)
// ============================================================================

/**
 * Group element - CanvasNode with group props
 */
export type GroupElement = CanvasNode & GroupProps;

/**
 * Rect element - CanvasNode with rect props
 */
export type RectElement = CanvasNode & RectProps;

/**
 * Circle element - CanvasNode with circle props
 */
export type CircleElement = CanvasNode & CircleProps;

/**
 * Line element - CanvasNode with line props
 */
export type LineElement = CanvasNode & LineProps;

/**
 * Path element - CanvasNode with path props
 */
export type PathElement = CanvasNode & PathProps;

/**
 * Text element - CanvasNode with text props
 */
export type TextElement = CanvasNode & TextProps;

/**
 * Image element - CanvasNode with image props
 */
export type ImageElement = CanvasNode & ImageProps;

// ============================================================================
// Adapter config
// ============================================================================

/**
 * Canvas tree configuration
 */
export type CanvasTreeConfig = TreeConfig & {
  attributes: {
    canvas: CanvasProps;
    group: GroupProps;
    rect: RectProps;
    circle: CircleProps;
    line: LineProps;
    path: PathProps;
    text: TextProps;
    image: ImageProps;
  };
  nodes: {
    canvas: CanvasBridgeElement;
    group: GroupElement;
    rect: RectElement;
    circle: CircleElement;
    line: LineElement;
    path: PathElement;
    text: TextElement;
    image: ImageElement;
  };
};

export type CanvasPointerEvent<T extends CanvasNode = CanvasNode> = {
  x: number;
  y: number;
  target: T | null;
  nativeEvent: PointerEvent;
};
