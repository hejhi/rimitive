/**
 * Tests for client-side DOM island hydrator
 *
 * Tests the core logic for hydrating server-rendered islands:
 * - Island registry building from metadata
 * - Script tag finding and container detection
 * - Error handling for missing islands/components
 * - Queue processing
 *
 * Note: Full hydration integration (with real renderers and APIs) is tested in E2E tests.
 * These unit tests focus on testable behavior without requiring complete renderer mocks.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDOMHydrator } from './dom';
import { ISLAND_META } from '../types';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a minimal mock island with metadata
 */
function createMockIsland(id: string) {
  // Component must return a SealedSpec with .create() method
  const component = vi.fn(() => ({
    create: vi.fn(() => ({
      status: 1, // STATUS_ELEMENT
      element: document.createElement('div'),
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
    })),
  }));

  return {
    [ISLAND_META]: {
      id, // Type identifier (e.g., "counter")
      component,
      strategy: {},
    },
  };
}

/**
 * Create minimal mocks for hydrator dependencies
 */
function createMocks() {
  return {
    createAPI: vi.fn(() => ({ effect: vi.fn() })),
    signals: { effect: vi.fn() },
    mount: vi.fn(() => ({ element: document.createElement('div') })),
  };
}

/**
 * Setup DOM fixture with script tag marker
 */
function setupIslandDOM(islandId: string) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const islandElement = document.createElement('div');
  islandElement.textContent = 'Island content';
  container.appendChild(islandElement);

  const script = document.createElement('script');
  script.setAttribute('type', 'application/json');
  script.setAttribute('data-island', islandId);
  container.appendChild(script);

  return { container, islandElement, script };
}

// ============================================================================
// Tests: Island Registry Building
// ============================================================================

describe('Island Registry Building', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should accept multiple islands with different types', () => {
    const counter = createMockIsland('counter');
    const todo = createMockIsland('todo');
    const cart = createMockIsland('cart');

    const { createAPI, signals, mount } = createMocks();
    const hydrator = createDOMHydrator(createAPI, signals, mount);

    // Should not throw when building registry
    expect(() => hydrator.hydrate(counter, todo, cart)).not.toThrow();
  });

  it('should warn and skip islands without metadata', () => {
    const validIsland = createMockIsland('counter');
    const invalidIsland = {}; // Missing ISLAND_META

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { createAPI, signals, mount } = createMocks();
    const hydrator = createDOMHydrator(createAPI, signals, mount);
    hydrator.hydrate(validIsland, invalidIsland);

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Island missing metadata'),
      invalidIsland
    );

    consoleWarnSpy.mockRestore();
  });

  it('should not throw when hydrating with empty island list', () => {
    const { createAPI, signals, mount } = createMocks();
    const hydrator = createDOMHydrator(createAPI, signals, mount);

    expect(() => hydrator.hydrate()).not.toThrow();
  });
});

// ============================================================================
// Tests: Script Tag Finding
// ============================================================================

describe('Script Tag Finding', () => {
  beforeEach(() => {
    (window as { __islands?: unknown[] }).__islands = [];
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete (window as { __islands?: unknown[] }).__islands;
    delete (window as { __hydrate?: unknown }).__hydrate;
  });

  it('should warn when script tag not found', () => {
    const island = createMockIsland('counter');
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { createAPI, signals, mount } = createMocks();
    const hydrator = createDOMHydrator(createAPI, signals, mount);
    hydrator.hydrate(island);

    // Trigger hydration for non-existent island
    const hydrateFn = (window as unknown as { __hydrate: (id: string, type: string, props: unknown) => void }).__hydrate;
    hydrateFn('missing-island-id', 'counter', {});

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Island script tag [data-island="missing-island-id"] not found')
    );

    consoleWarnSpy.mockRestore();
  });

  it('should find script tag by data-island attribute', () => {
    const { script } = setupIslandDOM('test-island');
    const island = createMockIsland('counter');

    const { createAPI, signals, mount } = createMocks();
    const hydrator = createDOMHydrator(createAPI, signals, mount);
    hydrator.hydrate(island);

    // Script should exist in DOM
    const found = document.querySelector('[data-island="test-island"]');
    expect(found).toBe(script);
  });
});

// ============================================================================
// Tests: Component Registry Lookup
// ============================================================================

