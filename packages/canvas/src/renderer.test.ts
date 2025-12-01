import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCanvasRenderer } from './renderer';
import type { CanvasBridgeElement, CanvasNode } from './types';

interface MockContext {
  save: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  translate: ReturnType<typeof vi.fn>;
  rotate: ReturnType<typeof vi.fn>;
  scale: ReturnType<typeof vi.fn>;
  clearRect: ReturnType<typeof vi.fn>;
  fillRect: ReturnType<typeof vi.fn>;
  strokeRect: ReturnType<typeof vi.fn>;
  beginPath: ReturnType<typeof vi.fn>;
  fill: ReturnType<typeof vi.fn>;
  stroke: ReturnType<typeof vi.fn>;
  ellipse: ReturnType<typeof vi.fn>;
  moveTo: ReturnType<typeof vi.fn>;
  lineTo: ReturnType<typeof vi.fn>;
  roundRect: ReturnType<typeof vi.fn>;
  fillText: ReturnType<typeof vi.fn>;
  strokeText: ReturnType<typeof vi.fn>;
  drawImage: ReturnType<typeof vi.fn>;
  measureText: ReturnType<typeof vi.fn>;
  globalAlpha: number;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  lineCap: string;
  lineJoin: string;
  font: string;
  textAlign: string;
  textBaseline: string;
}

// Mock document.createElement to return our mock canvas
function setupCanvasMock(ctx: MockContext): void {
  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(function (this: Document, tagName: string) {
    if (tagName === 'canvas') {
      // Create a real canvas element from the DOM
      const canvas = originalCreateElement.call(this, 'canvas') as HTMLCanvasElement;

      // Override getContext to return our mock
      canvas.getContext = vi.fn(() => ctx) as unknown as HTMLCanvasElement['getContext'];

      // Mock getBoundingClientRect
      canvas.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        top: 0,
        width: canvas.width || 800,
        height: canvas.height || 600,
        right: canvas.width || 800,
        bottom: canvas.height || 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }));

      // Spy on addEventListener and removeEventListener
      const originalAddEventListener = canvas.addEventListener.bind(canvas);
      const originalRemoveEventListener = canvas.removeEventListener.bind(canvas);

      canvas.addEventListener = vi.fn(originalAddEventListener);
      canvas.removeEventListener = vi.fn(originalRemoveEventListener);

      return canvas;
    }
    return originalCreateElement.call(this, tagName);
  });
}

function createMockContext(): MockContext {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    ellipse: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    roundRect: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    drawImage: vi.fn(),
    measureText: vi.fn(() => ({
      width: 100,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 2,
    })),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
  };
}

