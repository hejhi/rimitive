/**
 * Tests for DOM Server Adapter (SSR with linkedom)
 *
 * This test suite validates SSR-specific behaviors:
 * - Element creation and manipulation
 * - Fragment decoration with HTML comments
 * - Attribute handling for SSR
 */

import { describe, it, expect } from 'vitest';
import { createLinkedomAdapter } from './adapter';
import {
  STATUS_ELEMENT,
  STATUS_FRAGMENT,
  type ElementRef,
  type FragmentRef,
  type RefSpec,
} from '@rimitive/view/types';
import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
} from '@rimitive/signals/extend';
import { createElModule } from '@rimitive/view/el';
import { createMapModule } from '@rimitive/view/map';
import { createMatchModule } from '@rimitive/view/match';
import { MountModule } from '@rimitive/view/deps/mount';
import { renderToString } from './render';

/**
 * Create SSR service for tests using compose pattern
 */
function createTestSSRService() {
  const { adapter, serialize } = createLinkedomAdapter();
  const ElModule = createElModule(adapter);
  const MapModule = createMapModule(adapter);
  const MatchModule = createMatchModule(adapter);

  const svc = compose(
    SignalModule,
    ComputedModule,
    EffectModule,
    BatchModule,
    ElModule,
    MapModule,
    MatchModule,
    MountModule
  );

  return {
    svc,
    adapter,
    serialize,
    mount: <TElement>(spec: RefSpec<TElement>) => spec.create(svc),
  };
}

// ============================================================================
// Tests: Basic DOM Operations
// ============================================================================

describe('Basic DOM Operations', () => {
  it('should create elements with correct tag names', () => {
    const { adapter: renderer } = createLinkedomAdapter();

    const div = renderer.createNode('div') as HTMLElement;
    const span = renderer.createNode('span') as HTMLElement;

    expect(div.tagName.toLowerCase()).toBe('div');
    expect(span.tagName.toLowerCase()).toBe('span');
  });

  it('should create text nodes with correct content', () => {
    const { adapter: renderer } = createLinkedomAdapter();

    const text = renderer.createNode('text', { value: 'Hello' });

    expect(text.textContent).toBe('Hello');
  });

  it('should append children to parent', () => {
    const { adapter: renderer } = createLinkedomAdapter();

    const div = renderer.createNode('div') as HTMLElement;
    const span = renderer.createNode('span') as HTMLElement;

    renderer.appendChild(div, span);

    expect(div.children.length).toBe(1);
    expect(div.children[0]).toBe(span);
  });

  it('should insert child before reference node', () => {
    const { adapter: renderer } = createLinkedomAdapter();

    const div = renderer.createNode('div');
    const first = renderer.createNode('text', { value: 'first' });
    const second = renderer.createNode('text', { value: 'second' });

    renderer.appendChild(div, second);
    renderer.insertBefore(div, first, second);

    expect(div.childNodes[0]).toBe(first);
    expect(div.childNodes[1]).toBe(second);
  });

  it('should update text node content', () => {
    const { adapter: renderer } = createLinkedomAdapter();

    const text = renderer.createNode('text', { value: 'before' });
    renderer.setAttribute(text, 'value', 'after');

    expect(text.textContent).toBe('after');
  });
});

// ============================================================================
// Tests: Attribute Handling for SSR
// ============================================================================

describe('Attribute Handling', () => {
  it('should skip event handler attributes', () => {
    const { adapter: renderer } = createLinkedomAdapter();

    const button = renderer.createNode('button') as HTMLElement;
    renderer.setAttribute(button, 'onClick', () => {});

    expect(button.hasAttribute('onClick')).toBe(false);
    expect(button.hasAttribute('onclick')).toBe(false);
  });

  it('should map className to class attribute', () => {
    const { adapter: renderer } = createLinkedomAdapter();

    const div = renderer.createNode('div') as HTMLElement;
    renderer.setAttribute(div, 'className', 'container');

    expect(div.getAttribute('class')).toBe('container');
    expect(div.hasAttribute('className')).toBe(false);
  });

  it('should stringify primitive values', () => {
    const { adapter: renderer } = createLinkedomAdapter();

    const div = renderer.createNode('div') as HTMLElement;
    renderer.setAttribute(div, 'data-count', 42);
    renderer.setAttribute(div, 'data-active', true);

    expect(div.getAttribute('data-count')).toBe('42');
    expect(div.getAttribute('data-active')).toBe('true');
  });

  it('should skip object values', () => {
    const { adapter: renderer } = createLinkedomAdapter();

    const div = renderer.createNode('div') as HTMLElement;
    renderer.setAttribute(div, 'data-config', { foo: 'bar' });

    expect(div.hasAttribute('data-config')).toBe(false);
  });

  it('should skip function values', () => {
    const { adapter: renderer } = createLinkedomAdapter();

    const div = renderer.createNode('div') as HTMLElement;
    renderer.setAttribute(div, 'ref', () => {});

    expect(div.hasAttribute('ref')).toBe(false);
  });

  it('should skip null and false values', () => {
    const { adapter: renderer } = createLinkedomAdapter();

    const div = renderer.createNode('div') as HTMLElement;
    renderer.setAttribute(div, 'disabled', null);
    renderer.setAttribute(div, 'hidden', false);

    expect(div.hasAttribute('disabled')).toBe(false);
    expect(div.hasAttribute('hidden')).toBe(false);
  });
});

