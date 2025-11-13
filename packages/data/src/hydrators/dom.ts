/**
 * Client-Side DOM Island Hydrator
 *
 * Hydrates server-rendered islands by:
 * 1. Finding island containers by ID
 * 2. Creating hydrating renderer to match existing DOM
 * 3. Running component with hydrating API (queued effects)
 * 4. On success: activate effects, unwrap container
 * 5. On failure: fallback to client-side render with regular API
 */

import type { IslandComponent, IslandMetaData } from '../types';
import { HydrationMismatch, ISLAND_META } from '../types';
import { createHydratingDOMRenderer } from '@lattice/view/renderers/hydrating-dom';
import { createHydratingApi } from '../hydrating-api';
import type { EffectAPI } from '../hydrating-api';
import type { SealedSpec } from '@lattice/view/types';

/**
 * Island registry - maps island type IDs to component functions
 * Generic to accept components with any specific prop types
 */
export type IslandRegistry = Record<string, IslandComponent>;

/**
 * Hydrator interface
 */
export interface IslandHydrator {
  /**
   * Hydrate all islands on the page
   * @param registry - Map of island types to components
   */
  hydrate<T extends IslandRegistry>(registry: T): void;
}

/**
 * Mount function type for client-side rendering fallback
 */
export type MountFn = (spec: SealedSpec<unknown>) => { element: unknown };

/**
 * Create API helpers function type
 * Used to create both hydrating and regular APIs
 * Accepts any function that takes two parameters and returns an API object
 */
export type CreateAPIFn = (
  renderer: unknown,
  signals: unknown
) => EffectAPI & Record<string, unknown>;

/**
 * Create a DOM island hydrator
 *
 * @param createAPI - Function to create API helpers (el, map, etc.)
 * @param signals - Signals API (for both hydrating and regular modes)
 * @param mount - Mount function for fallback client-side rendering
 * @returns Hydrator instance
 *
 * @example
 * ```ts
 * import { createDOMIslandHydrator } from '@lattice/data/hydrators/dom';
 * import { createSignalsApi } from '@lattice/signals/presets/core';
 * import { createSpec } from '@lattice/view/helpers';
 * import { createDOMRenderer } from '@lattice/view/renderers/dom';
 * import { Counter } from './islands/Counter';
 *
 * const signals = createSignalsApi();
 * const mount = (spec) => spec.create(createSpec(createDOMRenderer(), signals));
 *
 * const hydrator = createDOMIslandHydrator(createSpec, signals, mount);
 * hydrator.hydrate({ counter: Counter });
 * ```
 */
export function createDOMIslandHydrator(
  createAPI: CreateAPIFn,
  signals: unknown,
  mount: MountFn
): IslandHydrator {
  return {
    hydrate(registry: IslandRegistry) {
      // Set up global __hydrate function that inline scripts will call
      (window as { __hydrate?: (id: string, type: string, props: unknown) => void }).__hydrate = (
        id: string,
        type: string,
        props: unknown
      ) => {
        // Find island container
        const el = document.getElementById(id);
        if (!el) {
          console.warn(`Island container #${id} not found`);
          return;
        }

        // Look up component in registry
        const Component = registry[type];
        if (!Component) {
          console.warn(`Island component "${type}" not found in registry`);
          return;
        }

        // Get strategy from component metadata
        const meta = (Component as { [ISLAND_META]?: IslandMetaData })[ISLAND_META];
        const strategy = meta?.strategy;

        try {
          // Create hydrating renderer that returns existing nodes
          const hydratingRenderer = createHydratingDOMRenderer(el);

          // Create API with queued effects
          const baseAPI = createAPI(hydratingRenderer, signals);
          const { hydratingApi, activate } = createHydratingApi(baseAPI);

          // Run component with hydrating API
          // Effects are queued, not executed
          Component(props).create(hydratingApi);

          // Success! Activate queued effects
          activate();

          // Unwrap container div, leaving hydrated content in place
          const children = Array.from(el.childNodes);
          el.replaceWith(...children);

        } catch (error) {
          // Hydration failed - check if it's a mismatch
          if (error instanceof HydrationMismatch) {
            // Call strategy handler if provided
            if (strategy?.onMismatch) {
              const result = strategy.onMismatch(
                error,
                el,
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

            // Clear container and mount fresh
            el.innerHTML = '';
            const instance = mount(Component(props));
            if (instance.element) {
              el.appendChild(instance.element as Node);
            }
          } else {
            // Not a hydration mismatch - re-throw
            throw error;
          }
        }
      };

      // Process islands queued by inline scripts
      const islands = (window as unknown as { __islands?: Array<{ i: string; t: string; p: unknown }> }).__islands;
      if (islands) {
        islands.forEach(({ i, t, p }) => {
          const hydrateFn = (window as unknown as { __hydrate: (id: string, type: string, props: unknown) => void }).__hydrate;
          hydrateFn(i, t, p);
        });
      }
    },
  };
}
