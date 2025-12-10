/**
 * Tests for island-aware renderToString
 *
 * Tests HTML serialization of NodeRef trees:
 * - Element rendering via outerHTML
 * - Fragment rendering via child concatenation
 * - Error handling for invalid nodes
 * - Edge cases (empty fragments, nested structures)
 */

import { describe, it, expect } from 'vitest';
import { renderToString } from './renderToString';
import { STATUS_ELEMENT, STATUS_FRAGMENT } from '@lattice/view/types';
import type { NodeRef, ElementRef, FragmentRef } from '@lattice/view/types';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a mock element ref with outerHTML
 */
function createElementRef(html: string): ElementRef<unknown> {
  return {
    status: STATUS_ELEMENT,
    element: { outerHTML: html },
    parent: null,
    prev: null,
    next: null,
    firstChild: null,
    lastChild: null,
  };
}

/**
 * Create a mock fragment ref with children
 */
function createFragmentRef(children: NodeRef<unknown>[]): FragmentRef<unknown> {
  // Link children together
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const next = children[i + 1];
    if (child) {
      child.prev = i > 0 ? children[i - 1]! : null;
      child.next = next || null;
    }
  }

  return {
    status: STATUS_FRAGMENT,
    element: null,
    parent: null,
    prev: null,
    next: null,
    firstChild: children[0] || null,
    lastChild: children[children.length - 1] || null,
    attach: () => {},
  };
}

/**
 * Create an element ref without outerHTML (invalid)
 */
function createInvalidElementRef(): ElementRef<unknown> {
  return {
    status: STATUS_ELEMENT,
    element: {}, // No outerHTML property
    parent: null,
    prev: null,
    next: null,
    firstChild: null,
    lastChild: null,
  };
}

// ============================================================================
// Tests: Element Rendering
// ============================================================================

describe('Element Rendering', () => {
  it('should render element via outerHTML', () => {
    const element = createElementRef('<div class="test">Hello</div>');
    const result = renderToString(element);

    expect(result).toBe('<div class="test">Hello</div>');
  });

  it('should render self-closing element', () => {
    const element = createElementRef('<img src="test.jpg" />');
    const result = renderToString(element);

    expect(result).toBe('<img src="test.jpg" />');
  });

  it('should render element with attributes', () => {
    const element = createElementRef(
      '<button type="button" disabled>Click</button>'
    );
    const result = renderToString(element);

    expect(result).toBe('<button type="button" disabled>Click</button>');
  });

  it('should render element with nested children', () => {
    const element = createElementRef('<ul><li>Item 1</li><li>Item 2</li></ul>');
    const result = renderToString(element);

    expect(result).toBe('<ul><li>Item 1</li><li>Item 2</li></ul>');
  });

  it('should throw error when element lacks outerHTML', () => {
    const element = createInvalidElementRef();

    expect(() => renderToString(element)).toThrow(
      'Element does not have outerHTML property'
    );
    expect(() => renderToString(element)).toThrow(
      'Are you using linkedom renderer?'
    );
  });
});

// ============================================================================
// Tests: Fragment Rendering
// ============================================================================

describe('Fragment Rendering', () => {
  it('should render fragment by concatenating children', () => {
    const fragment = createFragmentRef([
      createElementRef('<span>First</span>'),
      createElementRef('<span>Second</span>'),
    ]);

    const result = renderToString(fragment);

    expect(result).toBe('<span>First</span><span>Second</span>');
  });

  it('should render empty fragment as empty string', () => {
    const fragment = createFragmentRef([]);

    const result = renderToString(fragment);

    expect(result).toBe('');
  });

  it('should render fragment with single child', () => {
    const fragment = createFragmentRef([
      createElementRef('<div>Only child</div>'),
    ]);

    const result = renderToString(fragment);

    expect(result).toBe('<div>Only child</div>');
  });

  it('should render fragment with many children', () => {
    const fragment = createFragmentRef([
      createElementRef('<h1>Title</h1>'),
      createElementRef('<p>Paragraph 1</p>'),
      createElementRef('<p>Paragraph 2</p>'),
      createElementRef('<footer>Footer</footer>'),
    ]);

    const result = renderToString(fragment);

    expect(result).toBe(
      '<h1>Title</h1><p>Paragraph 1</p><p>Paragraph 2</p><footer>Footer</footer>'
    );
  });
});