describe('createCanvasRenderer', () => {
  let ctx: MockContext;

  beforeEach(() => {
    ctx = createMockContext();
    setupCanvasMock(ctx);
    vi.useFakeTimers();
  });

  it('should create a renderer without requiring a canvas element', () => {
    const renderer = createCanvasRenderer();

    expect(renderer).toBeDefined();
    expect(renderer.createNode).toBeDefined();
    expect(renderer.setProperty).toBeDefined();
    expect(renderer.appendChild).toBeDefined();
    expect(renderer.removeChild).toBeDefined();
    expect(renderer.insertBefore).toBeDefined();
    expect(renderer.hitTest).toBeDefined();
  });

  it('should create bridge element with scene root', () => {
    const renderer = createCanvasRenderer();

    const bridge = renderer.createNode('canvas', { width: 800, height: 600 }) as CanvasBridgeElement;

    expect(bridge).toBeInstanceOf(HTMLCanvasElement);
    expect(bridge.width).toBe(800);
    expect(bridge.height).toBe(600);
    expect(bridge.__sceneRoot).toBeDefined();
    expect(bridge.__sceneRoot.type).toBe('group');
    expect(bridge.__sceneRoot.children).toEqual([]);
    expect(bridge.__paint).toBeDefined();
    expect(bridge.__markDirty).toBeDefined();
  });

  it('should create nodes with correct properties', () => {
    const renderer = createCanvasRenderer();

    const rect = renderer.createNode('rect', {
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      fill: 'red',
    }) as CanvasNode;

    expect(rect.type).toBe('rect');
    expect(rect.props.x).toBe(10);
    expect(rect.props.y).toBe(20);
    expect(rect.props.width).toBe(100);
    expect(rect.props.height).toBe(50);
    expect(rect.props.fill).toBe('red');
    expect(rect.dirty).toBe(true);
  });

  it('should throw error when canvas primitive is nested under different renderer', () => {
    const canvasRenderer = createCanvasRenderer();
    const differentRenderer = {}; // Simulates a different renderer (e.g., DOM)

    // Creating a canvas bridge element should work regardless of parent renderer
    expect(() =>
      canvasRenderer.createNode('canvas', { width: 800 }, {
        renderer: differentRenderer,
        element: {} as HTMLElement,
      })
    ).not.toThrow();

    // Creating a canvas primitive under a different renderer should throw
    expect(() =>
      canvasRenderer.createNode('circle', { radius: 50 }, {
        renderer: differentRenderer,
        element: {} as HTMLElement,
      })
    ).toThrow(/Canvas primitive 'circle' must be nested inside a canvas element/);

    // Creating a canvas primitive under the same renderer should work
    expect(() =>
      canvasRenderer.createNode('circle', { radius: 50 }, {
        renderer: canvasRenderer,
        element: {} as HTMLElement,
      })
    ).not.toThrow();

    // Creating without parent context should work (for direct usage)
    expect(() =>
      canvasRenderer.createNode('circle', { radius: 50 })
    ).not.toThrow();
  });

  it('should append children to bridge element', () => {
    const renderer = createCanvasRenderer();

    const bridge = renderer.createNode('canvas', { width: 800, height: 600 }) as CanvasBridgeElement;
    const rect = renderer.createNode('rect', { width: 50, height: 50 }) as CanvasNode;

    renderer.appendChild(bridge, rect);

    expect(bridge.__sceneRoot.children).toContain(rect);
    expect(rect.parent).toBe(bridge.__sceneRoot);
  });

  it('should append children to scene nodes', () => {
    const renderer = createCanvasRenderer();

    const group = renderer.createNode('group', {}) as CanvasNode;
    const rect = renderer.createNode('rect', { width: 50, height: 50 }) as CanvasNode;

    renderer.appendChild(group, rect);

    expect(group.children).toContain(rect);
    expect(rect.parent).toBe(group);
  });

  it('should remove children from bridge element', () => {
    const renderer = createCanvasRenderer();

    const bridge = renderer.createNode('canvas', { width: 800, height: 600 }) as CanvasBridgeElement;
    const rect = renderer.createNode('rect', {}) as CanvasNode;

    renderer.appendChild(bridge, rect);
    expect(bridge.__sceneRoot.children).toContain(rect);

    renderer.removeChild(bridge, rect);
    expect(bridge.__sceneRoot.children).not.toContain(rect);
    expect(rect.parent).toBeNull();
  });

  it('should insert before reference node in bridge element', () => {
    const renderer = createCanvasRenderer();

    const bridge = renderer.createNode('canvas', { width: 800, height: 600 }) as CanvasBridgeElement;
    const rect1 = renderer.createNode('rect', { id: 1 }) as CanvasNode;
    const rect2 = renderer.createNode('rect', { id: 2 }) as CanvasNode;
    const rect3 = renderer.createNode('rect', { id: 3 }) as CanvasNode;

    renderer.appendChild(bridge, rect1);
    renderer.appendChild(bridge, rect3);
    renderer.insertBefore(bridge, rect2, rect3);

    expect(bridge.__sceneRoot.children[0]).toBe(rect1);
    expect(bridge.__sceneRoot.children[1]).toBe(rect2);
    expect(bridge.__sceneRoot.children[2]).toBe(rect3);
  });

  it('should update properties and mark node dirty', () => {
    const renderer = createCanvasRenderer();

    const bridge = renderer.createNode('canvas', { width: 800, height: 600 }) as CanvasBridgeElement;
    const rect = renderer.createNode('rect', { x: 0 }) as CanvasNode;
    renderer.appendChild(bridge, rect);

    rect.dirty = false;
    bridge.__frameRequested = false;

    renderer.setProperty(rect, 'x', 100);

    expect(rect.props.x).toBe(100);
    expect(rect.dirty).toBe(true);
  });

  it('should schedule paint on appendChild to bridge', () => {
    const renderer = createCanvasRenderer();
    const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame');

    const bridge = renderer.createNode('canvas', { width: 800, height: 600 }) as CanvasBridgeElement;
    const rect = renderer.createNode('rect', {}) as CanvasNode;

    renderer.appendChild(bridge, rect);

    expect(rafSpy).toHaveBeenCalled();
  });

  it('should batch multiple changes into one paint', () => {
    const renderer = createCanvasRenderer();
    const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame');

    const bridge = renderer.createNode('canvas', { width: 800, height: 600 }) as CanvasBridgeElement;
    const rect1 = renderer.createNode('rect', {}) as CanvasNode;
    const rect2 = renderer.createNode('rect', {}) as CanvasNode;

    renderer.appendChild(bridge, rect1);
    renderer.appendChild(bridge, rect2);
    renderer.setProperty(rect1, 'x', 50);
    renderer.setProperty(rect2, 'y', 100);

    // Should only request one frame despite multiple changes
    expect(rafSpy).toHaveBeenCalledTimes(1);
  });

});

