/**
 * Tests for DOM Server Renderer (Island-aware SSR with linkedom)
 *
 * This test suite validates SSR-specific behaviors:
 * - Fragment decoration with HTML comments
 * - Island decoration with script tags
 * - Attribute handling for SSR
 */

import { describe, it, expect } from 'vitest';
import { createDOMServerRenderer, type DOMServerRendererConfig } from './dom-server';
import { STATUS_ELEMENT, STATUS_FRAGMENT } from '@lattice/view/types';
import type { ElementRef, FragmentRef, RefSpec } from '@lattice/view/types';
import { createSignalsApi } from '@lattice/signals/presets/core';
import { defaultExtensions as defaultViewExtensions } from '@lattice/view/presets/core';
import { createSpec } from '@lattice/view/helpers';
import { composeFrom } from '@lattice/lattice';
import { renderToString } from '../helpers/renderToString';
import { createSSRContext, runWithSSRContext } from '../ssr-context';
import type { IslandNodeMeta } from '../types';

/**
 * Create SSR service for tests - matches the old preset pattern
 * Uses explicit composition to preserve full type inference
 */
function createTestSSRService(signals = createSignalsApi()) {
  const renderer = createDOMServerRenderer();
  const viewHelpers = createSpec(renderer, signals);
  const baseExtensions = defaultViewExtensions<DOMServerRendererConfig>();
  const views = composeFrom(baseExtensions, viewHelpers);

  const svc = {
    ...signals,
    ...views,
  };

  return {
    svc,
    renderer,
    mount: <TElement>(spec: RefSpec<TElement>) => spec.create(svc),
  };
}

// ============================================================================
// Tests: Basic DOM Operations
// ============================================================================

describe('Basic DOM Operations', () => {
  it('should create elements with correct tag names', () => {
    const renderer = createDOMServerRenderer();

    const div = renderer.createElement('div');
    const span = renderer.createElement('span');

    expect(div.tagName.toLowerCase()).toBe('div');
    expect(span.tagName.toLowerCase()).toBe('span');
  });

  it('should create text nodes with correct content', () => {
    const renderer = createDOMServerRenderer();

    const text = renderer.createTextNode('Hello');

    expect(text.textContent).toBe('Hello');
  });

  it('should append children to parent', () => {
    const renderer = createDOMServerRenderer();

    const div = renderer.createElement('div');
    const span = renderer.createElement('span');

    renderer.appendChild(div, span);

    expect(div.children.length).toBe(1);
    expect(div.children[0]).toBe(span);
  });

  it('should insert child before reference node', () => {
    const renderer = createDOMServerRenderer();

    const div = renderer.createElement('div');
    const first = renderer.createTextNode('first');
    const second = renderer.createTextNode('second');

    renderer.appendChild(div, second);
    renderer.insertBefore(div, first, second);

    expect(div.childNodes[0]).toBe(first);
    expect(div.childNodes[1]).toBe(second);
  });

  it('should update text node content', () => {
    const renderer = createDOMServerRenderer();

    const text = renderer.createTextNode('before');
    renderer.updateTextNode(text, 'after');

    expect(text.textContent).toBe('after');
  });
});

// ============================================================================
// Tests: Attribute Handling for SSR
// ============================================================================

describe('Attribute Handling', () => {
  it('should skip event handler attributes', () => {
    const renderer = createDOMServerRenderer();

    const button = renderer.createElement('button');
    renderer.setAttribute(button, 'onClick', () => {});

    expect(button.hasAttribute('onClick')).toBe(false);
    expect(button.hasAttribute('onclick')).toBe(false);
  });

  it('should map className to class attribute', () => {
    const renderer = createDOMServerRenderer();

    const div = renderer.createElement('div');
    renderer.setAttribute(div, 'className', 'container');

    expect(div.getAttribute('class')).toBe('container');
    expect(div.hasAttribute('className')).toBe(false);
  });

  it('should stringify primitive values', () => {
    const renderer = createDOMServerRenderer();

    const div = renderer.createElement('div');
    renderer.setAttribute(div, 'data-count', 42);
    renderer.setAttribute(div, 'data-active', true);

    expect(div.getAttribute('data-count')).toBe('42');
    expect(div.getAttribute('data-active')).toBe('true');
  });

  it('should skip object values', () => {
    const renderer = createDOMServerRenderer();

    const div = renderer.createElement('div');
    renderer.setAttribute(div, 'data-config', { foo: 'bar' });

    expect(div.hasAttribute('data-config')).toBe(false);
  });

  it('should skip function values', () => {
    const renderer = createDOMServerRenderer();

    const div = renderer.createElement('div');
    renderer.setAttribute(div, 'ref', () => {});

    expect(div.hasAttribute('ref')).toBe(false);
  });

  it('should skip null and false values', () => {
    const renderer = createDOMServerRenderer();

    const div = renderer.createElement('div');
    renderer.setAttribute(div, 'disabled', null);
    renderer.setAttribute(div, 'hidden', false);

    expect(div.hasAttribute('disabled')).toBe(false);
    expect(div.hasAttribute('hidden')).toBe(false);
  });
});

