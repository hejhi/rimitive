import type { Renderer, ParentContext } from '@lattice/view/types';
import type {
  CanvasRendererConfig,
  CanvasNode,
  CanvasBridgeElement,
  CanvasElement,
} from './types';

/**
 * Transform a point from parent coordinate space to local coordinate space
 */
function transformPointToLocal(
  x: number,
  y: number,
  props: Record<string, unknown>
): { x: number; y: number } {
  // Translate
  const tx = (props.x as number) ?? 0;
  const ty = (props.y as number) ?? 0;
  let localX = x - tx;
  let localY = y - ty;

  // Inverse rotation
  const rotation = props.rotation as number | undefined;
  if (rotation) {
    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);
    const rx = localX * cos - localY * sin;
    const ry = localX * sin + localY * cos;
    localX = rx;
    localY = ry;
  }

  // Inverse scale
  const scaleX = (props.scaleX as number) ?? 1;
  const scaleY = (props.scaleY as number) ?? 1;
  if (scaleX !== 1 || scaleY !== 1) {
    localX /= scaleX;
    localY /= scaleY;
  }

  return { x: localX, y: localY };
}

/**
 * Check if a point is inside a node's bounds
 */
function pointInBounds(
  x: number,
  y: number,
  bounds: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    x >= bounds.x &&
    x <= bounds.x + bounds.width &&
    y >= bounds.y &&
    y <= bounds.y + bounds.height
  );
}

/**
 * Check if point hits a circle (more accurate than bounding box)
 */
function pointInCircle(
  x: number,
  y: number,
  radiusX: number,
  radiusY: number
): boolean {
  // Ellipse equation: (x/rx)^2 + (y/ry)^2 <= 1
  return (x * x) / (radiusX * radiusX) + (y * y) / (radiusY * radiusY) <= 1;
}

/**
 * Hit test a node and its children, returning the topmost hit node
 * Traverses children in reverse order (last child = top of visual stack)
 */
function hitTestNode(
  x: number,
  y: number,
  node: CanvasNode
): CanvasNode | null {
  // Transform point to local coordinates
  const local = transformPointToLocal(x, y, node.props);

  // Check children first (in reverse order - last child is on top)
  for (let i = node.children.length - 1; i >= 0; i--) {
    const child = node.children[i];
    if (child) {
      const hit = hitTestNode(local.x, local.y, child);
      if (hit) return hit;
    }
  }

  // Then check self (skip groups - they don't have visual bounds)
  if (node.type === 'group') return null;

  // Use shape-specific hit testing for better accuracy
  if (node.type === 'circle') {
    const radius = (node.props.radius as number) ?? 0;
    const radiusX = (node.props.radiusX as number) ?? radius;
    const radiusY = (node.props.radiusY as number) ?? radius;
    if (pointInCircle(local.x, local.y, radiusX, radiusY)) {
      return node;
    }
  } else if (node.bounds && pointInBounds(local.x, local.y, node.bounds)) {
    return node;
  }

  return null;
}

/**
 * Draw a single node to the canvas context
 */