// ============================================================================
// Tests: Nested Fragments
// ============================================================================

describe('Nested Fragments', () => {
  it('should render fragment containing fragments', () => {
    const innerFragment1 = createFragmentRef([
      createElementRef('<span>A</span>'),
      createElementRef('<span>B</span>'),
    ]);

    const innerFragment2 = createFragmentRef([
      createElementRef('<span>C</span>'),
      createElementRef('<span>D</span>'),
    ]);

    const outerFragment = createFragmentRef([innerFragment1, innerFragment2]);

    const result = renderToString(outerFragment);

    expect(result).toBe(
      '<span>A</span><span>B</span><span>C</span><span>D</span>'
    );
  });

  it('should render deeply nested fragments', () => {
    const level3 = createFragmentRef([createElementRef('<i>Deep</i>')]);

    const level2 = createFragmentRef([createElementRef('<b>Mid</b>'), level3]);

    const level1 = createFragmentRef([
      createElementRef('<span>Top</span>'),
      level2,
    ]);

    const result = renderToString(level1);

    expect(result).toBe('<span>Top</span><b>Mid</b><i>Deep</i>');
  });

  it('should render fragment with mixed element and fragment children', () => {
    const innerFragment = createFragmentRef([
      createElementRef('<em>Italic</em>'),
      createElementRef('<strong>Bold</strong>'),
    ]);

    const outerFragment = createFragmentRef([
      createElementRef('<h2>Header</h2>'),
      innerFragment,
      createElementRef('<p>Paragraph</p>'),
    ]);

    const result = renderToString(outerFragment);

    expect(result).toBe(
      '<h2>Header</h2><em>Italic</em><strong>Bold</strong><p>Paragraph</p>'
    );
  });
});

// ============================================================================
// Tests: Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should return empty string for unknown node type', () => {
    // Create a node with invalid status by casting
    const unknownNode = {
      status: 999, // Invalid status
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
    } as unknown as NodeRef<unknown>;

    const result = renderToString(unknownNode);

    expect(result).toBe('');
  });

  it('should handle element with empty outerHTML', () => {
    const element = createElementRef('');

    const result = renderToString(element);

    expect(result).toBe('');
  });

  it('should preserve HTML special characters', () => {
    const element = createElementRef(
      '<div>&lt;script&gt;alert("XSS")&lt;/script&gt;</div>'
    );

    const result = renderToString(element);

    expect(result).toBe('<div>&lt;script&gt;alert("XSS")&lt;/script&gt;</div>');
  });

  it('should preserve whitespace in HTML', () => {
    const element = createElementRef('<pre>  Line 1\n  Line 2  </pre>');

    const result = renderToString(element);

    expect(result).toBe('<pre>  Line 1\n  Line 2  </pre>');
  });
});

// ============================================================================
// Tests: Island Markers
// ============================================================================

describe('Island Markers', () => {
  it('should preserve island script tags in element HTML', () => {
    const element = createElementRef(
      '<div data-island-id="counter-1">Count: 5</div><script type="application/json" data-island="counter-1"></script>'
    );

    const result = renderToString(element);

    expect(result).toContain('data-island-id="counter-1"');
    expect(result).toContain('data-island="counter-1"');
  });

  it('should preserve fragment boundary comments', () => {
    const fragment = createFragmentRef([
      createElementRef('<!--fragment-start-->'),
      createElementRef('<span>Item 1</span>'),
      createElementRef('<span>Item 2</span>'),
      createElementRef('<!--fragment-end-->'),
    ]);

    const result = renderToString(fragment);

    expect(result).toContain('<!--fragment-start-->');
    expect(result).toContain('<!--fragment-end-->');
  });

  it('should preserve island wrapper divs for fragments', () => {
    const element = createElementRef(
      '<div><!--fragment-start--><span>A</span><span>B</span><!--fragment-end--><script type="application/json" data-island="tags-1"></script></div>'
    );

    const result = renderToString(element);

    expect(result).toContain('<!--fragment-start-->');
    expect(result).toContain('<!--fragment-end-->');
    expect(result).toContain('data-island="tags-1"');
  });
});

