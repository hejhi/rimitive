/**
 * TDD tests for processChildren function child support
 *
 * These tests define the behavior we want to achieve:
 * - processChildren detects function children (not RefSpec, not Reactive)
 * - Creates effect using scope.ts
 * - Function returns RefSpec or RefSpec[] which get attached
 * - Effect re-runs when signals change
 * - Cleanup happens when parent disposed
 *
 * Tests use real API to verify observable behavior.
 */

import { describe, it, expect } from 'vitest';
import { createTestEnv, MockElement, getTextContent } from '../test-utils';
import { createElFactory } from '../el';
import { createMapHelper } from './map-helper';

describe('processChildren - function children', () => {
  function setup() {
    const env = createTestEnv();
    const el = createElFactory({
      ctx: env.ctx,
      effect: env.effect,
      renderer: env.renderer,
      processChildren: env.processChildren,
      createScope: env.createScope,
      runInScope: env.runInScope,
      trackInScope: env.trackInScope,
      trackInSpecificScope: env.trackInSpecificScope,
    });

    const map = createMapHelper({
      ctx: env.ctx,
      effect: env.effect,
      renderer: env.renderer,
      disposeScope: env.disposeScope,
      trackInSpecificScope: env.trackInSpecificScope,
    });

    return { ...env, el, map };
  }

  describe('Function returning single RefSpec', () => {
    it('should render function that returns single RefSpec', () => {
      const { el, signal } = setup();

      const count = signal(1);

      const view = el.method([
        'div',
        () => el.method(['span', `Count: ${count()}`]),
      ]);

      const div = view.create().element as MockElement;

      expect(div.children.length).toBe(1);
      expect(getTextContent(div.children[0] as MockElement)).toBe('Count: 1');
    });

    it('should re-run function when signal changes', () => {
      const { el, signal } = setup();

      const count = signal(1);

      const view = el.method([
        'div',
        () => el.method(['span', `Count: ${count()}`]),
      ]);

      const div = view.create().element as MockElement;

      expect(getTextContent(div.children[0] as MockElement)).toBe('Count: 1');

      count(2);
      expect(getTextContent(div.children[0] as MockElement)).toBe('Count: 2');

      count(3);
      expect(getTextContent(div.children[0] as MockElement)).toBe('Count: 3');
    });

    it('should replace element when function returns different RefSpec', () => {
      const { el, signal } = setup();

      const mode = signal<'span' | 'div'>('span');

      const view = el.method([
        'div',
        () => {
          const tag = mode();
          return el.method([tag, 'Content']);
        },
      ]);

      const container = view.create().element as MockElement;

      expect(container.children.length).toBe(1);
      expect((container.children[0] as MockElement).tag).toBe('span');

      mode('div');
      expect(container.children.length).toBe(1);
      expect((container.children[0] as MockElement).tag).toBe('div');
    });

    it('should handle function returning null', () => {
      const { el, signal } = setup();

      const show = signal(true);

      const view = el.method([
        'div',
        () => show() ? el.method(['span', 'Content']) : null,
      ]);

      const div = view.create().element as MockElement;

      // Initially shows content
      expect(div.children.length).toBe(1);
      expect(getTextContent(div.children[0] as MockElement)).toBe('Content');

      // Hide - function returns null
      show(false);
      expect(div.children.length).toBe(0);

      // Show again
      show(true);
      expect(div.children.length).toBe(1);
      expect(getTextContent(div.children[0] as MockElement)).toBe('Content');
    });

    it('should handle function returning false', () => {
      const { el, signal } = setup();

      const show = signal(true);

      const view = el.method([
        'div',
        () => show() ? el.method(['span', 'Content']) : false,
      ]);

      const div = view.create().element as MockElement;

      // Initially shows content
      expect(div.children.length).toBe(1);
      expect(getTextContent(div.children[0] as MockElement)).toBe('Content');

      // Hide - function returns false
      show(false);
      expect(div.children.length).toBe(0);

      // Show again
      show(true);
      expect(div.children.length).toBe(1);
      expect(getTextContent(div.children[0] as MockElement)).toBe('Content');
    });
  });

  describe('Function returning array of RefSpecs', () => {
    it('should render function that returns array of RefSpecs', () => {
      const { el, signal } = setup();

      const items = signal(['A', 'B', 'C']);

      const view = el.method([
        'ul',
        () => items().map((item) => el.method(['li', item])),
      ]);

      const ul = view.create().element as MockElement;

      expect(ul.children.length).toBe(3);
      expect(getTextContent(ul.children[0] as MockElement)).toBe('A');
      expect(getTextContent(ul.children[1] as MockElement)).toBe('B');
      expect(getTextContent(ul.children[2] as MockElement)).toBe('C');
    });

    it('should update when array changes', () => {
      const { el, signal } = setup();

      const items = signal(['A', 'B']);

      const view = el.method([
        'ul',
        () => items().map((item) => el.method(['li', item])),
      ]);

      const ul = view.create().element as MockElement;

      expect(ul.children.length).toBe(2);

      items(['A', 'B', 'C']);
      expect(ul.children.length).toBe(3);
      expect(getTextContent(ul.children[2] as MockElement)).toBe('C');

      items(['A']);
      expect(ul.children.length).toBe(1);
    });

    it('should handle empty array', () => {
      const { el, signal } = setup();

      const items = signal<string[]>([]);

      const view = el.method([
        'ul',
        () => items().map((item) => el.method(['li', item])),
      ]);

      const ul = view.create().element as MockElement;

      expect(ul.children.length).toBe(0);

      items(['A', 'B']);
      expect(ul.children.length).toBe(2);

      items([]);
      expect(ul.children.length).toBe(0);
    });
  });

  describe('Function returning primitive values', () => {
    it('should handle function returning array of strings', () => {
      const { el, signal } = setup();

      const items = signal(['Apple', 'Banana', 'Cherry']);

      const view = el.method([
        'div',
        () => items(), // Returns array of strings directly
      ]);

      const div = view.create().element as MockElement;

      const text = getTextContent(div);
      expect(text).toContain('Apple');
      expect(text).toContain('Banana');
      expect(text).toContain('Cherry');
    });

    it('should handle function returning array of numbers', () => {
      const { el, signal } = setup();

      const numbers = signal([1, 2, 3]);

      const view = el.method([
        'div',
        () => numbers(), // Returns array of numbers directly
      ]);

      const div = view.create().element as MockElement;

      const text = getTextContent(div);
      expect(text).toContain('1');
      expect(text).toContain('2');
      expect(text).toContain('3');
    });

    it('should update when primitive array changes', () => {
      const { el, signal } = setup();

      const items = signal(['A', 'B']);

      const view = el.method([
        'div',
        () => items(),
      ]);

      const div = view.create().element as MockElement;

      let text = getTextContent(div);
      expect(text).toContain('A');
      expect(text).toContain('B');

      // Update to different values
      items(['X', 'Y', 'Z']);

      text = getTextContent(div);
      expect(text).toContain('X');
      expect(text).toContain('Y');
      expect(text).toContain('Z');
      expect(text).not.toContain('A');
      expect(text).not.toContain('B');
    });

    it('should handle mixed array of primitives and RefSpecs', () => {
      const { el, signal } = setup();

      const items = signal(['Text', 'items']);

      const view = el.method([
        'div',
        () => [
          'Count: ',
          items().length,
          ' - ',
          ...items().map((item) => el.method(['strong', item])),
        ],
      ]);

      const div = view.create().element as MockElement;

      const text = getTextContent(div);
      expect(text).toContain('Count: 2');
      expect(text).toContain('Text');
      expect(text).toContain('items');
    });
  });

  describe('Integration with map() helper', () => {
    it('should work with map() helper for keyed reconciliation', () => {
      const { el, signal, map } = setup();

      const items = signal([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Charlie' },
      ]);

      const view = el.method([
        'ul',
        map(items, (items) =>
          items.map((item) => el.method(['li', item.name], item.id))
        ),
      ]);

      const ul = view.create().element as MockElement;

      expect(ul.children.length).toBe(3);
      expect(getTextContent(ul.children[0] as MockElement)).toBe('Alice');

      // Reorder
      items([items()[2]!, items()[0]!, items()[1]!]);

      expect(ul.children.length).toBe(3);
      expect(getTextContent(ul.children[0] as MockElement)).toBe('Charlie');
      expect(getTextContent(ul.children[1] as MockElement)).toBe('Alice');
      expect(getTextContent(ul.children[2] as MockElement)).toBe('Bob');
    });

    it('should work with map() for conditional rendering', () => {
      const { el, signal, map } = setup();

      type Mode = 'loading' | 'error' | 'success';
      const mode = signal<Mode>('loading');

      const view = el.method([
        'div',
        map(mode, (m) => {
          if (m === 'loading') return el.method(['div', 'Loading...'], 'loading');
          if (m === 'error') return el.method(['div', 'Error!'], 'error');
          return el.method(['div', 'Success'], 'success');
        }),
      ]);

      const div = view.create().element as MockElement;

      expect(getTextContent(div.children[0] as MockElement)).toBe('Loading...');

      mode('error');
      expect(getTextContent(div.children[0] as MockElement)).toBe('Error!');

      mode('success');
      expect(getTextContent(div.children[0] as MockElement)).toBe('Success');
    });
  });

  describe('Mixed children', () => {
    it('should handle mix of static, reactive, and function children', () => {
      const { el, signal } = setup();

      const count = signal(5);
      const message = signal('items');

      const view = el.method([
        'div',
        'Count: ',
        count,
        ' ',
        () => el.method(['strong', message()]),
      ]);

      const div = view.create().element as MockElement;

      // Static text + reactive text + function child
      const textContent = getTextContent(div);
      expect(textContent).toContain('Count: 5');
      expect(textContent).toContain('items');

      count(10);
      message('things');

      const updatedText = getTextContent(div);
      expect(updatedText).toContain('Count: 10');
      expect(updatedText).toContain('things');
    });
  });

  describe('Cleanup and lifecycle', () => {
    it('should cleanup effects when parent element is removed', () => {
      const { el, signal, disposeScope, ctx } = setup();

      const count = signal(1);
      let effectRunCount = 0;

      const view = el.method([
        'div',
        () => {
          effectRunCount++;
          return el.method(['span', `Count: ${count()}`]);
        },
      ]);

      const nodeRef = view.create();
      const div = nodeRef.element as MockElement;

      expect(effectRunCount).toBe(1);

      count(2);
      expect(effectRunCount).toBe(2);

      // Dispose the scope
      const scope = ctx.elementScopes.get(div);
      if (scope) disposeScope(scope);

      // Effect should not run after disposal
      count(3);
      expect(effectRunCount).toBe(2); // Still 2, not 3
    });

    it('should cleanup fragments when switching from fragment to element', () => {
      const { el, signal, map } = setup();

      type Mode = 'list' | 'text';
      const mode = signal<Mode>('list');
      const items = signal([
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ]);

      const view = el.method([
        'div',
        () => {
          if (mode() === 'list') {
            // Returns FragmentRef from map()
            return map(items, (items) =>
              items.map((item) => el.method(['li', item.name], item.id))
            );
          }
          // Returns ElementRef
          return el.method(['span', 'No list']);
        },
      ]);

      const div = view.create().element as MockElement;

      // Initial: map() creates fragment with list items
      expect(div.children.length).toBe(2);
      expect(getTextContent(div.children[0] as MockElement)).toBe('Item 1');

      // Switch to text mode - should cleanup fragment
      mode('text');

      expect(div.children.length).toBe(1);
      expect((div.children[0] as MockElement).tag).toBe('span');
      expect(getTextContent(div.children[0] as MockElement)).toBe('No list');

      // Switch back to list - should work again
      mode('list');

      expect(div.children.length).toBe(2);
      expect(getTextContent(div.children[0] as MockElement)).toBe('Item 1');
    });
  });

  describe('Nested function children', () => {
    it('should handle nested function children', () => {
      const { el, signal } = setup();

      const outer = signal('Outer');
      const inner = signal('Inner');

      const view = el.method([
        'div',
        () => el.method([
          'section',
          outer(),
          ' - ',
          () => el.method(['span', inner()]),
        ]),
      ]);

      const div = view.create().element as MockElement;

      const text = getTextContent(div);
      expect(text).toContain('Outer');
      expect(text).toContain('Inner');

      outer('Updated Outer');
      inner('Updated Inner');

      const updatedText = getTextContent(div);
      expect(updatedText).toContain('Updated Outer');
      expect(updatedText).toContain('Updated Inner');
    });
  });
});