function drawNode(ctx: CanvasRenderingContext2D, node: CanvasNode): void {
  const { type, props } = node;

  // Apply fill and stroke styles
  if (props.fill !== undefined) {
    ctx.fillStyle = props.fill as string;
  }
  if (props.stroke !== undefined) {
    ctx.strokeStyle = props.stroke as string;
  }
  if (props.strokeWidth !== undefined) {
    ctx.lineWidth = props.strokeWidth as number;
  }
  if (props.lineCap !== undefined) {
    ctx.lineCap = props.lineCap as CanvasLineCap;
  }
  if (props.lineJoin !== undefined) {
    ctx.lineJoin = props.lineJoin as CanvasLineJoin;
  }

  switch (type) {
    case 'group':
      // Groups don't draw anything themselves
      break;

    case 'rect': {
      const width = (props.width as number) ?? 0;
      const height = (props.height as number) ?? 0;
      const cornerRadius = props.cornerRadius as number | undefined;

      if (cornerRadius && cornerRadius > 0) {
        // Rounded rectangle
        ctx.beginPath();
        ctx.roundRect(0, 0, width, height, cornerRadius);
        if (props.fill !== undefined) ctx.fill();
        if (props.stroke !== undefined) ctx.stroke();
      } else {
        if (props.fill !== undefined) ctx.fillRect(0, 0, width, height);
        if (props.stroke !== undefined) ctx.strokeRect(0, 0, width, height);
      }

      // Update bounds for hit testing
      node.bounds = { x: 0, y: 0, width, height };
      break;
    }

    case 'circle': {
      const radius = (props.radius as number) ?? 0;
      const radiusX = (props.radiusX as number) ?? radius;
      const radiusY = (props.radiusY as number) ?? radius;

      ctx.beginPath();
      ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
      if (props.fill !== undefined) ctx.fill();
      if (props.stroke !== undefined) ctx.stroke();

      // Update bounds for hit testing
      node.bounds = { x: -radiusX, y: -radiusY, width: radiusX * 2, height: radiusY * 2 };
      break;
    }

    case 'line': {
      const x1 = (props.x1 as number) ?? 0;
      const y1 = (props.y1 as number) ?? 0;
      const x2 = (props.x2 as number) ?? 0;
      const y2 = (props.y2 as number) ?? 0;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Update bounds for hit testing
      node.bounds = {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
      };
      break;
    }

    case 'path': {
      const d = props.d as string | undefined;
      if (d) {
        const path2D = new Path2D(d);
        if (props.fill !== undefined) ctx.fill(path2D);
        if (props.stroke !== undefined) ctx.stroke(path2D);
      }
      // TODO: Compute bounds from path
      break;
    }

    case 'text': {
      const text = (props.text as string) ?? (props.value as string) ?? '';
      const fontSize = (props.fontSize as number) ?? 16;
      const fontFamily = (props.fontFamily as string) ?? 'sans-serif';
      const textAlign = (props.textAlign as CanvasTextAlign) ?? 'left';
      const textBaseline = (props.textBaseline as CanvasTextBaseline) ?? 'alphabetic';

      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.textAlign = textAlign;
      ctx.textBaseline = textBaseline;

      if (props.fill !== undefined) ctx.fillText(text, 0, 0);
      if (props.stroke !== undefined) ctx.strokeText(text, 0, 0);

      // Compute bounds for hit testing
      const metrics = ctx.measureText(text);
      node.bounds = {
        x: 0,
        y: -metrics.actualBoundingBoxAscent,
        width: metrics.width,
        height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
      };
      break;
    }

    case 'image': {
      const img = props._image as HTMLImageElement | undefined;
      const width = (props.width as number) ?? img?.naturalWidth ?? 0;
      const height = (props.height as number) ?? img?.naturalHeight ?? 0;

      if (img && img.complete) {
        ctx.drawImage(img, 0, 0, width, height);
      }

      node.bounds = { x: 0, y: 0, width, height };
      break;
    }
  }
}

/**
 * Recursively render a node and its children
 */
function renderNode(ctx: CanvasRenderingContext2D, node: CanvasNode): void {
  ctx.save();

  const { props } = node;

  // Apply transforms
  const x = (props.x as number) ?? 0;
  const y = (props.y as number) ?? 0;
  if (x !== 0 || y !== 0) {
    ctx.translate(x, y);
  }

  if (props.rotation !== undefined) {
    ctx.rotate(props.rotation as number);
  }

  const scaleX = props.scaleX as number | undefined;
  const scaleY = props.scaleY as number | undefined;
  if (scaleX !== undefined || scaleY !== undefined) {
    ctx.scale(scaleX ?? 1, scaleY ?? 1);
  }

  if (props.opacity !== undefined) {
    ctx.globalAlpha *= props.opacity as number;
  }

  // Draw this node
  drawNode(ctx, node);

  // Render children
  for (const child of node.children) {
    renderNode(ctx, child);
  }

  ctx.restore();
  node.dirty = false;
}

/**
 * Check if a node is a canvas bridge element (HTMLCanvasElement with scene graph)
 */
function isBridgeElement(node: CanvasElement): node is CanvasBridgeElement {
  return node instanceof HTMLCanvasElement && '__sceneRoot' in node;
}

/**
 * Check if a node is a scene graph node
 */
function isSceneNode(node: CanvasElement): node is CanvasNode {
  return 'type' in node && 'children' in node && !('__sceneRoot' in node);
}

export interface CanvasRendererOptions {
  /**
   * If true, automatically clear the canvas before each paint.
   * Default: true
   */
  autoClear?: boolean;

  /**
   * Background color to fill when clearing. If not set, clears to transparent.
   */
  clearColor?: string;
}

export interface CanvasRendererInstance extends Renderer<CanvasRendererConfig> {
  /** Perform hit testing on a specific canvas at a point */
  hitTest: (canvas: CanvasBridgeElement, x: number, y: number) => CanvasNode | null;
}

