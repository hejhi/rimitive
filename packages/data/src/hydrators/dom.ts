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

import type { IslandComponent, IslandMetaData, IslandRegistryEntry } from '../types';
import { HydrationMismatch, ISLAND_META } from '../types';
import { createHydratingRenderer } from '@lattice/view/renderers/switchable-dom';
import { createHydratingDOMRenderer } from '@lattice/view/renderers/hydrating-dom';
import { createDOMRenderer } from '@lattice/view/renderers/dom';
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
 * Create a DOM island hydrator
 *
 * @param createAPI - Function to create API helpers (el, map, etc.)
 * @param signals - Signals API (for both hydrating and regular modes)
 * @param mount - Mount function for fallback client-side rendering
 * @returns Hydrator instance
 */
export function createDOMIslandHydrator<
  TSignals extends EffectAPI
>(
  createAPI: (renderer: ReturnType<typeof createHydratingRenderer>, signals: TSignals) => EffectAPI & Record<string, unknown>,
  signals: TSignals,
  mount: MountFn
): IslandHydrator {
  return {
    hydrate(registry: IslandRegistry) {
      // Convert registry to structured entries by extracting and unwrapping metadata
      // Wrapper only exists until this point - original component flows through system
      const entries: Record<string, IslandRegistryEntry> = {};
      for (const [type, wrapper] of Object.entries(registry)) {
        const meta = (wrapper as { [ISLAND_META]?: IslandMetaData })[ISLAND_META];
        if (!meta) {
          console.warn(`Island "${type}" missing metadata - skipping`);
          continue;
        }
        entries[type] = {
          component: meta.component,  // Unwrap: use original component, not wrapper
          id: meta.id,
          strategy: meta.strategy,
        };
      }

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

        // Look up island entry in registry
        const entry = entries[type];
        if (!entry) {
          console.warn(`Island component "${type}" not found in registry`);
          return;
        }

        // Extract component and strategy from registry entry
        const Component = entry.component;
        const strategy = entry.strategy;

        try {
          // Create hydrating renderer that delegates to hydrating mode initially,
          // then switches to fallback mode for reactive updates
          const renderer = createHydratingRenderer(
            createHydratingDOMRenderer(el),
            createDOMRenderer()
          );

          // Create API with hydrating renderer
          const { hydratingApi, activate } = createHydratingApi(createAPI(renderer, signals));

          // Run component with hydrating API
          // Effects are queued, not executed yet
          Component(props).create(hydratingApi);

          // Success! Hydration complete
          // Switch renderer to fallback mode for future reactive updates
          renderer.switchToFallback();

          // Activate queued effects - they'll use regular mode now
          activate();

          // Unwrap container div, leaving hydrated content in place
          el.replaceWith(...Array.from(el.childNodes));

        } catch (error) {
          // Hydration failed - check if it's a mismatch
          if (error instanceof HydrationMismatch) {
            // Call strategy handler if provided
            if (strategy?.onMismatch) {
              const result = strategy.onMismatch(error, el, props, Component, mount);
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
            if (instance.element) el.appendChild(instance.element as Node);
          } else throw error; // Not a hydration mismatch - re-throw
        }
      };

      // Process islands queued by inline scripts
      const islands = (window as unknown as { __islands?: Array<{ i: string; t: string; p: unknown }> }).__islands;

      if (!islands) return;
      islands.forEach(({ i, t, p }) => {
        const hydrateFn = (window as unknown as { __hydrate: (id: string, type: string, props: unknown) => void }).__hydrate;
        hydrateFn(i, t, p);
      });
    },
  };
}
