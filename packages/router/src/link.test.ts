import { describe, it, expect } from 'vitest';
import { Link } from './link';
import { createTestEnv, type MockRendererConfig, type MockElement, getTextContent } from '../../view/src/test-utils';
import { El } from '@lattice/view/el';
import type { ElementRef } from '@lattice/view/types';
import { STATUS_ELEMENT } from '@lattice/view/types';

describe('Link component - basic rendering', () => {
  function setup() {
    const env = createTestEnv();
    const el = El<MockRendererConfig>().create({
      scopedEffect: env.scopedEffect,
      renderer: env.renderer,
      createElementScope: env.createElementScope,
      onCleanup: env.onCleanup,
    });

    const currentPath = env.signal('/');
    const navigate = (path: string): void => {
      currentPath(path);
      window.history.pushState({}, '', path);
    };

    const api = {
      el: el.method,
      navigate,
    };

    return { ...env, el, Link, navigate, currentPath, api };
  }

  const mountElement = (spec: unknown, api: { el: unknown; navigate?: (path: string) => void }, renderer: { createElement: (tag: string) => MockElement }): MockElement => {
    const parent = renderer.createElement('div');
    const parentRef: ElementRef<MockElement> = {
      status: STATUS_ELEMENT,
      element: parent,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
    };

    const nodeRef = (spec as { create: (api: unknown) => ElementRef<MockElement> }).create(api);
    nodeRef.parent = parentRef;
    nodeRef.next = null;
    parent.children.push(nodeRef.element);

    return parent;
  };

  it('renders anchor element with href', () => {
    const { Link, renderer, api } = setup();

    const linkSpec = Link({ href: '/about' })('About');
    const parent = mountElement(linkSpec, api, renderer);

    expect(parent.children.length).toBe(1);
    const anchor = parent.children[0] as MockElement;
    expect(anchor?.tag).toBe('a');
    expect(anchor?.props.href).toBe('/about');
    expect(getTextContent(parent)).toBe('About');
  });

  it('accepts standard anchor attributes', () => {
    const { Link, renderer, api } = setup();

    const linkSpec = Link({
      href: '/products',
      className: 'nav-link',
      id: 'products-link',
      title: 'View Products'
    })('Products');

    const parent = mountElement(linkSpec, api, renderer);
    const anchor = parent.children[0] as MockElement;

    expect(anchor?.props.className).toBe('nav-link');
    expect(anchor?.props.id).toBe('products-link');
    expect(anchor?.props.title).toBe('View Products');
  });

  it('accepts multiple children', () => {
    const { Link, el, renderer, api } = setup();

    const linkSpec = Link({ href: '/home' })(
      el.method('span')('Go to '),
      el.method('strong')('Home')
    );

    const parent = mountElement(linkSpec, api, renderer);
    expect(getTextContent(parent)).toContain('Go to');
    expect(getTextContent(parent)).toContain('Home');
  });
});

