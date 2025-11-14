/**
 * Client-Side DOM Island Hydrator
 *
 * Hydrates server-rendered islands by:
 * 1. Finding islands by script tag marker
 *    - Element islands: script's previousElementSibling is island root
 *    - Fragment islands: script's parent is the wrapper div container
 * 2. For element islands: wrap in temporary div to isolate during hydration
 * 3. Creating hydrating renderer targeting the container
 * 4. Running component with hydrating API (queued effects)
 * 5. On success: activate effects, remove script tag, unwrap temporary/fragment containers
 * 6. On failure: fallback to client-side render with regular API
 */

import type { IslandMetaData, IslandRegistryEntry } from '../types';
import { HydrationMismatch, ISLAND_META } from '../types';
import { createHydratingRenderer } from '@lattice/view/renderers/switchable-dom';
import { createHydratingDOMRenderer } from '@lattice/view/renderers/hydrating-dom';
import { createDOMRenderer } from '@lattice/view/renderers/dom';
import { createHydratingApi } from '../hydrating-api';
import type { EffectAPI } from '../hydrating-api';
import type { SealedSpec } from '@lattice/view/types';

/**
 * Base island type for registration - accepts any object with island metadata
 * This avoids TypeScript's strict contravariance rules for function parameters
 * Uses `unknown` for the metadata type to allow heterogeneous island collections
 */
type RegisterableIsland = { [ISLAND_META]?: unknown };

/**
 * Hydrator interface
 */
export interface IslandHydrator {
  /**
   * Hydrate all islands on the page
   * @param islands - Island components to register (can have different prop types)
   */
  hydrate(...islands: RegisterableIsland[]): void;
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
    hydrate(...islands: RegisterableIsland[]) {
      // Build registry from island metadata - id comes from island() call
      // Wrapper only exists until this point - original component flows through system
      const entries: Record<string, IslandRegistryEntry> = {};
      for (const wrapper of islands) {
        const meta = (wrapper as { [ISLAND_META]?: IslandMetaData })[ISLAND_META];
        if (!meta) {
          console.warn('Island missing metadata - skipping:', wrapper);
          continue;
        }
        entries[meta.id] = {
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
        // Find island by script tag marker
        const script = document.querySelector(`script[type="application/json"][data-island="${id}"]`);
        if (!script) {
          console.warn(`Island script tag [data-island="${id}"] not found`);
          return;
        }

        // Get island container and element:
        // - For element islands: script's previous sibling is the island root
        // - For fragment islands: script's parent is the container div
        const islandElement = script.previousElementSibling as HTMLElement | null;
        const isFragment = !islandElement;

        // For element islands, create a temporary wrapper to isolate it during hydration
        // For fragment islands, use the existing wrapper div
        let container: HTMLElement;
        let tempWrapper: HTMLElement | null = null;

        if (isFragment) {
          container = script.parentElement as HTMLElement;
          if (!container) {
            console.warn(`Island container for "${id}" not found`);
            return;
          }
        } else {
          if (!islandElement) {
            console.warn(`Island element for "${id}" not found`);
            return;
          }
          // Create temporary wrapper and move island into it
          tempWrapper = document.createElement('div');
          islandElement.parentNode?.insertBefore(tempWrapper, islandElement);
          tempWrapper.appendChild(islandElement);
          container = tempWrapper;
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
            createHydratingDOMRenderer(container),
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

          // Remove script tag marker
          script.remove();

          // Cleanup wrappers:
          // - For fragment islands: unwrap container div, leaving hydrated content in place
          // - For element islands: unwrap temporary wrapper, leaving hydrated island
          if (isFragment) {
            container.replaceWith(...Array.from(container.childNodes));
          } else if (tempWrapper) {
            tempWrapper.replaceWith(...Array.from(tempWrapper.childNodes));
          }

        } catch (error) {
          // Hydration failed - check if it's a mismatch
          if (error instanceof HydrationMismatch) {
            // Call strategy handler if provided
            if (strategy?.onMismatch) {
              const result = strategy.onMismatch(error, container, props, Component, mount);
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
            // - For element islands: remove temp wrapper, island, and script, mount fresh
            // - For fragment islands: clear the container div and mount fresh
            if (isFragment) {
              container.innerHTML = '';
              const instance = mount(Component(props));
              if (instance.element) container.appendChild(instance.element as Node);
            } else {
              // Remove temporary wrapper, script tag, and mount fresh
              const parent = tempWrapper?.parentNode || islandElement?.parentNode;
              if (tempWrapper) tempWrapper.remove();
              script.remove();
              const instance = mount(Component(props));
              if (instance.element && parent) parent.appendChild(instance.element as Node);
            }
          } else throw error; // Not a hydration mismatch - re-throw
        }
      };

      // Process islands queued by inline scripts
      const queuedIslands = (window as unknown as { __islands?: Array<{ i: string; t: string; p: unknown }> }).__islands;

      if (!queuedIslands) return;
      queuedIslands.forEach(({ i, t, p }) => {
        const hydrateFn = (window as unknown as { __hydrate: (id: string, type: string, props: unknown) => void }).__hydrate;
        hydrateFn(i, t, p);
      });
    },
  };
}
