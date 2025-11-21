/**
 * Client-Side DOM Island Hydrator
 *
 * Hydrates server-rendered islands by:
 * 1. Finding islands by script tag marker
 *    - Element islands: script's previousElementSibling is island root
 *    - Fragment islands: script's parent is the wrapper div container
 * 2. For element islands: use the island's parent as the container
 * 3. Creating hydrating renderer targeting the container
 * 4. Running component with hydrating API (queued effects)
 * 5. On success: activate effects, remove script tag, unwrap fragment containers
 * 6. On failure: fallback to client-side render with regular API
 */

import type { IslandMetaData, IslandRegistryEntry } from '../types';
import type { RefSpec } from '@lattice/view/types';
import { HydrationMismatch, ISLAND_META } from '../types';
import { createIslandsRenderer } from '../renderers/islands';
import { createDOMHydrationRenderer } from '../renderers/dom-hydration';
import { createDOMRenderer } from '@lattice/view/renderers/dom';
import { createHydrationApi } from '../hydration-api';
import type { EffectAPI } from '../hydration-api';
import type { ElementRef } from '@lattice/view/types';
import { STATUS_ELEMENT, STATUS_FRAGMENT } from '@lattice/view/types';

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
  hydrate: (...islands: RegisterableIsland[]) => void;
}

/**
 * Mount function type for client-side rendering fallback
 */
export type MountFn = (spec: RefSpec<unknown>) => { element: unknown };

/**
 * Create a DOM island hydrator
 *
 * @param createAPI - Function to create API helpers (el, map, etc.)
 * @param signals - Signals API (for both hydrating and regular modes)
 * @param mount - Mount function for fallback client-side rendering
 * @returns Hydrator instance
 */
export function createDOMHydrator<TSignals extends EffectAPI>(
  createAPI: (
    renderer: ReturnType<typeof createIslandsRenderer>,
    signals: TSignals
  ) => EffectAPI & Record<string, unknown>,
  signals: TSignals,
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
          __hydrate?: (id: string, type: string, props: unknown) => void;
        }
      ).__hydrate = (id: string, type: string, props: unknown) => {
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

        // We'll determine if it's a fragment after creating the component
        // For now, use parent as potential container for fragments
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

        // Variables that need to be accessible in catch block
        let isFragment = false;
        let container: HTMLElement = potentialContainer;
        let fragmentParentRef: ElementRef<unknown> | null = null;

        try {
          // Create component first to determine if it's a fragment
          // Use a temporary renderer just for component creation
          const tempRenderer = createIslandsRenderer(
            createDOMHydrationRenderer(islandElement || potentialContainer),
            createDOMRenderer()
          );

          // Create API with temporary renderer just to get the nodeRef type
          const tempApi = createAPI(tempRenderer, signals);

          // Run component factory with API to get component function, then call with props
          const componentFn = Component(tempApi);
          const nodeRef = componentFn(props).create(tempApi);

          // Determine if fragment based on NodeRef, not DOM structure
          // STATUS_FRAGMENT = 2
          isFragment = nodeRef.status === 2;

          // Now create the actual renderer with the correct container
          container = isFragment
            ? potentialContainer
            : islandElement || potentialContainer;

          const renderer = createIslandsRenderer(
            createDOMHydrationRenderer(container),
            createDOMRenderer()
          );

          // Create API with actual renderer
          const { hydratingApi, activate } = createHydrationApi(
            createAPI(renderer, signals)
          );

          // Re-create component with the actual hydrating API
          const actualComponentFn = Component(hydratingApi);
          const actualNodeRef = actualComponentFn(props).create(hydratingApi);

          // For fragment islands, call attach() and activate while in hydrating mode
          // attach() is where map() creates the reconciler and binds event handlers
          if (isFragment && actualNodeRef.status === STATUS_FRAGMENT) {
            // CRITICAL: Enter the container's children first
            // The hydrating renderer starts at position [] (the container itself)
            // We need to advance to position [0], [1], etc. (inside the container)
            // Calling createElement('div') matches the container and enters its children
            renderer.createElement('div');

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

            actualNodeRef.attach(fragmentParentRef, null, hydratingApi);

            // Activate effects WHILE STILL IN HYDRATING MODE
            // This ensures children are hydrated, not created fresh
            activate();
          }

          // Success! Hydration complete
          // Switch renderer to fallback mode for future reactive updates
          renderer.switchToFallback();

          // Activate remaining queued effects (for element islands)
          // Fragment islands already activated above
          if (!isFragment) activate();

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
            // Create a regular API for client-side rendering
            const fallbackRenderer = createDOMRenderer();
            const fallbackApi = createAPI(
              createIslandsRenderer(fallbackRenderer, fallbackRenderer),
              signals
            );

            if (isFragment) {
              container.innerHTML = '';
              const fallbackComponentFn = Component(fallbackApi);
              const instance = mount(fallbackComponentFn(props));
              if (instance.element)
                container.appendChild(instance.element as Node);
            } else {
              // Remove island element, script tag, and mount fresh
              const parent = islandElement?.parentNode;
              if (islandElement) islandElement.remove();
              script.remove();
              const fallbackComponentFn = Component(fallbackApi);
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
          __islands?: Array<{ i: string; t: string; p: unknown }>;
        }
      ).__islands;

      if (!queuedIslands) return;
      queuedIslands.forEach(({ i, t, p }) => {
        const hydrateFn = (
          window as unknown as {
            __hydrate: (id: string, type: string, props: unknown) => void;
          }
        ).__hydrate;
        hydrateFn(i, t, p);
      });
    },
  };
}