// ============================================================================
// Tests: Rendering Invariants
// ============================================================================

describe('Rendering Invariants', () => {
  it('should satisfy: fragment with N children produces N HTML strings concatenated', () => {
    const children = [
      createElementRef('<a>1</a>'),
      createElementRef('<b>2</b>'),
      createElementRef('<c>3</c>'),
    ];

    const fragment = createFragmentRef(children);
    const result = renderToString(fragment);

    const expected = children.map((c) => renderToString(c)).join('');
    expect(result).toBe(expected);
  });

  it('should satisfy: rendering is idempotent (same input produces same output)', () => {
    const element = createElementRef('<div class="test">Content</div>');

    const result1 = renderToString(element);
    const result2 = renderToString(element);

    expect(result1).toBe(result2);
  });

  it('should satisfy: empty fragment renders as empty string', () => {
    const fragment = createFragmentRef([]);

    const result = renderToString(fragment);

    expect(result).toBe('');
    expect(result.length).toBe(0);
  });

  it('should satisfy: fragment rendering is order-preserving', () => {
    const children = [
      createElementRef('<first />'),
      createElementRef('<second />'),
      createElementRef('<third />'),
    ];

    const fragment = createFragmentRef(children);
    const result = renderToString(fragment);

    expect(result.indexOf('<first')).toBeLessThan(result.indexOf('<second'));
    expect(result.indexOf('<second')).toBeLessThan(result.indexOf('<third'));
  });
});

// ============================================================================
// Tests: Async Rendering (renderToStringAsync)
// ============================================================================

import { renderToStringAsync } from './renderToString';
import type { AsyncFragment } from './async-fragments';
import { ASYNC_FRAGMENT } from './async-fragments';
import type { LoadState } from '@lattice/view/load';
import { STATUS_REF_SPEC } from '@lattice/view/types';
import type { RefSpec } from '@lattice/view/types';
import { createDOMServerAdapter } from '../server/index';


/**
 * Create an async fragment for testing.
 * This is a simplified version that doesn't need the full adapter setup.
 * It creates fragments that can be resolved by resolveAsyncFragment.
 */