describe('hit testing', () => {
  let ctx: MockContext;

  beforeEach(() => {
    ctx = createMockContext();
    setupCanvasMock(ctx);
  });

  it('should hit test rect by bounds', () => {
    const renderer = createCanvasRenderer();

    const bridge = renderer.createNode('canvas', { width: 800, height: 600 }) as CanvasBridgeElement;
    const rect = renderer.createNode('rect', {
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      fill: 'red',
    }) as CanvasNode;
    // Manually set bounds (normally set during render)
    rect.bounds = { x: 0, y: 0, width: 50, height: 50 };

    renderer.appendChild(bridge, rect);

    // Hit inside rect (accounting for translation)
    expect(renderer.hitTest(bridge, 125, 125)).toBe(rect);

    // Miss outside rect
    expect(renderer.hitTest(bridge, 50, 50)).toBeNull();
    expect(renderer.hitTest(bridge, 200, 200)).toBeNull();
  });

  it('should hit test circle accurately', () => {
    const renderer = createCanvasRenderer();

    const bridge = renderer.createNode('canvas', { width: 800, height: 600 }) as CanvasBridgeElement;
    const circle = renderer.createNode('circle', {
      x: 100,
      y: 100,
      radius: 25,
      fill: 'blue',
    }) as CanvasNode;

    renderer.appendChild(bridge, circle);

    // Hit at center
    expect(renderer.hitTest(bridge, 100, 100)).toBe(circle);

    // Hit near edge (inside radius)
    expect(renderer.hitTest(bridge, 120, 100)).toBe(circle);

    // Miss at corner of bounding box (outside circle)
    expect(renderer.hitTest(bridge, 122, 122)).toBeNull();

    // Miss completely outside
    expect(renderer.hitTest(bridge, 200, 200)).toBeNull();
  });

  it('should return topmost node when overlapping', () => {
    const renderer = createCanvasRenderer();

    const bridge = renderer.createNode('canvas', { width: 800, height: 600 }) as CanvasBridgeElement;
    const rect1 = renderer.createNode('rect', {
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      fill: 'red',
    }) as CanvasNode;
    rect1.bounds = { x: 0, y: 0, width: 100, height: 100 };

    const rect2 = renderer.createNode('rect', {
      x: 75,
      y: 75,
      width: 100,
      height: 100,
      fill: 'blue',
    }) as CanvasNode;
    rect2.bounds = { x: 0, y: 0, width: 100, height: 100 };

    renderer.appendChild(bridge, rect1);
    renderer.appendChild(bridge, rect2);

    // Where they overlap, should hit rect2 (last child = top)
    expect(renderer.hitTest(bridge, 100, 100)).toBe(rect2);

    // Where only rect1, should hit rect1
    expect(renderer.hitTest(bridge, 60, 60)).toBe(rect1);
  });

  it('should handle transformed nodes', () => {
    const renderer = createCanvasRenderer();

    const bridge = renderer.createNode('canvas', { width: 800, height: 600 }) as CanvasBridgeElement;
    const group = renderer.createNode('group', {
      x: 100,
      y: 100,
    }) as CanvasNode;

    const rect = renderer.createNode('rect', {
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      fill: 'green',
    }) as CanvasNode;
    rect.bounds = { x: 0, y: 0, width: 50, height: 50 };

    renderer.appendChild(bridge, group);
    renderer.appendChild(group, rect);

    // Rect is at (100, 100) in world space due to group transform
    expect(renderer.hitTest(bridge, 125, 125)).toBe(rect);
    expect(renderer.hitTest(bridge, 50, 50)).toBeNull();
  });

  it('should skip groups in hit testing', () => {
    const renderer = createCanvasRenderer();

    const bridge = renderer.createNode('canvas', { width: 800, height: 600 }) as CanvasBridgeElement;
    const group = renderer.createNode('group', {
      x: 0,
      y: 0,
    }) as CanvasNode;

    renderer.appendChild(bridge, group);

    // Group itself should not be hit
    expect(renderer.hitTest(bridge, 10, 10)).toBeNull();
  });
});