// ============================================================================
// Tests: Fragment Decoration (Non-Island)
// ============================================================================

describe('Fragment Decoration (Non-Island)', () => {
  it('should add fragment-start and fragment-end comments', () => {
    const renderer = createDOMServerRenderer();

    const container = renderer.createElement('div');
    const child1 = renderer.createElement('span');
    const child2 = renderer.createElement('span');

    renderer.appendChild(container, child1);
    renderer.appendChild(container, child2);

    const child1Ref: ElementRef<HTMLElement> = {
      status: STATUS_ELEMENT,
      element: child1,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
    };

    const child2Ref: ElementRef<HTMLElement> = {
      status: STATUS_ELEMENT,
      element: child2,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
    };

    const fragment: FragmentRef<HTMLElement> = {
      status: STATUS_FRAGMENT,
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: child1Ref,
      lastChild: child2Ref,
      attach: () => {},
    };

    renderer.decorateFragment?.(fragment, container);

    const html = container.innerHTML;
    expect(html).toContain('<!--fragment-start-->');
    expect(html).toContain('<!--fragment-end-->');
  });

  it('should place comments around fragment children', () => {
    const renderer = createDOMServerRenderer();

    const container = renderer.createElement('div');
    const span1 = renderer.createElement('span');
    const span2 = renderer.createElement('span');

    span1.textContent = 'first';
    span2.textContent = 'second';

    renderer.appendChild(container, span1);
    renderer.appendChild(container, span2);

    const span1Ref: ElementRef<HTMLElement> = {
      status: STATUS_ELEMENT,
      element: span1,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
    };

    const span2Ref: ElementRef<HTMLElement> = {
      status: STATUS_ELEMENT,
      element: span2,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
    };

    const fragment: FragmentRef<HTMLElement> = {
      status: STATUS_FRAGMENT,
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: span1Ref,
      lastChild: span2Ref,
      attach: () => {},
    };

    renderer.decorateFragment?.(fragment, container);

    const html = container.innerHTML;
    expect(html).toMatch(
      /<!--fragment-start--><span>first<\/span><span>second<\/span><!--fragment-end-->/
    );
  });

  it('should skip empty fragments', () => {
    const renderer = createDOMServerRenderer();

    const container = renderer.createElement('div');

    const fragment: FragmentRef<HTMLElement> = {
      status: STATUS_FRAGMENT,
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
      attach: () => {},
    };

    renderer.decorateFragment?.(fragment, container);

    const html = container.innerHTML;
    expect(html).not.toContain('<!--fragment-start-->');
    expect(html).not.toContain('<!--fragment-end-->');
  });
});

// ============================================================================
// Tests: Island Decoration (Fragment Islands)
// ============================================================================