function createTestAsyncFragment<T>(
  fetcher: () => Promise<T>,
  renderer: (state: LoadState<T>) => RefSpec<unknown>
): AsyncFragment<unknown, T> {
  // Mutable state for hydration data and resolved status
  let hydrationData: T | undefined;
  let resolved = false;

  const fragment: AsyncFragment<unknown, T> = {
    // FragmentRef properties
    status: STATUS_FRAGMENT,
    element: null,
    parent: null,
    prev: null,
    next: null,
    firstChild: null,
    lastChild: null,
    // Stub attach - not used in SSR tests since we use resolveAsyncFragment directly
    attach: () => {},

    // Async metadata using new Symbol-based API
    [ASYNC_FRAGMENT]: {
      resolve: async () => {
        if (resolved && hydrationData !== undefined) {
          return hydrationData;
        }
        try {
          const result = await fetcher();
          hydrationData = result;
          resolved = true;

          // Mount the ready state to update fragment children
          const readySpec = renderer({
            status: (() => 'ready') as unknown as LoadState<T>['status'],
            data: (() => result) as unknown as LoadState<T>['data'],
            error: (() => undefined) as unknown as LoadState<T>['error'],
          });
          const readyNode = readySpec.create();

          // If the readyNode is an element, we need to get its content
          if (readyNode.status === STATUS_ELEMENT) {
            // For elements, set them directly as children
            fragment.firstChild = readyNode;
            fragment.lastChild = readyNode;
            (readyNode.parent as NodeRef<unknown> | null) = fragment as unknown as NodeRef<unknown>;
          } else if (readyNode.status === STATUS_FRAGMENT) {
            // For fragments, copy their children
            fragment.firstChild = readyNode.firstChild;
            fragment.lastChild = readyNode.lastChild;
            // Update parent references
            let child = fragment.firstChild;
            while (child) {
              (child.parent as NodeRef<unknown> | null) = fragment as unknown as NodeRef<unknown>;
              if (child === fragment.lastChild) break;
              child = child.next;
            }
          }

          return result;
        } catch (error) {
          resolved = true;

          // Mount the error state to update fragment children
          const errorSpec = renderer({
            status: (() => 'error') as unknown as LoadState<T>['status'],
            data: (() => undefined) as unknown as LoadState<T>['data'],
            error: (() => error) as unknown as LoadState<T>['error'],
          });
          const errorNode = errorSpec.create();

          // If the errorNode is an element, we need to get its content
          if (errorNode.status === STATUS_ELEMENT) {
            fragment.firstChild = errorNode;
            fragment.lastChild = errorNode;
            (errorNode.parent as NodeRef<unknown> | null) = fragment as unknown as NodeRef<unknown>;
          } else if (errorNode.status === STATUS_FRAGMENT) {
            fragment.firstChild = errorNode.firstChild;
            fragment.lastChild = errorNode.lastChild;
            let child = fragment.firstChild;
            while (child) {
              (child.parent as NodeRef<unknown> | null) = fragment as unknown as NodeRef<unknown>;
              if (child === fragment.lastChild) break;
              child = child.next;
            }
          }

          throw error;
        }
      },
      getData: () => hydrationData,
      setData: (data: T) => {
        hydrationData = data;
        resolved = true;
      },
      isResolved: () => resolved,
      trigger: () => {
        if (resolved) return;
        fetcher().then(
          (result) => {
            hydrationData = result;
            resolved = true;
          },
          () => {
            resolved = true;
          }
        );
      },
    },
  };

  // Set initial children from pending spec
  const pendingSpec = renderer({
    status: (() => 'pending') as unknown as LoadState<T>['status'],
    data: (() => undefined) as unknown as LoadState<T>['data'],
    error: (() => undefined) as unknown as LoadState<T>['error'],
  });
  const pendingNode = pendingSpec.create();

  if (pendingNode.status === STATUS_ELEMENT) {
    fragment.firstChild = pendingNode;
    fragment.lastChild = pendingNode;
    (pendingNode.parent as NodeRef<unknown> | null) = fragment as unknown as NodeRef<unknown>;
  } else if (pendingNode.status === STATUS_FRAGMENT) {
    fragment.firstChild = pendingNode.firstChild;
    fragment.lastChild = pendingNode.lastChild;
    let child = fragment.firstChild;
    while (child) {
      (child.parent as NodeRef<unknown> | null) = fragment as unknown as NodeRef<unknown>;
      if (child === fragment.lastChild) break;
      child = child.next;
    }
  }

  return fragment;
}

// Alias for cleaner tests
const load = createTestAsyncFragment;

/**
 * Create a mock RefSpec that returns a given element when mounted
 */
function createMockRefSpec(html: string): RefSpec<unknown> {
  return {
    status: STATUS_REF_SPEC,
    create: () => createElementRef(html),
  };
}

/**
 * Mock mount function that calls create() on RefSpec
 */
function mockMount(spec: RefSpec<unknown>): NodeRef<unknown> {
  return spec.create();
}

/**
 * Mock service context with adapter
 */
function createMockService() {
  const adapter = createDOMServerAdapter();
  const svc = {
    el: (tag: string) => (content: string) =>
      createMockRefSpec(`<${tag}>${content}</${tag}>`),
  };
  return { svc, adapter };
}

