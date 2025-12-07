import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDOMView, type DOMSvc } from './presets/dom';
import { createSignals } from '@lattice/signals/presets/core';

describe('portal', () => {
  let svc: DOMSvc;
  let testContainer: HTMLElement;

  beforeEach(() => {
    const signals = createSignals();
    svc = createDOMView({ signals })();
    // Create a test container for mounting
    testContainer = document.createElement('div');
    testContainer.id = 'test-container';
    document.body.appendChild(testContainer);
  });

  afterEach(() => {
    // Clean up test container and any portaled elements
    testContainer.remove();
    // Remove any leftover portaled elements from body
    document.body
      .querySelectorAll(
        '.modal-backdrop, .modal-content, .portal-content, .direct-child, ' +
          '.outer, .inner, .counter-portal, .list-item, .clickable-portal, ' +
          '.ref-portal, .cleanup-portal, .target-content, .fragment-item, ' +
          '.moving-content'
      )
      .forEach((el) => el.remove());
  });

  describe('with default target (document.body)', () => {
    it('should render child into document.body when no target specified', () => {
      const { el, portal, mount } = svc;

      const spec = portal()(
        el('div').props({ className: 'modal-backdrop' })(
          el('div').props({ className: 'modal-content' })('Hello')
        )
      );

      mount(el('div')(spec));

      // Content should be in body
      const backdrop = document.body.querySelector('.modal-backdrop');
      expect(backdrop).toBeTruthy();
      expect(backdrop?.parentElement).toBe(document.body);

      const content = backdrop?.querySelector('.modal-content');
      expect(content).toBeTruthy();
      expect(content?.textContent).toBe('Hello');
    });

    it('should cleanup when parent is removed', () => {
      const { el, portal, mount, match, signal } = svc;
      const show = signal(true);

      const spec = match(show, (s) =>
        s
          ? portal()(
              el('div').props({ className: 'portal-content' })('Portaled')
            )
          : null
      );

      mount(el('div')(spec));

      expect(document.body.querySelector('.portal-content')).toBeTruthy();

      show(false);

      expect(document.body.querySelector('.portal-content')).toBeFalsy();
    });
  });

  describe('with element target', () => {
    it('should render into target element directly', () => {
      const { el, portal, mount } = svc;

      const targetEl = document.createElement('div');
      targetEl.id = 'portal-target';
      document.body.appendChild(targetEl);

      const spec = portal(targetEl)(
        el('div').props({ className: 'target-content' })('In target')
      );

      mount(el('div')(spec));

      const content = targetEl.querySelector('.target-content');
      expect(content).toBeTruthy();
      expect(content?.parentElement).toBe(targetEl);

      targetEl.remove();
    });
  });

  describe('with getter target', () => {
    it('should render into element returned by getter', () => {
      const { el, portal, mount } = svc;

      const targetEl = document.createElement('div');
      targetEl.id = 'getter-target';
      document.body.appendChild(targetEl);

      const spec = portal(() => document.getElementById('getter-target'))(
        el('div').props({ className: 'target-content' })('Via getter')
      );

      mount(el('div')(spec));

      const content = targetEl.querySelector('.target-content');
      expect(content).toBeTruthy();
      expect(content?.parentElement).toBe(targetEl);

      targetEl.remove();
    });

    it('should skip rendering when getter returns null', () => {
      const { el, portal, mount } = svc;

      const spec = portal(() => null)(
        el('div').props({ className: 'target-content' })('Should not render')
      );

      mount(el('div')(spec));

      expect(document.body.querySelector('.target-content')).toBeFalsy();
    });
  });

  describe('with signal target', () => {
    it('should render into element from signal', () => {
      const { el, portal, mount, signal } = svc;

      const targetEl = document.createElement('div');
      targetEl.id = 'signal-target';
      document.body.appendChild(targetEl);

      const targetSignal = signal<HTMLElement | null>(targetEl);

      const spec = portal(targetSignal)(
        el('div').props({ className: 'target-content' })('Via signal')
      );

      mount(el('div')(spec));

      const content = targetEl.querySelector('.target-content');
      expect(content).toBeTruthy();
      expect(content?.parentElement).toBe(targetEl);

      targetEl.remove();
    });

    it('should support ref pattern for capturing element', () => {
      const { el, portal, mount, signal, match } = svc;
      const show = signal(false);

      // Create target element outside the tree first
      const targetEl = document.createElement('div');
      targetEl.className = 'modal-root';
      document.body.appendChild(targetEl);

      // Signal holds the target
      const modalRoot = signal<HTMLElement | null>(targetEl);

      // Portal content that targets the ref
      const portalSpec = match(show, (s) =>
        s
          ? portal(modalRoot)(
              el('div').props({ className: 'modal-content' })('Modal!')
            )
          : null
      );

      mount(el('div')(portalSpec));

      // Initially hidden
      expect(document.querySelector('.modal-content')).toBeFalsy();

      // Show modal
      show(true);

      const content = document.querySelector('.modal-content');
      expect(content).toBeTruthy();
      expect(content?.parentElement?.classList.contains('modal-root')).toBe(
        true
      );

      // Hide modal
      show(false);
      expect(document.querySelector('.modal-content')).toBeFalsy();

      targetEl.remove();
    });

    it('should move content when signal target changes', () => {
      const { el, portal, mount, signal } = svc;

      const targetA = document.createElement('div');
      targetA.id = 'target-a';
      document.body.appendChild(targetA);

      const targetB = document.createElement('div');
      targetB.id = 'target-b';
      document.body.appendChild(targetB);

      const targetSignal = signal<HTMLElement | null>(targetA);

      const spec = portal(targetSignal)(
        el('div').props({ className: 'moving-content' })('I move!')
      );

      mount(el('div')(spec));

      // Initially in target A
      expect(targetA.querySelector('.moving-content')).toBeTruthy();
      expect(targetB.querySelector('.moving-content')).toBeFalsy();

      // Change to target B
      targetSignal(targetB);

      // Now in target B
      expect(targetA.querySelector('.moving-content')).toBeFalsy();
      expect(targetB.querySelector('.moving-content')).toBeTruthy();

      // Change to null - should be removed
      targetSignal(null);
      expect(targetA.querySelector('.moving-content')).toBeFalsy();
      expect(targetB.querySelector('.moving-content')).toBeFalsy();

      // Change back to A - should reappear
      targetSignal(targetA);
      expect(targetA.querySelector('.moving-content')).toBeTruthy();

      targetA.remove();
      targetB.remove();
    });
  });

  describe('with fragment child', () => {
    it('should handle map() as child', () => {
      const { el, portal, mount, map, match, signal } = svc;
      const show = signal(true);
      const items = signal(['a', 'b', 'c']);

      const spec = match(show, (s) =>
        s
          ? portal()(
              map(items, (item) =>
                el('span').props({ className: 'fragment-item' })(item)
              )
            )
          : null
      );

      mount(el('div')(spec));

      expect(document.body.querySelectorAll('.fragment-item').length).toBe(3);

      // Update items while visible
      items(['x', 'y']);
      expect(document.body.querySelectorAll('.fragment-item').length).toBe(2);

      // Hide - should cleanup all fragment children
      show(false);
      expect(document.body.querySelectorAll('.fragment-item').length).toBe(0);
    });
  });

  describe('nested portals', () => {
    it('should support portals inside portals', () => {
      const { el, portal, mount } = svc;

      const spec = portal()(
        el('div').props({ className: 'outer' })(
          portal()(el('div').props({ className: 'inner' })('Nested'))
        )
      );

      mount(el('div')(spec));

      // Both should be in body (inner is also portaled to body)
      const outer = document.body.querySelector('.outer');
      const inner = document.body.querySelector('.inner');

      expect(outer).toBeTruthy();
      expect(inner).toBeTruthy();
      expect(outer?.parentElement).toBe(document.body);
      expect(inner?.parentElement).toBe(document.body);
    });
  });

  describe('reactive content', () => {
    it('should update portaled content reactively', () => {
      const { el, portal, mount, signal, computed } = svc;
      const count = signal(0);

      const spec = portal()(
        el('div').props({ className: 'counter-portal' })(
          el('span')(computed(() => `Count: ${count()}`))
        )
      );

      mount(el('div')(spec));

      const content = document.body.querySelector('.counter-portal span');
      expect(content?.textContent).toBe('Count: 0');

      count(5);

      expect(content?.textContent).toBe('Count: 5');
    });

    it('should work with map inside portal', () => {
      const { el, portal, mount, map, signal } = svc;
      const items = signal(['a', 'b', 'c']);

      const spec = portal()(
        el('ul').props({ className: 'counter-portal' })(
          map(items, (item) => el('li').props({ className: 'list-item' })(item))
        )
      );

      mount(el('div')(spec));

      const listItems = document.body.querySelectorAll('.list-item');
      expect(listItems.length).toBe(3);
      expect(listItems[0]?.textContent).toBe('a');

      items(['x', 'y']);

      const updatedItems = document.body.querySelectorAll('.list-item');
      expect(updatedItems.length).toBe(2);
      expect(updatedItems[0]?.textContent).toBe('x');
    });
  });

  describe('event handling', () => {
    it('should handle events on portaled elements', () => {
      const { el, portal, mount, on } = svc;
      let clicked = false;

      const spec = portal()(
        el('div').props({ className: 'clickable-portal' })(
          el('button').ref(
            on('click', () => {
              clicked = true;
            })
          )('Click me')
        )
      );

      mount(el('div')(spec));

      const button = document.body.querySelector(
        '.clickable-portal button'
      ) as HTMLButtonElement;
      button.click();

      expect(clicked).toBe(true);
    });
  });

  describe('lifecycle', () => {
    it('should call ref callbacks on portaled elements', () => {
      const { el, portal, mount } = svc;
      let refElement: HTMLElement | null = null;

      const spec = portal()(
        el('div').props({ className: 'ref-portal' })(
          el('span').ref((el) => {
            refElement = el;
          })('With ref')
        )
      );

      mount(el('div')(spec));

      expect(refElement).not.toBeNull();
      expect(refElement!.textContent).toBe('With ref');
    });

    it('should cleanup ref callbacks when portal is removed', () => {
      const { el, portal, mount, match, signal } = svc;
      const show = signal(true);
      let cleanedUp = false;

      const spec = match(show, (s) =>
        s
          ? portal()(
              el('span')
                .props({ className: 'cleanup-portal' })
                .ref(() => () => {
                  cleanedUp = true;
                })('Cleanup test')
            )
          : null
      );

      mount(el('div')(spec));

      expect(cleanedUp).toBe(false);

      show(false);

      expect(cleanedUp).toBe(true);
    });

    it('should cleanup nested ref callbacks when portal is removed', () => {
      const { el, portal, mount, match, signal } = svc;
      const show = signal(true);
      let outerCleanedUp = false;
      let innerCleanedUp = false;

      const spec = match(show, (s) =>
        s
          ? portal()(
              el('div')
                .props({ className: 'cleanup-outer' })
                .ref(() => () => {
                  outerCleanedUp = true;
                })(
                el('span').ref(() => () => {
                  innerCleanedUp = true;
                })('Nested cleanup')
              )
            )
          : null
      );

      mount(el('div')(spec));

      expect(outerCleanedUp).toBe(false);
      expect(innerCleanedUp).toBe(false);

      show(false);

      expect(outerCleanedUp).toBe(true);
      expect(innerCleanedUp).toBe(true);
    });
  });
});
