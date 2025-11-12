import { describe, it, expect } from 'vitest';
import { createDOMRenderer } from './renderers/dom';
import { createApi } from './presets/core';
import type { FragmentRef, ElementRef } from './types';

describe('El - Reactive Tags', () => {
  it('should handle dynamic tag switching', () => {
    const renderer = createDOMRenderer();
    const { api } = createApi(renderer);
    const parent = renderer.createElement('div');

    const isHeading = api.signal(true);

    const fragmentRef = api.el(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      (api as any).computed(() => isHeading() ? 'h1' : 'p'),
      { className: 'title' }
    )('Hello World').create(api) as FragmentRef<HTMLElement>;

    // Attach to parent
    const parentRef: ElementRef<HTMLElement> = {
      status: 1 as const,
      element: parent,
      next: undefined
    };
    fragmentRef.attach(parentRef, null);

    // Initially should be h1
    const firstChild = parent.children[0];
    expect(firstChild?.tagName).toBe('H1');
    expect(firstChild?.textContent).toBe('Hello World');
    expect(firstChild?.className).toBe('title');

    // Switch to p
    isHeading(false);

    const secondChild = parent.children[0];
    expect(secondChild?.tagName).toBe('P');
    expect(secondChild?.textContent).toBe('Hello World');
    expect(secondChild?.className).toBe('title');
  });

  it('should handle conditional rendering with null', () => {
    const renderer = createDOMRenderer();
    const { api } = createApi(renderer);
    const parent = renderer.createElement('div');

    const show = api.signal(true);

    const fragmentRef = api.el(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      (api as any).computed(() => show() ? 'div' : null),
      { className: 'card' }
    )('Content').create(api) as FragmentRef<HTMLElement>;

    const parentRef: ElementRef<HTMLElement> = {
      status: 1 as const,
      element: parent,
      next: undefined
    };
    fragmentRef.attach(parentRef, null);

    // Initially should render
    expect(parent.children.length).toBe(1);
    expect(parent.children[0]?.tagName).toBe('DIV');
    expect(parent.children[0]?.className).toBe('card');

    // Hide - should remove element
    show(false);
    expect(parent.children.length).toBe(0);

    // Show again - should re-create
    show(true);
    expect(parent.children.length).toBe(1);
    expect(parent.children[0]?.tagName).toBe('DIV');
  });

  it('should work with lifecycle callbacks', () => {
    const renderer = createDOMRenderer();
    const { api } = createApi(renderer);
    const parent = renderer.createElement('div');

    const tagType = api.signal<'button' | 'a'>('button');
    const mountCount = { value: 0 };
    const unmountCount = { value: 0 };

    const fragmentRef = api.el(
      tagType,
      { className: 'interactive' }
    )('Click me')(
      () => {
        mountCount.value++;
        return () => {
          unmountCount.value++;
        };
      }
    ).create(api) as FragmentRef<HTMLElement>;

    const parentRef: ElementRef<HTMLElement> = {
      status: 1 as const,
      element: parent,
      next: undefined
    };
    fragmentRef.attach(parentRef, null);

    // Initial mount
    expect(mountCount.value).toBe(1);
    expect(unmountCount.value).toBe(0);
    expect(parent.children[0]?.tagName).toBe('BUTTON');

    // Switch tag - should unmount old and mount new
    tagType('a');
    expect(mountCount.value).toBe(2);
    expect(unmountCount.value).toBe(1);
    expect(parent.children[0]?.tagName).toBe('A');
  });

  it('should work with reactive props alongside reactive tag', () => {
    const renderer = createDOMRenderer();
    const { api } = createApi(renderer);
    const parent = renderer.createElement('div');

    const tagType = api.signal<'div' | 'span'>('div');
    const className = api.signal('initial');

    const fragmentRef = api.el(
      tagType,
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        className: (api as any).computed(() => className())
      }
    )('Text').create(api) as FragmentRef<HTMLElement>;

    const parentRef: ElementRef<HTMLElement> = {
      status: 1 as const,
      element: parent,
      next: undefined
    };
    fragmentRef.attach(parentRef, null);

    // Initial state
    expect(parent.children[0]?.tagName).toBe('DIV');
    expect(parent.children[0]?.className).toBe('initial');

    // Change className
    className('updated');
    expect(parent.children[0]?.className).toBe('updated');
    expect(parent.children[0]?.tagName).toBe('DIV');

    // Change tag - new element should have updated className
    tagType('span');
    expect(parent.children[0]?.tagName).toBe('SPAN');
    expect(parent.children[0]?.className).toBe('updated');
  });

  it('should handle multiple children', () => {
    const renderer = createDOMRenderer();
    const { api } = createApi(renderer);
    const parent = renderer.createElement('div');

    const tagType = api.signal<'ul' | 'ol'>('ul');

    const fragmentRef = api.el(tagType)(
      api.el('li')('Item 1'),
      api.el('li')('Item 2'),
      api.el('li')('Item 3')
    ).create(api) as FragmentRef<HTMLElement>;

    const parentRef: ElementRef<HTMLElement> = {
      status: 1 as const,
      element: parent,
      next: undefined
    };
    fragmentRef.attach(parentRef, null);

    // Initial ul
    expect(parent.children[0]?.tagName).toBe('UL');
    expect(parent.children[0]?.children.length).toBe(3);
    expect(parent.children[0]?.children[0]?.textContent).toBe('Item 1');

    // Switch to ol
    tagType('ol');
    expect(parent.children[0]?.tagName).toBe('OL');
    expect(parent.children[0]?.children.length).toBe(3);
    expect(parent.children[0]?.children[0]?.textContent).toBe('Item 1');
  });
});
