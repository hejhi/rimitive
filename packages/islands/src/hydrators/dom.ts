/**
 * Client-Side DOM Island Hydrator
 *
 * Hydrates server-rendered islands by:
 * 1. Finding islands by script tag marker
 *    - Element islands: script's previousElementSibling is island root
 *    - Fragment islands: script's parent is the wrapper div container
 * 2. For element islands: use the island's parent as the container
 * 3. Creating hydrating adapter targeting the container
 * 4. Running component with service (effects run immediately, same as SSR)
 * 5. On success: switch to DOM adapter, remove script tag, unwrap fragment containers
 * 6. On failure: fallback to client-side render with regular service
 */

import type { IslandMetaData, IslandRegistryEntry } from '../types';
import type { RefSpec, ElementRef } from '@lattice/view/types';
import { STATUS_ELEMENT, STATUS_FRAGMENT } from '@lattice/view/types';
import { createDOMAdapter } from '@lattice/view/adapters/dom';
import { ISLAND_META } from '../types';
import {
  createHydrationAdapter,
  createDOMHydrationAdapter,
  HydrationMismatch,
} from '@lattice/ssr/client';

/**
 * Base island type for registration - accepts any object with island metadata
 * This avoids TypeScript's strict contravariance rules for function parameters
 * Uses `unknown` for the metadata type to allow heterogeneous island collections
 */
type RegisterableIsland = { [ISLAND_META]?: unknown };

/**
 * Hydrator type
 */
export type IslandHydrator = {
  /**
   * Hydrate all islands on the page
   * @param islands - Island components to register (can have different prop types)
   */
  hydrate: (...islands: RegisterableIsland[]) => void;
};

/**
 * Mount function type for client-side rendering fallback
 */
export type MountFn = (spec: RefSpec<unknown>) => { element: unknown };

/**
 * Result type from createSvc - includes both the svc and scope helper
 */
export type CreateSvcResult = {
  svc: Record<string, unknown>;
  createElementScope: <TElement extends object>(
    element: TElement,
    fn: () => void
  ) => unknown;
};

/**
 * Create a DOM hydrator for islands
 *
 * @example
 * ```typescript
 * import { createDOMHydrator } from '@lattice/islands/hydrators/dom';
 * import { createSignals } from '@lattice/signals/presets/core';
 * import { createView } from '@lattice/view/presets/core';
 * import { createIslandsAdapter } from '@lattice/islands/adapters/islands';
 * import { createDOMAdapter } from '@lattice/view/adapters/dom';
 * import { createDOMHydrationAdapter } from '@lattice/islands/adapters/dom-hydration';
 *
 * const domAdapter = createDOMAdapter();
 * const hydrateAdapter = createDOMHydrationAdapter(document.body);
 * const adapter = createIslandsAdapter(hydrateAdapter, domAdapter);
 *
 * const createSvc = (islandAdapter) => {
 *   const signals = createSignals();
 *   const view = createView({ adapter: islandAdapter, signals })();
 *   return {
 *     svc: view,
 *     createElementScope: (el, fn) => fn()
 *   };
 * };
 *
 * const hydrator = createDOMHydrator(createSvc, (spec) => ({ element: spec.create({}) }));
 * hydrator.hydrate(Counter, TodoList);
 * ```
 */
