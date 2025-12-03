import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDOMSvc } from './presets/dom';

describe('portal', () => {
  let svc: ReturnType<typeof createDOMSvc>;
  let testContainer: HTMLElement;

  beforeEach(() => {
    svc = createDOMSvc();
    // Create a test container for mounting
    testContainer = document.createElement('div');
    testContainer.id = 'test-container';
    document.body.appendChild(testContainer);
  });

  afterEach(() => {
    // Clean up test container and any portaled elements
    testContainer.remove();
    // Remove any leftover portaled elements from body
    document.body.querySelectorAll('.modal-backdrop, .modal-content, .portal-container, .direct-child, .direct-portal, .outer, .inner, .counter-portal, .list-portal, .clickable-portal, .ref-portal, .cleanup-portal, .inactive, .active').forEach(el => el.remove());
  });

  describe('with container RefSpec', () => {
    it('should render container and child into document.body', () => {
      const { el, portal, mount } = svc;

      // Note: el('div').props({...})() - call with empty children to get RefSpec
      const spec = portal(
        el('div').props({ className: 'modal-backdrop' })()
      )(
        el('div').props({ className: 'modal-content' })('Hello')
      );

      mount(el('div')(spec));

      // Container should be in body
      const backdrop = document.body.querySelector('.modal-backdrop');
      expect(backdrop).toBeTruthy();
      expect(backdrop?.parentElement).toBe(document.body);

      // Child should be inside container
      const content = backdrop?.querySelector('.modal-content');
      expect(content).toBeTruthy();
      expect(content?.textContent).toBe('Hello');
    });

    it('should support reactive props on container', () => {
      const { el, portal, mount, signal, computed } = svc;
      const isActive = signal(false);

      const spec = portal(
        el('div').props({
          className: computed(() => isActive() ? 'active' : 'inactive')
        })()
      )(
        el('span')('Content')
      );

      mount(el('div')(spec));

      const container = document.body.querySelector('.inactive');
      expect(container).toBeTruthy();

      isActive(true);

      expect(document.body.querySelector('.active')).toBeTruthy();
      expect(document.body.querySelector('.inactive')).toBeFalsy();
    });

    it('should cleanup when parent is removed', () => {
      const { el, portal, mount, match, signal } = svc;
      const show = signal(true);

      const spec = match(show)((s) =>
        s
          ? portal(el('div').props({ className: 'portal-container' })())(
              el('span')('Portaled')
            )
          : null
      );

      mount(el('div')(spec));

      expect(document.body.querySelector('.portal-container')).toBeTruthy();

      show(false);

      expect(document.body.querySelector('.portal-container')).toBeFalsy();
    });
  });

  describe('with default container', () => {
    it('should create a plain div container when no container specified', () => {
      const { el, portal, mount } = svc;

      const spec = portal()(
        el('span').props({ className: 'content' })('Hello')
      );

      mount(el('div')(spec));

      // Should have created a div in body
      const content = document.body.querySelector('.content');
      expect(content).toBeTruthy();
      expect(content?.parentElement?.tagName).toBe('DIV');
      expect(content?.parentElement?.parentElement).toBe(document.body);
    });
  });

  describe('with null container', () => {
    it('should append child directly to portal root', () => {
      const { el, portal, mount } = svc;

      const spec = portal(null)(
        el('div').props({ className: 'direct-child' })('Direct')
      );

      mount(el('div')(spec));

      const child = document.body.querySelector('.direct-child');
      expect(child).toBeTruthy();
      expect(child?.parentElement).toBe(document.body);
    });

    it('should cleanup direct child when parent disposes', () => {
      const { el, portal, mount, match, signal } = svc;
      const show = signal(true);

      const spec = match(show)((s) =>
        s
          ? portal(null)(el('div').props({ className: 'direct-portal' })('Content'))
          : null
      );

      mount(el('div')(spec));

      expect(document.body.querySelector('.direct-portal')).toBeTruthy();

      show(false);

      expect(document.body.querySelector('.direct-portal')).toBeFalsy();
    });

    it('should handle fragment child (map) with null container', () => {
      const { el, portal, mount, map, match, signal } = svc;
      const show = signal(true);
      const items = signal(['a', 'b', 'c']);

      const spec = match(show)((s) =>
        s
          ? portal(null)(
              map(items)((item) => el('span').props({ className: 'fragment-item' })(item))
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

      const spec = portal(el('div').props({ className: 'outer' })())(
        portal(el('div').props({ className: 'inner' })())(
          el('span')('Nested')
        )
      );

      mount(el('div')(spec));

      // Both portals should be in body (not nested in DOM)
      const outer = document.body.querySelector('.outer');
      const inner = document.body.querySelector('.inner');

      expect(outer).toBeTruthy();
      expect(inner).toBeTruthy();
      expect(outer?.parentElement).toBe(document.body);
      expect(inner?.parentElement).toBe(document.body);
    });
  });

  describe('with reactive content', () => {
    it('should update portaled content reactively', () => {
      const { el, portal, mount, signal, computed } = svc;
      const count = signal(0);

      const spec = portal(el('div').props({ className: 'counter-portal' })())(
        el('span')(computed(() => `Count: ${count()}`))
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

      const spec = portal(el('ul').props({ className: 'list-portal' })())(
        map(items)((item) => el('li')(item))
      );

      mount(el('div')(spec));

      const listItems = document.body.querySelectorAll('.list-portal li');
      expect(listItems.length).toBe(3);
      expect(listItems[0]?.textContent).toBe('a');

      items(['x', 'y']);

      const updatedItems = document.body.querySelectorAll('.list-portal li');
      expect(updatedItems.length).toBe(2);
      expect(updatedItems[0]?.textContent).toBe('x');
    });
  });

  describe('event handling', () => {
    it('should handle events on portaled elements', () => {
      const { el, portal, mount, on } = svc;
      let clicked = false;

      const spec = portal(el('div').props({ className: 'clickable-portal' })())(
        el('button').ref(on('click', () => { clicked = true; }))('Click me')
      );

      mount(el('div')(spec));

      const button = document.body.querySelector('.clickable-portal button') as HTMLButtonElement;
      button.click();

      expect(clicked).toBe(true);
    });
  });

  describe('lifecycle', () => {
    it('should call ref callbacks on portaled elements', () => {
      const { el, portal, mount } = svc;
      let refElement: HTMLElement | null = null;

      const spec = portal(el('div').props({ className: 'ref-portal' })())(
        el('span').ref((el) => { refElement = el; })('With ref')
      );

      mount(el('div')(spec));

      expect(refElement).not.toBeNull();
      expect(refElement!.textContent).toBe('With ref');
    });

    it('should cleanup ref callbacks when portal is removed', () => {
      const { el, portal, mount, match, signal } = svc;
      const show = signal(true);
      let cleanedUp = false;

      const spec = match(show)((s) =>
        s
          ? portal(el('div').props({ className: 'cleanup-portal' })())(
              el('span').ref(() => () => { cleanedUp = true; })('Cleanup test')
            )
          : null
      );

      mount(el('div')(spec));

      expect(cleanedUp).toBe(false);

      show(false);

      expect(cleanedUp).toBe(true);
    });
  });
});