describe('Async Rendering - renderToStringAsync', () => {
  it('should render a simple async fragment', async () => {
    const { svc, adapter } = createMockService();
    const asyncFrag = load(
      async () => 'content',
      (state: LoadState<string>) =>
        state.status() === 'ready'
          ? createMockRefSpec('<div>Loaded content</div>')
          : createMockRefSpec('<div>Loading...</div>')
    );

    const result = await renderToStringAsync(asyncFrag, {
      svc,
      mount: mockMount,
      adapter,
    });

    expect(result).toBe('<div>Loaded content</div>');
  });

  it('should render async fragment and resolve data', async () => {
    const { svc, adapter } = createMockService();
    const asyncFrag = load(
      async () => ({ message: 'Hello' }),
      (state: LoadState<{ message: string }>) =>
        state.status() === 'ready'
          ? createMockRefSpec('<div>Hello</div>')
          : createMockRefSpec('<div>Loading...</div>')
    );

    const result = await renderToStringAsync(asyncFrag, {
      svc,
      mount: mockMount,
      adapter,
    });

    expect(result).toBe('<div>Hello</div>');
    expect(asyncFrag[ASYNC_FRAGMENT].isResolved()).toBe(true);
    expect(asyncFrag[ASYNC_FRAGMENT].getData()).toEqual({ message: 'Hello' });
  });

  it('should render RefSpec directly', async () => {
    const { svc, adapter } = createMockService();
    const spec = createMockRefSpec('<span>Direct spec</span>');

    const result = await renderToStringAsync(spec, {
      svc,
      mount: mockMount,
      adapter,
    });

    expect(result).toBe('<span>Direct spec</span>');
  });

  it('should render NodeRef directly', async () => {
    const { svc, adapter } = createMockService();
    const nodeRef = createElementRef('<p>Direct node</p>');

    const result = await renderToStringAsync(nodeRef, {
      svc,
      mount: mockMount,
      adapter,
    });

    expect(result).toBe('<p>Direct node</p>');
  });

  it('should resolve async fragments nested inside elements', async () => {
    const { svc, adapter } = createMockService();
    // Create an async fragment
    const asyncChild = load(
      async () => 'child',
      (state: LoadState<string>) =>
        state.status() === 'ready'
          ? createMockRefSpec('<span>Async child</span>')
          : createMockRefSpec('<span>Loading...</span>')
    );

    // Create a parent element that contains the async fragment
    const parentElement = createElementRef('<div>Parent</div>');
    parentElement.firstChild = asyncChild;
    parentElement.lastChild = asyncChild;
    asyncChild.parent = parentElement;

    const result = await renderToStringAsync(parentElement, {
      svc,
      mount: mockMount,
      adapter,
    });

    // The async child should be resolved and its content rendered
    expect(result).toContain('Parent');
    // After resolution, the fragment should have content
    expect(asyncChild.firstChild).not.toBeNull();
  });

  it('should resolve multiple async fragments in parallel', async () => {
    const { svc, adapter } = createMockService();
    const resolveOrder: string[] = [];

    const asyncFrag1 = load(
      async () => {
        await new Promise((r) => setTimeout(r, 50));
        resolveOrder.push('first');
        return 'first';
      },
      (state: LoadState<string>) =>
        state.status() === 'ready'
          ? createMockRefSpec('<div>First</div>')
          : createMockRefSpec('<div>Loading...</div>')
    );

    const asyncFrag2 = load(
      async () => {
        await new Promise((r) => setTimeout(r, 10));
        resolveOrder.push('second');
        return 'second';
      },
      (state: LoadState<string>) =>
        state.status() === 'ready'
          ? createMockRefSpec('<div>Second</div>')
          : createMockRefSpec('<div>Loading...</div>')
    );

    // Create a parent with both async fragments
    const parent = createFragmentRef([asyncFrag1, asyncFrag2]);

    await renderToStringAsync(parent, {
      svc,
      mount: mockMount,
      adapter,
    });

    // Both should resolve, with second finishing first due to shorter delay
    expect(resolveOrder).toContain('first');
    expect(resolveOrder).toContain('second');
    // Second should resolve before first due to parallel execution
    expect(resolveOrder.indexOf('second')).toBeLessThan(
      resolveOrder.indexOf('first')
    );
  });
});