describe('Fragment Island Decoration', () => {
  it('should wrap island fragment in div with script tag', () => {
    const ctx = createSSRContext();
    const renderer = createDOMServerRenderer();

    runWithSSRContext(ctx, () => {
      const container = renderer.createElement('div');
      const span = renderer.createElement('span');
      span.textContent = 'island content';

      renderer.appendChild(container, span);

      const spanRef: ElementRef<HTMLElement> = {
        status: STATUS_ELEMENT,
        element: span,
        parent: null,
        prev: null,
        next: null,
        firstChild: null,
        lastChild: null,
      };

      // Use __islandMeta for lazy registration (new architecture)
      const fragment: FragmentRef<HTMLElement> & { __islandMeta?: IslandNodeMeta } = {
        status: STATUS_FRAGMENT,
        element: null,
        parent: null,
        prev: null,
        next: null,
        firstChild: spanRef,
        lastChild: spanRef,
        attach: () => {},
        __islandMeta: { type: 'test-island', props: {} },
      };

      renderer.decorateFragment?.(fragment, container);

      const html = container.innerHTML;
      expect(html).toContain('<div>');
      expect(html).toContain('<!--fragment-start-->');
      expect(html).toContain('<!--fragment-end-->');
      expect(html).toContain('data-island="test-island-0"'); // Instance ID from registerIsland
      expect(html).toContain('type="application/json"');
      expect(html).toContain('<script');
      expect(html).toContain('</div>');

      // Verify registration happened
      expect(ctx.islands).toHaveLength(1);
      expect(ctx.islands[0]?.type).toBe('test-island');
    });
  });

  it('should preserve fragment children inside island wrapper', () => {
    const ctx = createSSRContext();
    const renderer = createDOMServerRenderer();

    runWithSSRContext(ctx, () => {
      const container = renderer.createElement('div');
      const span1 = renderer.createElement('span');
      const span2 = renderer.createElement('span');

      span1.textContent = 'first';
      span2.textContent = 'second';

      renderer.appendChild(container, span1);
      renderer.appendChild(container, span2);

      const span1Ref: ElementRef<HTMLElement> = {
        status: STATUS_ELEMENT,
        element: span1,
        parent: null,
        prev: null,
        next: null,
        firstChild: null,
        lastChild: null,
      };

      const span2Ref: ElementRef<HTMLElement> = {
        status: STATUS_ELEMENT,
        element: span2,
        parent: null,
        prev: null,
        next: null,
        firstChild: null,
        lastChild: null,
      };

      // Use __islandMeta for lazy registration (new architecture)
      const fragment: FragmentRef<HTMLElement> & { __islandMeta?: IslandNodeMeta } = {
        status: STATUS_FRAGMENT,
        element: null,
        parent: null,
        prev: null,
        next: null,
        firstChild: span1Ref,
        lastChild: span2Ref,
        attach: () => {},
        __islandMeta: { type: 'multi-island', props: {} },
      };

      renderer.decorateFragment?.(fragment, container);

      const html = container.innerHTML;
      expect(html).toContain('<span>first</span>');
      expect(html).toContain('<span>second</span>');
      // Check order: div, comment, children, comment, script, close div
      expect(html).toMatch(
        /<div><!--fragment-start--><span>first<\/span><span>second<\/span><!--fragment-end--><script[^>]*><\/script><\/div>/
      );
    });
  });
});

// ============================================================================
// Tests: Island Decoration (Element Islands)
// ============================================================================

describe('Element Island Decoration', () => {
  it('should add script tag after island element', () => {
    const ctx = createSSRContext();
    const renderer = createDOMServerRenderer();

    runWithSSRContext(ctx, () => {
      const container = renderer.createElement('div');
      const button = renderer.createElement('button');
      button.textContent = 'Click me';

      renderer.appendChild(container, button);

      // Use __islandMeta for lazy registration (new architecture)
      const buttonRef: ElementRef<HTMLElement> & { __islandMeta?: IslandNodeMeta } = {
        status: STATUS_ELEMENT,
        element: button,
        parent: null,
        prev: null,
        next: null,
        firstChild: null,
        lastChild: null,
        __islandMeta: { type: 'button-island', props: {} },
      };

      renderer.decorateElement?.(buttonRef, button);

      const html = container.innerHTML;
      expect(html).toContain('<button>Click me</button>');
      expect(html).toContain('data-island="button-island-0"'); // Instance ID from registerIsland
      expect(html).toContain('type="application/json"');
      expect(html).toContain('<script');

      // Verify registration happened
      expect(ctx.islands).toHaveLength(1);
      expect(ctx.islands[0]?.type).toBe('button-island');
    });
  });

  it('should place script tag as next sibling of element', () => {
    const ctx = createSSRContext();
    const renderer = createDOMServerRenderer();

    runWithSSRContext(ctx, () => {
      const container = renderer.createElement('div');
      const div = renderer.createElement('div');
      const after = renderer.createTextNode('after');

      renderer.appendChild(container, div);
      renderer.appendChild(container, after);

      // Use __islandMeta for lazy registration (new architecture)
      const divRef: ElementRef<HTMLElement> & { __islandMeta?: IslandNodeMeta } = {
        status: STATUS_ELEMENT,
        element: div,
        parent: null,
        prev: null,
        next: null,
        firstChild: null,
        lastChild: null,
        __islandMeta: { type: 'div-island', props: {} },
      };

      renderer.decorateElement?.(divRef, div);

      // Script should be between div and "after" text
      const children = Array.from(container.childNodes);
      expect(children[0]).toBe(div);
      expect(children[1]?.nodeName).toBe('SCRIPT');
      expect(children[2]).toBe(after);
    });
  });

  it('should skip decoration for non-island elements', () => {
    const renderer = createDOMServerRenderer();

    const container = renderer.createElement('div');
    const span = renderer.createElement('span');

    renderer.appendChild(container, span);

    const spanRef: ElementRef<HTMLElement> = {
      status: STATUS_ELEMENT,
      element: span,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
    };

    renderer.decorateElement?.(spanRef, span);

    const html = container.innerHTML;
    expect(html).not.toContain('<script');
  });
});

