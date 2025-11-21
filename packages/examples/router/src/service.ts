/**
 * App-level API for router example
 *
 * All components in this app use this shared API.
 * This ensures consistent renderer configuration across the entire app.
 */
import { composeFrom } from '@lattice/lattice';
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
  const signalSvc = createSignalsApi();
  const renderer = createDOMRenderer();
  const viewHelpers = defaultViewHelpers(renderer, signalSvc);

  // Create base extensions
  const baseExtensions = defaultViewExtensions<DOMRendererConfig>();

  // Create the views API (without route - that's separate now)
  const viewSvc = composeFrom(baseExtensions, viewHelpers);

  const svc = {
    ...signalSvc,
    ...viewSvc,
    addEventListener: createAddEventListener(viewHelpers.batch),
  };

  // Create router using view API (needs signal and computed from signals)
  const router = createRouter(svc, {
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
    const nodeRef = spec.create(svc);

    // Check if it's a FragmentRef with attach impl
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
      nodeRef.attach(parentRef, null, svc);
    } else if ('element' in nodeRef && nodeRef.element) {
      // For element refs, just append
      container.appendChild(nodeRef.element as Node);
    }

    return nodeRef;
  };
  type Service = typeof svc;

  return {
    service: {
      view: viewSvc,
      signals: signalSvc,
    },
    router,
    mount: <TElement>(spec: RefSpec<TElement>) => spec.create(svc),
    mountToContainer,
    useSvc: <TReturn>(fn: (svc: Service) => TReturn): TReturn => fn(svc),
  };
};

export const { service, mount, mountToContainer, useSvc, router } =
  createViewApi();

export type Service = typeof service;
export type Signals = Service['signals'];
export type DOMViews = Service['view'];