/**
 * Create a canvas renderer for composable DOM + Canvas rendering
 *
 * Usage:
 * ```typescript
 * const canvasRenderer = createCanvasRenderer();
 *
 * // In composed tree:
 * dom.el('div')(
 *   canvas.el('canvas', { width: 600, height: 400, clearColor: '#000' })(
 *     canvas.el('circle', { x: 100, y: 100, radius: 50, fill: 'red' })()
 *   )
 * )
 * ```
 *
 * The 'canvas' element type creates an HTMLCanvasElement that acts as a bridge
 * between DOM and the canvas scene graph. Children of the canvas element are
 * canvas primitives (circle, rect, etc.) that render to the 2D context.
 */
export function createCanvasRenderer(
  options: CanvasRendererOptions = {}
): CanvasRendererInstance {
  const { autoClear = true, clearColor } = options;

  /**
   * Create paint function for a bridge element
   */
  function createPaintFunction(bridge: CanvasBridgeElement): () => void {
    return function paint(): void {
      bridge.__frameRequested = false;

      const ctx = bridge.__ctx;
      const width = bridge.width;
      const height = bridge.height;
      const opts = bridge.__options;

      if (opts.autoClear) {
        if (opts.clearColor) {
          ctx.fillStyle = opts.clearColor;
          ctx.fillRect(0, 0, width, height);
        } else {
          ctx.clearRect(0, 0, width, height);
        }
      }

      // Render the entire tree from scene root
      for (const child of bridge.__sceneRoot.children) {
        renderNode(ctx, child);
      }
    };
  }

  /**
   * Create markDirty function for a bridge element
   */
  function createMarkDirtyFunction(bridge: CanvasBridgeElement): () => void {
    return function markDirty(): void {
      if (!bridge.__frameRequested) {
        bridge.__frameRequested = true;
        requestAnimationFrame(bridge.__paint);
      }
    };
  }

  /**
   * Create a bridge element (HTMLCanvasElement with scene graph)
   */
  function createBridgeElement(
    props: Record<string, unknown>
  ): CanvasBridgeElement {
    const canvas = document.createElement('canvas') as CanvasBridgeElement;

    // Set canvas dimensions
    canvas.width = (props.width as number) ?? 300;
    canvas.height = (props.height as number) ?? 150;

    // Get 2D context
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2d context');

    // Initialize bridge properties
    canvas.__ctx = ctx;
    canvas.__options = {
      autoClear: (props.autoClear as boolean) ?? autoClear,
      clearColor: (props.clearColor as string) ?? clearColor,
    };
    canvas.__frameRequested = false;

    // Create scene root
    canvas.__sceneRoot = {
      type: 'group',
      props: {},
      children: [],
      parent: null,
      dirty: true,
    };

    // Create paint and markDirty functions
    canvas.__paint = createPaintFunction(canvas);
    canvas.__markDirty = createMarkDirtyFunction(canvas);

    return canvas;
  }

  /**
   * Create a scene graph node
   */
  function createSceneNode(
    type: string,
    props: Record<string, unknown>
  ): CanvasNode {
    const node: CanvasNode = {
      type,
      props: props ?? {},
      children: [],
      parent: null,
      dirty: true,
    };

    // Handle image loading
    if (type === 'image' && props?.src) {
      const img = new Image();
      img.onload = () => {
        node.props._image = img;
        // Find the bridge element and mark dirty
        let current: CanvasNode | null = node;
        while (current?.parent) {
          current = current.parent;
        }
        // current is now the root, but we need the bridge...
        // This is handled by markDirty traversal
        node.dirty = true;
      };
      img.src = props.src as string;
      node.props._image = img;
    }

    return node;
  }

  /**
   * Find the bridge element that owns a scene node
   */
  function findBridge(node: CanvasNode): CanvasBridgeElement | null {
    // Walk up to find the scene root, which should be owned by a bridge
    let current: CanvasNode | null = node;
    while (current?.parent) {
      current = current.parent;
    }
    // current is now the root - we need to find which bridge owns it
    // This is a limitation - we'd need to store a back-reference
    // For now, we'll traverse all canvases... but that's not great
    // Better approach: store bridge reference on scene root
    if (current && '__bridge' in current) {
      return (current as CanvasNode & { __bridge: CanvasBridgeElement })
        .__bridge;
    }
    return null;
  }

  /**
   * Mark a scene node dirty and schedule repaint
   */
  function markSceneNodeDirty(node: CanvasNode): void {
    node.dirty = true;
    const bridge = findBridge(node);
    if (bridge) {
      bridge.__markDirty();
    }
  }

  // Hit testing for external use
  function hitTest(
    canvas: CanvasBridgeElement,
    x: number,
    y: number
  ): CanvasNode | null {
    const root = canvas.__sceneRoot;
    for (let i = root.children.length - 1; i >= 0; i--) {
      const child = root.children[i];
      if (child) {
        const hit = hitTestNode(x, y, child);
        if (hit) return hit;
      }
    }
    return null;
  }

  // Store renderer reference for identity checks
  const rendererInstance: CanvasRendererInstance = {
    hitTest,

    createNode: (
      type: string,
      props?: Record<string, unknown>,
      parentContext?: ParentContext<unknown>
    ) => {
      // 'canvas' type creates a bridge element (HTMLCanvasElement)
      // This is the boundary type - valid when parent is a different renderer (e.g., DOM)
      if (type === 'canvas') {
        return createBridgeElement(props ?? {});
      }

      // For non-bridge types, validate that parent renderer is this canvas renderer
      // This catches errors like: dom.el('div')(canvas.el('circle')()) - missing canvas boundary
      if (parentContext && parentContext.renderer !== rendererInstance) {
        throw new Error(
          `Canvas primitive '${type}' must be nested inside a canvas element. ` +
            `Use canvas.el('canvas', {...})(...) to create a canvas boundary.`
        );
      }

      // All other types create scene graph nodes
      return createSceneNode(type, props ?? {});
    },

    setProperty: (node, key, value) => {
      // Handle bridge element properties
      if (isBridgeElement(node)) {
        // Canvas-specific rendering options
        if (key === 'clearColor') {
          node.__options.clearColor = value as string;
          node.__markDirty();
        } else if (key === 'autoClear') {
          node.__options.autoClear = value as boolean;
          node.__markDirty();
        } else {
          // Forward all other props to HTMLCanvasElement (width, height, className, id, style, etc.)
          Reflect.set(node, key, value);
          // width/height changes need repaint
          if (key === 'width' || key === 'height') {
            node.__markDirty();
          }
        }
        return;
      }

      // Handle scene node properties
      if (isSceneNode(node)) {
        node.props[key] = value;

        // Handle image src changes
        if (node.type === 'image' && key === 'src') {
          const img = new Image();
          img.onload = () => {
            node.props._image = img;
            markSceneNodeDirty(node);
          };
          img.src = value as string;
          node.props._image = img;
        }

        markSceneNodeDirty(node);
      }
    },

    appendChild: (parent, child) => {
      // Parent is bridge element - append to its scene graph
      if (isBridgeElement(parent)) {
        if (isSceneNode(child)) {
          // Store back-reference to bridge on scene root
          const root = parent.__sceneRoot as CanvasNode & {
            __bridge?: CanvasBridgeElement;
          };
          root.__bridge = parent;

          child.parent = root;
          root.children.push(child);
          parent.__markDirty();
        }
        return;
      }

      // Parent is scene node - normal scene graph append
      if (isSceneNode(parent) && isSceneNode(child)) {
        child.parent = parent;
        parent.children.push(child);
        markSceneNodeDirty(parent);
      }
    },

    removeChild: (parent, child) => {
      // Parent is bridge element - remove from its scene graph
      if (isBridgeElement(parent)) {
        if (isSceneNode(child)) {
          const root = parent.__sceneRoot;
          const idx = root.children.indexOf(child);
          if (idx !== -1) root.children.splice(idx, 1);
          child.parent = null;
          parent.__markDirty();
        }
        return;
      }

      // Parent is scene node - normal scene graph remove
      if (isSceneNode(parent) && isSceneNode(child)) {
        const idx = parent.children.indexOf(child);
        if (idx !== -1) parent.children.splice(idx, 1);
        child.parent = null;
        markSceneNodeDirty(parent);
      }
    },

    insertBefore: (parent, child, reference) => {
      // Parent is bridge element - insert into its scene graph
      if (isBridgeElement(parent)) {
        if (isSceneNode(child)) {
          const root = parent.__sceneRoot as CanvasNode & {
            __bridge?: CanvasBridgeElement;
          };
          root.__bridge = parent;

          child.parent = root;
          if (reference && isSceneNode(reference)) {
            const idx = root.children.indexOf(reference);
            if (idx !== -1) {
              root.children.splice(idx, 0, child);
              parent.__markDirty();
              return;
            }
          }
          root.children.push(child);
          parent.__markDirty();
        }
        return;
      }

      // Parent is scene node - normal scene graph insert
      if (isSceneNode(parent) && isSceneNode(child)) {
        child.parent = parent;
        if (reference && isSceneNode(reference)) {
          const idx = parent.children.indexOf(reference);
          if (idx !== -1) {
            parent.children.splice(idx, 0, child);
            markSceneNodeDirty(parent);
            return;
          }
        }
        parent.children.push(child);
        markSceneNodeDirty(parent);
      }
    },
  };

  return rendererInstance;
}