describe('Link component - click handling', () => {
  function setup() {
    const env = createTestEnv();
    const el = El<MockRendererConfig>().create({
      scopedEffect: env.scopedEffect,
      renderer: env.renderer,
      createElementScope: env.createElementScope,
      onCleanup: env.onCleanup,
    });

    const currentPath = env.signal('/');
    const navigateCalls: string[] = [];
    const navigate = (path: string): void => {
      navigateCalls.push(path);
      currentPath(path);
      window.history.pushState({}, '', path);
    };

    const api = {
      el: el.method,
      navigate,
    };

    return { ...env, el, Link, navigate, currentPath, navigateCalls, api };
  }

  const mountElement = (spec: unknown, api: { el: unknown; navigate?: (path: string) => void }, renderer: { createElement: (tag: string) => MockElement }): MockElement => {
    const parent = renderer.createElement('div');
    const parentRef: ElementRef<MockElement> = {
      status: STATUS_ELEMENT,
      element: parent,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
    };

    const nodeRef = (spec as { create: (api: unknown) => ElementRef<MockElement> }).create(api);
    nodeRef.parent = parentRef;
    nodeRef.next = null;
    parent.children.push(nodeRef.element);

    return parent;
  };

  it('intercepts click on internal link', () => {
    const { Link, renderer, navigateCalls, api } = setup();

    const linkSpec = Link({ href: '/about' })('About');
    const parent = mountElement(linkSpec, api, renderer);
    const anchor = parent.children[0] as MockElement;

    const event = {
      preventDefault: () => { event.defaultPrevented = true; },
      stopPropagation: () => {},
      defaultPrevented: false,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      button: 0,
    };

    (anchor?.props.onclick as ((e: unknown) => void))?.(event);

    expect(event.defaultPrevented).toBe(true);
    expect(navigateCalls).toEqual(['/about']);
  });

  it('does not intercept click with metaKey (cmd+click)', () => {
    const { Link, renderer, navigateCalls, api } = setup();

    const linkSpec = Link({ href: '/about' })('About');
    const parent = mountElement(linkSpec, api, renderer);
    const anchor = parent.children[0] as MockElement;

    const event = {
      preventDefault: () => { event.defaultPrevented = true; },
      stopPropagation: () => {},
      defaultPrevented: false,
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      button: 0,
    };

    (anchor?.props.onclick as ((e: unknown) => void))?.(event);

    expect(event.defaultPrevented).toBe(false);
    expect(navigateCalls).toEqual([]);
  });

  it('does not intercept click with ctrlKey', () => {
    const { Link, renderer, navigateCalls, api } = setup();

    const linkSpec = Link({ href: '/about' })('About');
    const parent = mountElement(linkSpec, api, renderer);
    const anchor = parent.children[0] as MockElement;

    const event = {
      preventDefault: () => { event.defaultPrevented = true; },
      stopPropagation: () => {},
      defaultPrevented: false,
      metaKey: false,
      ctrlKey: true,
      shiftKey: false,
      button: 0,
    };

    (anchor?.props.onclick as ((e: unknown) => void))?.(event);

    expect(event.defaultPrevented).toBe(false);
    expect(navigateCalls).toEqual([]);
  });

  it('does not intercept right-click', () => {
    const { Link, renderer, navigateCalls, api } = setup();

    const linkSpec = Link({ href: '/about' })('About');
    const parent = mountElement(linkSpec, api, renderer);
    const anchor = parent.children[0] as MockElement;

    const event = {
      preventDefault: () => { event.defaultPrevented = true; },
      stopPropagation: () => {},
      defaultPrevented: false,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      button: 2, // Right click
    };

    (anchor?.props.onclick as ((e: unknown) => void))?.(event);

    expect(event.defaultPrevented).toBe(false);
    expect(navigateCalls).toEqual([]);
  });

  it('does not intercept external http link', () => {
    const { Link, renderer, navigateCalls, api } = setup();

    const linkSpec = Link({ href: 'http://example.com' })('External');
    const parent = mountElement(linkSpec, api, renderer);
    const anchor = parent.children[0] as MockElement;

    const event = {
      preventDefault: () => { event.defaultPrevented = true; },
      stopPropagation: () => {},
      defaultPrevented: false,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      button: 0,
    };

    (anchor?.props.onclick as ((e: unknown) => void))?.(event);

    expect(event.defaultPrevented).toBe(false);
    expect(navigateCalls).toEqual([]);
  });

  it('does not intercept external https link', () => {
    const { Link, renderer, navigateCalls, api } = setup();

    const linkSpec = Link({ href: 'https://example.com' })('External');
    const parent = mountElement(linkSpec, api, renderer);
    const anchor = parent.children[0] as MockElement;

    const event = {
      preventDefault: () => { event.defaultPrevented = true; },
      stopPropagation: () => {},
      defaultPrevented: false,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      button: 0,
    };

    (anchor?.props.onclick as ((e: unknown) => void))?.(event);

    expect(event.defaultPrevented).toBe(false);
    expect(navigateCalls).toEqual([]);
  });

  it('merges user onclick with navigation handler', () => {
    const { Link, renderer, navigateCalls, api } = setup();

    const userClicks: string[] = [];
    const linkSpec = Link({
      href: '/about',
      onclick: () => { userClicks.push('clicked'); }
    })('About');

    const parent = mountElement(linkSpec, api, renderer);
    const anchor = parent.children[0] as MockElement;

    const event = {
      preventDefault: () => { event.defaultPrevented = true; },
      stopPropagation: () => {},
      defaultPrevented: false,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      button: 0,
    };

    (anchor?.props.onclick as ((e: unknown) => void))?.(event);

    expect(userClicks).toEqual(['clicked']);
    expect(navigateCalls).toEqual(['/about']);
  });
});

describe('Link component - lifecycle callbacks', () => {
  function setup() {
    const env = createTestEnv();
    const el = El<MockRendererConfig>().create({
      scopedEffect: env.scopedEffect,
      renderer: env.renderer,
      createElementScope: env.createElementScope,
      onCleanup: env.onCleanup,
    });

    const currentPath = env.signal('/');
    const navigate = (path: string): void => {
      currentPath(path);
      window.history.pushState({}, '', path);
    };

    const api = {
      el: el.method,
      navigate,
    };

    return { ...env, el, Link, navigate, currentPath, api };
  }

  const mountElement = (spec: unknown, api: { el: unknown; navigate?: (path: string) => void }, renderer: { createElement: (tag: string) => MockElement }): MockElement => {
    const parent = renderer.createElement('div');
    const parentRef: ElementRef<MockElement> = {
      status: STATUS_ELEMENT,
      element: parent,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
    };

    const nodeRef = (spec as { create: (api: unknown) => ElementRef<MockElement> }).create(api);
    nodeRef.parent = parentRef;
    nodeRef.next = null;
    parent.children.push(nodeRef.element);

    return parent;
  };

  it('renders correctly as a sealed spec', () => {
    const { Link, renderer, api } = setup();

    const linkSpec = Link({ href: '/about' })('About');

    const parent = mountElement(linkSpec, api, renderer);
    expect(parent.children.length).toBe(1);
    const anchor = parent.children[0] as MockElement;
    expect(anchor?.tag).toBe('a');
    expect(anchor?.props.href).toBe('/about');
  });
});