export function createDOMHydrator(
  createSvc: (
    adapter: ReturnType<typeof createHydrationAdapter>
  ) => CreateSvcResult,
  mount: MountFn
): IslandHydrator {
  return {
    hydrate: (...islands: RegisterableIsland[]) => {
      // Build registry from island metadata - id comes from island() call
      // Wrapper only exists until this point - original component flows through system
      const entries: Record<string, IslandRegistryEntry> = {};
      for (const wrapper of islands) {
        const meta = (wrapper as { [ISLAND_META]?: IslandMetaData })[
          ISLAND_META
        ];
        if (!meta) {
          console.warn('Island missing metadata - skipping:', wrapper);
          continue;
        }
        entries[meta.id] = {
          component: meta.component, // Unwrap: use original component, not wrapper
          id: meta.id,
          strategy: meta.strategy,
        };
      }

      // Set up global __hydrate function that inline scripts will call
      (
        window as {
          __hydrate?: (
            id: string,
            type: string,
            props: unknown,
            status: number
          ) => void;
        }
      ).__hydrate = (
        id: string,
        type: string,
        props: unknown,
        status: number
      ) => {
        // Find island by script tag marker
        const script = document.querySelector(
          `script[type="application/json"][data-island="${id}"]`
        );
        if (!script) {
          console.warn(`Island script tag [data-island="${id}"] not found`);
          return;
        }

        // Get potential island element (previous sibling, skipping comments)
        const islandElement =
          script.previousElementSibling as HTMLElement | null;

        // For fragments, parent is the wrapper div; for elements, parent contains the element
        const potentialContainer = script.parentElement as HTMLElement;
        if (!potentialContainer) {
          console.warn(`Island container for "${id}" not found`);
          return;
        }

        // Look up island entry in registry
        const entry = entries[type];
        if (!entry) {
          console.warn(`Island component "${type}" not found in registry`);
          return;
        }

        // Extract component and strategy from registry entry
        const Component = entry.component;
        const strategy = entry.strategy;

        // Determine if fragment from SSR-provided status
        const isFragment = status === STATUS_FRAGMENT;

        // Select container based on status
        // - Fragments: use the wrapper div (potentialContainer)
        // - Elements: use the element itself (islandElement)
        const container = isFragment
          ? potentialContainer
          : islandElement || potentialContainer;

        // Variables that need to be accessible in catch block
        let fragmentParentRef: ElementRef<unknown> | null = null;

        try {
          const adapter = createHydrationAdapter(
            createDOMHydrationAdapter(container),
            createDOMAdapter()
          );

          const { svc } = createSvc(adapter);

          const componentFn = Component(svc);
          const nodeRef = componentFn(props).create(svc);

          // For fragment islands, call attach() and activate while in hydrating mode
          // attach() is where map() creates the reconciler and binds event handlers
          if (isFragment && nodeRef.status === STATUS_FRAGMENT) {
            // CRITICAL: Enter the container's children first
            // The hydrating adapter starts at position [] (the container itself)
            // We need to advance to position [0], [1], etc. (inside the container)
            // Calling createElement('div') matches the container and enters its children
            adapter.createNode('div');

            // Create a parent ref for the wrapper div (needed for hydration to work)
            // Save it so we can update it later before unwrapping
            fragmentParentRef = {
              status: STATUS_ELEMENT,
              element: container,
              parent: null,
              prev: null,
              next: null,
              firstChild: null,
              lastChild: null,
            };

            nodeRef.attach(fragmentParentRef, null, svc);
          }

          // Success! Hydration complete
          // Switch adapter to fallback mode for future reactive updates
          adapter.switchToFallback();

          // Remove script tag marker
          script.remove();

          // Cleanup wrappers:
          // - For fragment islands: unwrap container div, leaving hydrated content in place
          // - For element islands: no cleanup needed (island already in correct position)
          if (isFragment) {
            // Get the actual parent element before unwrapping
            const actualParent = container.parentElement;
            if (!actualParent) {
              throw new Error(
                `Fragment island "${id}" container has no parent element`
              );
            }

            // Update the parent element reference BEFORE unwrapping
            // The reconciler in map() now uses parent.element directly (not a captured copy)
            // so updating this reference will fix all future DOM operations
            if (fragmentParentRef) {
              fragmentParentRef.element = actualParent;
            }

            // Now unwrap the container - the parent reference is already updated
            container.replaceWith(...Array.from(container.childNodes));
          }
        } catch (error) {
          // Hydration failed - check if it's a mismatch
          if (error instanceof HydrationMismatch) {
            // Call strategy handler if provided
            if (strategy?.onMismatch) {
              const result = strategy.onMismatch(
                error,
                container,
                props,
                Component,
                mount
              );
              // If handler returns false, skip default fallback
              if (result === false) return;
            }

            // Default fallback: log warning and client-side render
            console.warn(
              `Hydration mismatch for island "${type}":`,
              error.message,
              '\nFalling back to client-side render.'
            );

            // Clear and remount:
            // - For element islands: remove island and script, mount fresh
            // - For fragment islands: clear the container div and mount fresh
            const fallbackAdapter = createDOMAdapter();
            const { svc: fallbackSvc } = createSvc(
              createHydrationAdapter(fallbackAdapter, fallbackAdapter)
            );

            if (isFragment) {
              container.innerHTML = '';
              const fallbackComponentFn = Component(fallbackSvc);
              const instance = mount(fallbackComponentFn(props));
              if (instance.element)
                container.appendChild(instance.element as Node);
            } else {
              // Remove island element, script tag, and mount fresh
              const parent = islandElement?.parentNode;
              if (islandElement) islandElement.remove();
              script.remove();
              const fallbackComponentFn = Component(fallbackSvc);
              const instance = mount(fallbackComponentFn(props));
              if (instance.element && parent)
                parent.appendChild(instance.element as Node);
            }
          } else throw error; // Not a hydration mismatch - re-throw
        }
      };

      // Process islands queued by inline scripts
      const queuedIslands = (
        window as unknown as {
          __islands?: Array<{
            id: string;
            type: string;
            props: unknown;
            status: number;
          }>;
        }
      ).__islands;

      if (!queuedIslands) return;
      queuedIslands.forEach(({ id, type, props, status }) => {
        const hydrateFn = (
          window as unknown as {
            __hydrate: (
              id: string,
              type: string,
              props: unknown,
              status: number
            ) => void;
          }
        ).__hydrate;
        hydrateFn(id, type, props, status);
      });
    },
  };
}
