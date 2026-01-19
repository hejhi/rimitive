import { describe, it, expect } from 'vitest';
import { Link } from './link';
import {
  createTestEnv,
  type MockAdapterConfig,
  type MockElement,
  type MockText,
  getTextContent,
} from '../../view/src/test-utils';
import { createElFactory } from '@rimitive/view/el';
import type { ElementRef } from '@rimitive/view/types';
import { STATUS_ELEMENT } from '@rimitive/view/types';

describe('Link component - basic rendering', () => {
  function setup() {
    const env = createTestEnv();
    const el = createElFactory<MockAdapterConfig>({
      scopedEffect: env.scopedEffect,
      adapter: env.adapter,
      createElementScope: env.createElementScope,
      onCleanup: env.onCleanup,
    });

    const currentPath = env.signal('/');
    const navigate = (path: string): void => {
      currentPath(path);
      window.history.pushState({}, '', path);
    };

    const svc = {
      el,
      router: { navigate },
    };

    return { ...env, el, Link, navigate, currentPath, svc };
  }

  const mountElement = (
    spec: unknown,
    svc: { el: unknown; navigate?: (path: string) => void },
    adapter: { createNode: (tag: string) => MockElement | MockText }
  ): MockElement => {
    const parent = adapter.createNode('div') as MockElement;
    const parentRef: ElementRef<MockElement> = {
      status: STATUS_ELEMENT,
      element: parent,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
    };

    const nodeRef = (
      spec as { create: (svc: unknown) => ElementRef<MockElement> }
    ).create(svc);
    nodeRef.parent = parentRef;
    nodeRef.next = null;
    parent.children.push(nodeRef.element);

    return parent;
  };

  it('renders anchor element with href', () => {
    const { Link, adapter, svc } = setup();

    const linkSpec = Link({ href: '/about' })('About');
    const parent = mountElement(linkSpec, svc, adapter);

    expect(parent.children.length).toBe(1);
    const anchor = parent.children[0] as MockElement;
    expect(anchor?.tag).toBe('a');
    expect(anchor?.props.href).toBe('/about');
    expect(getTextContent(parent)).toBe('About');
  });

  it('accepts standard anchor attributes', () => {
    const { Link, adapter, svc } = setup();

    const linkSpec = Link({
      href: '/products',
      className: 'nav-link',
      id: 'products-link',
      title: 'View Products',
    })('Products');

    const parent = mountElement(linkSpec, svc, adapter);
    const anchor = parent.children[0] as MockElement;

    expect(anchor?.props.className).toBe('nav-link');
    expect(anchor?.props.id).toBe('products-link');
    expect(anchor?.props.title).toBe('View Products');
  });

  it('accepts multiple children', () => {
    const { Link, el, adapter, svc } = setup();

    const linkSpec = Link({ href: '/home' })(
      el('span')('Go to '),
      el('strong')('Home')
    );

    const parent = mountElement(linkSpec, svc, adapter);
    expect(getTextContent(parent)).toContain('Go to');
    expect(getTextContent(parent)).toContain('Home');
  });
});