// ============================================================================
// Tests: Fragment Decoration
// ============================================================================

describe('Fragment Decoration', () => {
  it('should add fragment-start and fragment-end comments', () => {
    const { adapter: renderer } = createLinkedomAdapter();

    const container = renderer.createNode('div') as HTMLElement;
    const child1 = renderer.createNode('span') as HTMLElement;
    const child2 = renderer.createNode('span') as HTMLElement;

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

    renderer.onAttach?.(fragment, container);

    const html = container.innerHTML;
    expect(html).toContain('<!--fragment-start-->');
    expect(html).toContain('<!--fragment-end-->');
  });

  it('should place comments around fragment children', () => {
    const { adapter: renderer } = createLinkedomAdapter();

    const container = renderer.createNode('div') as HTMLElement;
    const span1 = renderer.createNode('span') as HTMLElement;
    const span2 = renderer.createNode('span') as HTMLElement;

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

    renderer.onAttach?.(fragment, container);

    const html = container.innerHTML;
    expect(html).toMatch(
      /<!--fragment-start--><span>first<\/span><span>second<\/span><!--fragment-end-->/
    );
  });

  it('should skip empty fragments', () => {
    const { adapter: renderer } = createLinkedomAdapter();

    const container = renderer.createNode('div') as HTMLElement;

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

    renderer.onAttach?.(fragment, container);

    const html = container.innerHTML;
    expect(html).not.toContain('<!--fragment-start-->');
    expect(html).not.toContain('<!--fragment-end-->');
  });
});

// ============================================================================
// Tests: SSR-Specific Behaviors
// ============================================================================

describe('SSR-Specific Behaviors', () => {
  it('should generate valid HTML from DOM tree', () => {
    const { adapter: renderer } = createLinkedomAdapter();

    const div = renderer.createNode('div') as HTMLElement;
    const h1 = renderer.createNode('h1') as HTMLElement;
    const text = renderer.createNode('text', { value: 'Hello World' });

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
    // Create SSR service
    const { mount, svc, serialize } = createTestSSRService();
    const { el, map, signal } = svc;

    // Create component with map() that renders 6 items
    const items = signal([1, 2, 3, 4, 5, 6]);
    const App = el('div').props({ className: 'container' })(
      map(items, (itemSignal) =>
        el('div').props({ className: 'item' })(`Item ${itemSignal()}`)
      )
    );

    // Render to string
    const rendered = mount(App);
    const html = renderToString(rendered, serialize);

    // Assert ALL items appear in the output
    expect(html).toContain('Item 1');
    expect(html).toContain('Item 2');
    expect(html).toContain('Item 3');
    expect(html).toContain('Item 4');
    expect(html).toContain('Item 5');
    expect(html).toContain('Item 6');
  });

  it('should render all items when map() uses computed', () => {
    const { mount, svc, serialize } = createTestSSRService();
    const { el, map, computed } = svc;

    // Use computed() like ProductFilter does
    const items = computed(() => [1, 2, 3, 4, 5, 6]);
    const App = el('div').props({ className: 'container' })(
      map(items, (itemSignal) =>
        el('div').props({ className: 'item' })(`Item ${itemSignal()}`)
      )
    );

    const rendered = mount(App);
    const html = renderToString(rendered, serialize);

    expect(html).toContain('Item 1');
    expect(html).toContain('Item 2');
    expect(html).toContain('Item 3');
    expect(html).toContain('Item 4');
    expect(html).toContain('Item 5');
    expect(html).toContain('Item 6');
  });
});