// ============================================================================
// Tests: Serialization
// ============================================================================

describe('Element Serialization', () => {
  it('should serialize element with custom children HTML', () => {
    const renderer = createDOMServerRenderer();

    const div = renderer.createElement('div');
    div.setAttribute('class', 'container');

    const html = renderer.serializeElement(div, '<p>Custom child</p>');

    // linkedom uses uppercase tag names and lowercases content
    expect(html.toLowerCase()).toBe(
      '<div class="container"><p>custom child</p></div>'
    );
  });

  it('should preserve all attributes during serialization', () => {
    const renderer = createDOMServerRenderer();

    const button = renderer.createElement('button');
    button.setAttribute('type', 'submit');
    button.setAttribute('class', 'btn');
    button.setAttribute('data-id', '123');

    const html = renderer.serializeElement(button, 'Submit');

    expect(html).toContain('type="submit"');
    expect(html).toContain('class="btn"');
    expect(html).toContain('data-id="123"');
    expect(html.toLowerCase()).toContain('>submit</button>');
  });
});

// ============================================================================
// Tests: SSR-Specific Behaviors
// ============================================================================

describe('SSR-Specific Behaviors', () => {
  it('should return no-op cleanup for addEventListener', () => {
    const renderer = createDOMServerRenderer();

    const button = renderer.createElement('button');
    const cleanup = renderer.addEventListener(button, 'click', () => {}, {});

    // Should return a function that returns a function (no-op chain)
    expect(typeof cleanup).toBe('function');
    expect(typeof cleanup()).toBe('function');
  });

  it('should check element connection status', () => {
    const renderer = createDOMServerRenderer();

    const div = renderer.createElement('div');

    // In linkedom, elements aren't connected until added to document
    // but isConnected method works correctly
    expect(typeof renderer.isConnected(div)).toBe('boolean');
  });

  it('should generate valid HTML from DOM tree', () => {
    const renderer = createDOMServerRenderer();

    const div = renderer.createElement('div');
    const h1 = renderer.createElement('h1');
    const text = renderer.createTextNode('Hello World');

    renderer.appendChild(h1, text);
    renderer.appendChild(div, h1);

    expect(div.outerHTML).toBe('<div><h1>Hello World</h1></div>');
  });
});

// ============================================================================
// Tests: Full SSR Integration with map()
// ============================================================================

describe('Full SSR Integration', () => {
  it('should render all items in map() during SSR', () => {
    // Create SSR API
    const signals = createSignalsApi();
    const { mount, svc } = createTestSSRService(signals);
    const { el, map, signal } = svc;

    // Create component with map() that renders 6 items
    const items = signal([1, 2, 3, 4, 5, 6]);
    const App = el('div', { className: 'container' })(
      map(items)((item) => el('div', { className: 'item' })(`Item ${item()}`))
    );

    // Render to string
    const rendered = mount(App);
    const html = renderToString(rendered);

    // Debug: Log the actual HTML output
    console.log('Rendered HTML:', html);

    // Assert ALL items appear in the output
    // This test should FAIL, demonstrating the bug where only function code renders
    expect(html).toContain('Item 1');
    expect(html).toContain('Item 2');
    expect(html).toContain('Item 3');
    expect(html).toContain('Item 4');
    expect(html).toContain('Item 5');
    expect(html).toContain('Item 6');
  });

  it('should render all items when map() uses computed', () => {
    const signals = createSignalsApi();
    const { mount, svc } = createTestSSRService(signals);
    const { el, map, computed } = svc;

    // Use computed() like ProductFilter does
    const items = computed(() => [1, 2, 3, 4, 5, 6]);
    const App = el('div', { className: 'container' })(
      map(items)((item) => el('div', { className: 'item' })(`Item ${item()}`))
    );

    const rendered = mount(App);
    const html = renderToString(rendered);

    // Debug: Log the actual HTML output
    console.log('Rendered HTML with computed:', html);

    expect(html).toContain('Item 1');
    expect(html).toContain('Item 2');
    expect(html).toContain('Item 3');
    expect(html).toContain('Item 4');
    expect(html).toContain('Item 5');
    expect(html).toContain('Item 6');
  });
});