describe('rendering', () => {
  let ctx: MockContext;

  beforeEach(() => {
    ctx = createMockContext();
    setupCanvasMock(ctx);
    vi.useFakeTimers();
  });

  it('should clear canvas before painting when autoClear is true', () => {
    const renderer = createCanvasRenderer({ autoClear: true });
    const bridge = renderer.createNode('canvas', { width: 800, height: 600, autoClear: true }) as CanvasBridgeElement;
    const rect = renderer.createNode('rect', { width: 50, height: 50, fill: 'red' }) as CanvasNode;
    renderer.appendChild(bridge, rect);

    // Trigger paint
    vi.runAllTimers();

    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
  });

  it('should fill with clearColor if provided', () => {
    const renderer = createCanvasRenderer({ autoClear: true, clearColor: '#000000' });
    const bridge = renderer.createNode('canvas', { width: 800, height: 600 }) as CanvasBridgeElement;
    const rect = renderer.createNode('rect', { width: 50, height: 50, fill: 'red' }) as CanvasNode;
    renderer.appendChild(bridge, rect);

    // Trigger paint
    vi.runAllTimers();

    // fillRect should be called twice: once for clear, once for rect
    // First call should be the background clear
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 800, 600);
  });

  it('should not clear if autoClear is false', () => {
    const renderer = createCanvasRenderer({ autoClear: false });
    const bridge = renderer.createNode('canvas', { width: 800, height: 600, autoClear: false }) as CanvasBridgeElement;
    const rect = renderer.createNode('rect', { width: 50, height: 50, fill: 'red' }) as CanvasNode;
    renderer.appendChild(bridge, rect);

    // Trigger paint
    vi.runAllTimers();

    // clearRect should only be called for the actual rect, not for clearing
    // Actually with autoClear false, clearRect shouldn't be called at all for clearing
    const clearCalls = (ctx.clearRect as ReturnType<typeof vi.fn>).mock.calls;
    const fullCanvasClear = clearCalls.find(
      (call: number[]) => call[0] === 0 && call[1] === 0 && call[2] === 800 && call[3] === 600
    );
    expect(fullCanvasClear).toBeUndefined();
  });

  it('should apply transforms when rendering', () => {
    const renderer = createCanvasRenderer();
    const bridge = renderer.createNode('canvas', { width: 800, height: 600 }) as CanvasBridgeElement;

    const rect = renderer.createNode('rect', {
      x: 100,
      y: 50,
      rotation: Math.PI / 4,
      scaleX: 2,
      scaleY: 0.5,
      opacity: 0.5,
      width: 50,
      height: 50,
      fill: 'red',
    }) as CanvasNode;

    renderer.appendChild(bridge, rect);

    // Trigger paint
    vi.runAllTimers();

    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.translate).toHaveBeenCalledWith(100, 50);
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 4);
    expect(ctx.scale).toHaveBeenCalledWith(2, 0.5);
    expect(ctx.restore).toHaveBeenCalled();
  });
});

describe('scene graph operations', () => {
  let ctx: MockContext;

  beforeEach(() => {
    ctx = createMockContext();
    setupCanvasMock(ctx);
  });

  it('should build a complex scene graph', () => {
    const renderer = createCanvasRenderer();

    const bridge = renderer.createNode('canvas', { width: 800, height: 600 }) as CanvasBridgeElement;

    // Create a scene with nested groups
    const background = renderer.createNode('rect', {
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      fill: '#1a1a2e',
    }) as CanvasNode;

    const playerGroup = renderer.createNode('group', { x: 400, y: 300 }) as CanvasNode;
    const playerBody = renderer.createNode('circle', { radius: 20, fill: '#e94560' }) as CanvasNode;
    const playerEye = renderer.createNode('circle', {
      x: 8,
      y: -5,
      radius: 5,
      fill: 'white',
    }) as CanvasNode;

    const uiGroup = renderer.createNode('group', { x: 10, y: 10 }) as CanvasNode;
    const scoreLabel = renderer.createNode('text', {
      text: 'Score: 0',
      fill: 'white',
      fontSize: 24,
    }) as CanvasNode;

    // Build tree
    renderer.appendChild(bridge, background);
    renderer.appendChild(bridge, playerGroup);
    renderer.appendChild(playerGroup, playerBody);
    renderer.appendChild(playerGroup, playerEye);
    renderer.appendChild(bridge, uiGroup);
    renderer.appendChild(uiGroup, scoreLabel);

    // Verify structure
    expect(bridge.__sceneRoot.children.length).toBe(3);
    expect(playerGroup.children.length).toBe(2);
    expect(uiGroup.children.length).toBe(1);
    expect(playerBody.parent).toBe(playerGroup);
    expect(scoreLabel.parent).toBe(uiGroup);
  });

  it('should handle reparenting nodes', () => {
    const renderer = createCanvasRenderer();

    const bridge = renderer.createNode('canvas', { width: 800, height: 600 }) as CanvasBridgeElement;
    const group1 = renderer.createNode('group', {}) as CanvasNode;
    const group2 = renderer.createNode('group', {}) as CanvasNode;
    const rect = renderer.createNode('rect', { width: 50, height: 50 }) as CanvasNode;

    renderer.appendChild(bridge, group1);
    renderer.appendChild(bridge, group2);
    renderer.appendChild(group1, rect);

    expect(group1.children).toContain(rect);
    expect(rect.parent).toBe(group1);

    // Reparent
    renderer.removeChild(group1, rect);
    renderer.appendChild(group2, rect);

    expect(group1.children).not.toContain(rect);
    expect(group2.children).toContain(rect);
    expect(rect.parent).toBe(group2);
  });
});