describe('Async Rendering - Nested Async Fragments', () => {
  it('should resolve deeply nested async fragments', async () => {
    const { svc, adapter } = createMockService();
    // Inner async fragment (level 2)
    const innerAsync = load(
      async () => 'inner',
      (state: LoadState<string>) =>
        state.status() === 'ready'
          ? createMockRefSpec('<span>Inner async content</span>')
          : createMockRefSpec('<span>Loading...</span>')
    );

    // Outer async fragment (level 1) that returns content containing the inner async
    const outerAsync = load(
      async () => 'outer',
      (state: LoadState<string>) => {
        if (state.status() !== 'ready') {
          return createMockRefSpec('<div>Loading...</div>');
        }
        // Create a spec that when mounted, has the innerAsync as a child
        const outerElement = createElementRef('<div>Outer</div>');
        outerElement.firstChild = innerAsync;
        outerElement.lastChild = innerAsync;
        innerAsync.parent = outerElement;

        return {
          status: STATUS_REF_SPEC,
          create: () => outerElement,
        } as RefSpec<unknown>;
      }
    );

    const result = await renderToStringAsync(outerAsync, {
      svc,
      mount: mockMount,
      adapter,
    });

    // Both outer and inner async should be resolved
    expect(result).toContain('Outer');

    // The inner async fragment should have been resolved and populated
    expect(innerAsync.firstChild).not.toBeNull();
    expect(innerAsync[ASYNC_FRAGMENT].isResolved()).toBe(true);
  });

  it('should resolve three levels of nested async fragments', async () => {
    const { svc, adapter } = createMockService();
    const resolutionOrder: string[] = [];

    // Level 3 (deepest)
    const level3Async = load(
      async () => {
        resolutionOrder.push('level3');
        return 'level3';
      },
      (state: LoadState<string>) =>
        state.status() === 'ready'
          ? createMockRefSpec('<span>Level 3</span>')
          : createMockRefSpec('<span>Loading...</span>')
    );

    // Level 2
    const level2Async = load(
      async () => {
        resolutionOrder.push('level2');
        return 'level2';
      },
      (state: LoadState<string>) => {
        if (state.status() !== 'ready') {
          return createMockRefSpec('<div>Loading...</div>');
        }
        const el = createElementRef('<div>Level 2</div>');
        el.firstChild = level3Async;
        el.lastChild = level3Async;
        level3Async.parent = el;
        return {
          status: STATUS_REF_SPEC,
          create: () => el,
        } as RefSpec<unknown>;
      }
    );

    // Level 1 (outermost)
    const level1Async = load(
      async () => {
        resolutionOrder.push('level1');
        return 'level1';
      },
      (state: LoadState<string>) => {
        if (state.status() !== 'ready') {
          return createMockRefSpec('<main>Loading...</main>');
        }
        const el = createElementRef('<main>Level 1</main>');
        el.firstChild = level2Async;
        el.lastChild = level2Async;
        level2Async.parent = el;
        return {
          status: STATUS_REF_SPEC,
          create: () => el,
        } as RefSpec<unknown>;
      }
    );

    await renderToStringAsync(level1Async, {
      svc,
      mount: mockMount,
      adapter,
    });

    // All three levels should be resolved
    expect(resolutionOrder).toContain('level1');
    expect(resolutionOrder).toContain('level2');
    expect(resolutionOrder).toContain('level3');

    // Each async fragment should have resolved content
    expect(level1Async[ASYNC_FRAGMENT].isResolved()).toBe(true);
    expect(level2Async[ASYNC_FRAGMENT].isResolved()).toBe(true);
    expect(level3Async[ASYNC_FRAGMENT].isResolved()).toBe(true);

    // Each should have children populated
    expect(level3Async.firstChild).not.toBeNull();
  });
});

