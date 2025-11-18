/**
 * App-level API for router example
 *
 * All components in this app use this shared API.
 * This ensures consistent renderer configuration across the entire app.
 */
import { createApi } from '@lattice/lattice';
import {
  ComponentFactory,
  defaultExtensions as defaultViewExtensions,
  defaultHelpers as defaultViewHelpers
} from '@lattice/view/presets/core';
import { createSignalsApi } from '@lattice/signals/presets/core';
import { createDOMRenderer, DOMRendererConfig } from '@lattice/view/renderers/dom';
import { SealedSpec, RefSpec, STATUS_ELEMENT } from '@lattice/view/types';
import type { ElementRef } from '@lattice/view/types';
import { create as createComponent } from '@lattice/view/component';
import { createAddEventListener } from '@lattice/view/helpers/addEventListener';
import { createRouteFactory } from '@lattice/router';
import { createLinkFactory } from '@lattice/router';

const createViewApi = () => {
  const signals = createSignalsApi();
  const renderer = createDOMRenderer();
  const viewHelpers = defaultViewHelpers(renderer, signals);

  // Create currentPath signal for routing
  const currentPath = signals.signal(window.location.pathname);

  // Set up popstate listener for browser back/forward buttons
  window.addEventListener('popstate', () => {
    currentPath(window.location.pathname);
  });

  // Create navigate function (same as in route factory)
  const navigate = (path: string): void => {
    currentPath(path);
    window.history.pushState({}, '', path);
  };

  // First create base extensions to get el, match, and show
  const baseExtensions = defaultViewExtensions<DOMRendererConfig>();
  const baseViews = createApi(baseExtensions, viewHelpers);

  // Create the complete views API with route and Link included
  const views = createApi(
    {
      ...baseExtensions,
      route: createRouteFactory<DOMRendererConfig>(),
      Link: createLinkFactory<DOMRendererConfig>(),
    },
    {
      ...viewHelpers,
      computed: signals.computed,
      el: baseViews.el, // Pass el to route factory
      match: baseViews.match, // Pass match to route factory
      show: baseViews.show, // Pass show to route factory
      currentPath,
      navigate,
    }
  );

  const api = {
    ...signals,
    ...views,
    addEventListener: createAddEventListener(viewHelpers.batch),
    navigate,
    currentPath,
  };

  // Helper to mount a spec to a container element
  // Handles both FragmentRef and ElementRef properly
  const mountToContainer = (container: Element, spec: SealedSpec<unknown> | RefSpec<unknown>) => {
    const nodeRef = spec.create(api);

    // Check if it's a FragmentRef with attach method
    if ('attach' in nodeRef && typeof nodeRef.attach === 'function') {
      // Create parent ref for the container
      const parentRef: ElementRef<Element> = {
        status: STATUS_ELEMENT,
        element: container,
        parent: null,
        prev: null,
        next: null,
        firstChild: null,
        lastChild: null,
      };
      nodeRef.parent = parentRef;
      nodeRef.next = null;
      nodeRef.attach(parentRef, null, api);
    } else if ('element' in nodeRef && nodeRef.element) {
      // For element refs, just append
      container.appendChild(nodeRef.element as Node);
    }

    return nodeRef;
  };

  return {
    api,
    signals,
    views,
    mount: <TElement>(spec: SealedSpec<TElement>) => spec.create(api),
    mountToContainer,
    create: createComponent as ComponentFactory<typeof api>,
  };
}

export const { api, signals, mount, mountToContainer, create, views } = createViewApi();

export type Signals = typeof signals;
export type DOMViews = typeof views;
export type CoreApi = typeof api;