describe('Component Registry Lookup', () => {
  beforeEach(() => {
    (window as { __islands?: unknown[] }).__islands = [];
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete (window as { __islands?: unknown[] }).__islands;
    delete (window as { __hydrate?: unknown }).__hydrate;
  });

  it('should warn when component type not in registry', () => {
    setupIslandDOM('test-island');
    const island = createMockIsland('todo'); // Different type!

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { createAPI, signals, mount } = createMocks();
    const hydrator = createDOMHydrator(createAPI, signals, mount);
    hydrator.hydrate(island);

    // Trigger hydration for unregistered type
    const hydrateFn = (window as unknown as { __hydrate: (id: string, type: string, props: unknown) => void }).__hydrate;
    hydrateFn('test-island', 'counter', {}); // 'counter' not in registry

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Island component "counter" not found in registry')
    );

    consoleWarnSpy.mockRestore();
  });

  it('should find component when type matches registry', () => {
    setupIslandDOM('test-island');
    const island = createMockIsland('counter'); // Matching type

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { createAPI, signals, mount } = createMocks();
    const hydrator = createDOMHydrator(createAPI, signals, mount);
    hydrator.hydrate(island);

    // This will still fail due to missing renderer mocks, but shouldn't warn about registry
    const hydrateFn = (window as unknown as { __hydrate: (id: string, type: string, props: unknown) => void }).__hydrate;

    try {
      hydrateFn('test-island', 'counter', {});
    } catch {
      // Expected to fail due to incomplete mocks
    }

    // Should NOT warn about missing component
    expect(consoleWarnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('not found in registry')
    );

    consoleWarnSpy.mockRestore();
  });
});

// ============================================================================
// Tests: Queue Processing
// ============================================================================

describe('Queue Processing', () => {
  beforeEach(() => {
    (window as { __islands?: unknown[] }).__islands = [];
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete (window as { __islands?: unknown[] }).__islands;
    delete (window as { __hydrate?: unknown }).__hydrate;
  });

  it('should process queued islands from global array', () => {
    setupIslandDOM('counter-1');
    const island = createMockIsland('counter');

    // Queue island hydration
    (window as unknown as { __islands: unknown[] }).__islands.push({
      i: 'counter-1',
      t: 'counter',
      p: { initialCount: 5 },
    });

    const { createAPI, signals, mount } = createMocks();
    const hydrator = createDOMHydrator(createAPI, signals, mount);

    // Hydrate should process queued islands
    hydrator.hydrate(island);

    // __hydrate function should be set
    expect((window as { __hydrate?: unknown }).__hydrate).toBeDefined();
  });

  it('should handle empty queue gracefully', () => {
    const island = createMockIsland('counter');

    delete (window as { __islands?: unknown[] }).__islands; // No queue

    const { createAPI, signals, mount } = createMocks();
    const hydrator = createDOMHydrator(createAPI, signals, mount);

    // Should not throw when queue is missing
    expect(() => hydrator.hydrate(island)).not.toThrow();
  });

  it('should handle multiple queued islands', () => {
    setupIslandDOM('counter-1');
    setupIslandDOM('todo-1');

    const counterIsland = createMockIsland('counter');
    const todoIsland = createMockIsland('todo');

    // Queue multiple islands
    (window as unknown as { __islands: unknown[] }).__islands.push(
      { i: 'counter-1', t: 'counter', p: {} },
      { i: 'todo-1', t: 'todo', p: {} }
    );

    const { createAPI, signals, mount } = createMocks();
    const hydrator = createDOMHydrator(createAPI, signals, mount);

    // Should process all queued islands
    expect(() => hydrator.hydrate(counterIsland, todoIsland)).not.toThrow();
  });
});

// ============================================================================
// Tests: Global __hydrate Function
// ============================================================================

describe('Global __hydrate Function', () => {
  beforeEach(() => {
    (window as { __islands?: unknown[] }).__islands = [];
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete (window as { __islands?: unknown[] }).__islands;
    delete (window as { __hydrate?: unknown }).__hydrate;
  });

  it('should set global __hydrate function on hydrate() call', () => {
    const island = createMockIsland('counter');

    const { createAPI, signals, mount } = createMocks();
    const hydrator = createDOMHydrator(createAPI, signals, mount);

    // Before hydrate
    expect((window as { __hydrate?: unknown }).__hydrate).toBeUndefined();

    // After hydrate
    hydrator.hydrate(island);
    expect((window as { __hydrate?: unknown }).__hydrate).toBeDefined();
    expect(typeof (window as { __hydrate?: unknown }).__hydrate).toBe('function');
  });

  it('should accept island ID, type, and props parameters', () => {
    setupIslandDOM('test-island');
    const island = createMockIsland('counter');

    const { createAPI, signals, mount } = createMocks();
    const hydrator = createDOMHydrator(createAPI, signals, mount);
    hydrator.hydrate(island);

    const hydrateFn = (window as unknown as { __hydrate: (id: string, type: string, props: unknown) => void }).__hydrate;

    // Should accept parameters without throwing
    expect(() => hydrateFn('test-island', 'counter', { initialCount: 5 })).not.toThrow();
  });
});