describe('Link component - click handling', () => {
  function setup() {
    const env = createTestEnv();
    const el = createElFactory<MockAdapterConfig>({
      scopedEffect: env.scopedEffect,
      adapter: env.adapter,
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

    const svc = {
      el,
      router: { navigate },
    };

    return { ...env, el, Link, navigate, currentPath, navigateCalls, svc };
  }

  const mountElement = (
    spec: unknown,
    svc: { el: unknown; navigate?: (path: string) => void },
    adapter: { createNode: (tag: string) => MockElement | MockText }
  ): MockElement => {
    const parent = adapter.createNode('div') as MockElement;
    const parentRef: ElementRef<MockElement> = {
      status: STATUS_ELEMENT,
      element: parent,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
    };

    const nodeRef = (
      spec as { create: (svc: unknown) => ElementRef<MockElement> }
    ).create(svc);
    nodeRef.parent = parentRef;
    nodeRef.next = null;
    parent.children.push(nodeRef.element);

    return parent;
  };

  it('intercepts click on internal link', () => {
    const { Link, adapter, navigateCalls, svc } = setup();

    const linkSpec = Link({ href: '/about' })('About');
    const parent = mountElement(linkSpec, svc, adapter);
    const anchor = parent.children[0] as MockElement;

    const event = {
      preventDefault: () => {
        event.defaultPrevented = true;
      },
      stopPropagation: () => {},
      defaultPrevented: false,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      button: 0,
    };

    (anchor?.props.onclick as (e: unknown) => void)?.(event);

    expect(event.defaultPrevented).toBe(true);
    expect(navigateCalls).toEqual(['/about']);
  });

  it('does not intercept click with metaKey (cmd+click)', () => {
    const { Link, adapter, navigateCalls, svc } = setup();

    const linkSpec = Link({ href: '/about' })('About');
    const parent = mountElement(linkSpec, svc, adapter);
    const anchor = parent.children[0] as MockElement;

    const event = {
      preventDefault: () => {
        event.defaultPrevented = true;
      },
      stopPropagation: () => {},
      defaultPrevented: false,
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      button: 0,
    };

    (anchor?.props.onclick as (e: unknown) => void)?.(event);

    expect(event.defaultPrevented).toBe(false);
    expect(navigateCalls).toEqual([]);
  });

  it('does not intercept click with ctrlKey', () => {
    const { Link, adapter, navigateCalls, svc } = setup();

    const linkSpec = Link({ href: '/about' })('About');
    const parent = mountElement(linkSpec, svc, adapter);
    const anchor = parent.children[0] as MockElement;

    const event = {
      preventDefault: () => {
        event.defaultPrevented = true;
      },
      stopPropagation: () => {},
      defaultPrevented: false,
      metaKey: false,
      ctrlKey: true,
      shiftKey: false,
      button: 0,
    };

    (anchor?.props.onclick as (e: unknown) => void)?.(event);

    expect(event.defaultPrevented).toBe(false);
    expect(navigateCalls).toEqual([]);
  });

  it('does not intercept right-click', () => {
    const { Link, adapter, navigateCalls, svc } = setup();

    const linkSpec = Link({ href: '/about' })('About');
    const parent = mountElement(linkSpec, svc, adapter);
    const anchor = parent.children[0] as MockElement;

    const event = {
      preventDefault: () => {
        event.defaultPrevented = true;
      },
      stopPropagation: () => {},
      defaultPrevented: false,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      button: 2, // Right click
    };

    (anchor?.props.onclick as (e: unknown) => void)?.(event);

    expect(event.defaultPrevented).toBe(false);
    expect(navigateCalls).toEqual([]);
  });

  it('does not intercept external http link', () => {
    const { Link, adapter, navigateCalls, svc } = setup();

    const linkSpec = Link({ href: 'http://example.com' })('External');
    const parent = mountElement(linkSpec, svc, adapter);
    const anchor = parent.children[0] as MockElement;

    const event = {
      preventDefault: () => {
        event.defaultPrevented = true;
      },
      stopPropagation: () => {},
      defaultPrevented: false,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      button: 0,
    };

    (anchor?.props.onclick as (e: unknown) => void)?.(event);

    expect(event.defaultPrevented).toBe(false);
    expect(navigateCalls).toEqual([]);
  });

  it('does not intercept external https link', () => {
    const { Link, adapter, navigateCalls, svc } = setup();

    const linkSpec = Link({ href: 'https://example.com' })('External');
    const parent = mountElement(linkSpec, svc, adapter);
    const anchor = parent.children[0] as MockElement;

    const event = {
      preventDefault: () => {
        event.defaultPrevented = true;
      },
      stopPropagation: () => {},
      defaultPrevented: false,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      button: 0,
    };

    (anchor?.props.onclick as (e: unknown) => void)?.(event);

    expect(event.defaultPrevented).toBe(false);
    expect(navigateCalls).toEqual([]);
  });

  it('merges user onclick with navigation handler', () => {
    const { Link, adapter, navigateCalls, svc } = setup();

    const userClicks: string[] = [];
    const linkSpec = Link({
      href: '/about',
      onclick: () => {
        userClicks.push('clicked');
      },
    })('About');

    const parent = mountElement(linkSpec, svc, adapter);
    const anchor = parent.children[0] as MockElement;

    const event = {
      preventDefault: () => {
        event.defaultPrevented = true;
      },
      stopPropagation: () => {},
      defaultPrevented: false,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      button: 0,
    };

    (anchor?.props.onclick as (e: unknown) => void)?.(event);

    expect(userClicks).toEqual(['clicked']);
    expect(navigateCalls).toEqual(['/about']);
  });
});

describe('Link component - lifecycle callbacks', () => {
  function setup() {
    const env = createTestEnv();
    const el = createElFactory<MockAdapterConfig>({
      scopedEffect: env.scopedEffect,
      adapter: env.adapter,
      createElementScope: env.createElementScope,
      onCleanup: env.onCleanup,
    });

    const currentPath = env.signal('/');
    const navigate = (path: string): void => {
      currentPath(path);
      window.history.pushState({}, '', path);
    };

    const svc = {
      el,
      router: { navigate },
    };

    return { ...env, el, Link, navigate, currentPath, svc };
  }

  const mountElement = (
    spec: unknown,
    svc: { el: unknown; navigate?: (path: string) => void },
    adapter: { createNode: (tag: string) => MockElement | MockText }
  ): MockElement => {
    const parent = adapter.createNode('div') as MockElement;
    const parentRef: ElementRef<MockElement> = {
      status: STATUS_ELEMENT,
      element: parent,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
    };

    const nodeRef = (
      spec as { create: (svc: unknown) => ElementRef<MockElement> }
    ).create(svc);
    nodeRef.parent = parentRef;
    nodeRef.next = null;
    parent.children.push(nodeRef.element);

    return parent;
  };

  it('renders correctly as a sealed spec', () => {
    const { Link, adapter, svc } = setup();

    const linkSpec = Link({ href: '/about' })('About');

    const parent = mountElement(linkSpec, svc, adapter);
    expect(parent.children.length).toBe(1);
    const anchor = parent.children[0] as MockElement;
    expect(anchor?.tag).toBe('a');
    expect(anchor?.props.href).toBe('/about');
  });
});
