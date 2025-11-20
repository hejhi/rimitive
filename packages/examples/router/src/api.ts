/**
 * App-level API for router example
 *
 * All components in this app use this shared API.
 * This ensures consistent renderer configuration across the entire app.
 */
import { createApi } from '@lattice/lattice';
import {
  defaultExtensions as defaultViewExtensions,
  defaultHelpers as defaultViewHelpers,
} from '@lattice/view/presets/core';
import { createSignalsApi } from '@lattice/signals/presets/core';
import {
  createDOMRenderer,
  DOMRendererConfig,
} from '@lattice/view/renderers/dom';
import { RefSpec, STATUS_ELEMENT, STATUS_FRAGMENT } from '@lattice/view/types';
import type { ElementRef } from '@lattice/view/types';
import { createAddEventListener } from '@lattice/view/helpers/addEventListener';
import { createRouter } from '@lattice/router';

const createViewApi = () => {
  const signals = createSignalsApi();
  const renderer = createDOMRenderer();
  const viewHelpers = defaultViewHelpers(renderer, signals);

  // Create base extensions
  const baseExtensions = defaultViewExtensions<DOMRendererConfig>();

  // Create the views API (without route - that's separate now)
  const views = createApi(baseExtensions, viewHelpers);

  const api = {
    ...signals,
    ...views,
    addEventListener: createAddEventListener(viewHelpers.batch),
  };

  // Create router using view API (needs signal and computed from signals)
  const router = createRouter(api, {
    initialPath:
      typeof window !== 'undefined'
        ? window.location.pathname +
          window.location.search +
          window.location.hash
        : '/',
  });

  // Helper to mount a spec to a container element
  // Handles both FragmentRef and ElementRef properly
  const mountToContainer = (container: Element, spec: RefSpec<unknown>) => {
    const nodeRef = spec.create(api);

    // Check if it's a FragmentRef with attach method
    if (nodeRef.status === STATUS_FRAGMENT) {
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
  type ApiType = typeof api;

  return {
    api,
    signals,
    views,
    router,
    mount: <TElement>(spec: RefSpec<TElement>) => spec.create(api),
    mountToContainer,
    use: <TReturn>(fn: (api: ApiType) => TReturn): TReturn => fn(api),
  };
};

export const { api, signals, mount, mountToContainer, use, views, router } =
  createViewApi();

export type Signals = typeof signals;
export type DOMViews = typeof views;
export type CoreApi = typeof api;
