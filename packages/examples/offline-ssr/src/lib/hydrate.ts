/**
 * Hydrate - Inject pre-rendered HTML and hydrate with Rimitive
 *
 * Handles the hydration flow: inject HTML, create adapter, run component.
 * Copy this file into your project and modify as needed.
 */

import { compose } from '@rimitive/core';
import { ElModule } from '@rimitive/view/el';
import { MapModule } from '@rimitive/view/map';
import type { DOMTreeConfig } from '@rimitive/view/adapters/dom';

type ViewModules = ReturnType<
  typeof compose<
    [
      ReturnType<typeof ElModule.with<DOMTreeConfig>>,
      ReturnType<typeof MapModule.with<DOMTreeConfig>>,
    ]
  >
>;

export type HydrateRegion<TService> = {
  /** The service with hydration adapter (base service + el/map) */
  service: TService & ViewModules;
  /** Attach the hydrated tree to the container and switch to DOM mode */
  attach: () => void;
  /** Dispose and clear the region */
  dispose: () => void;
};

export type HydrateOptions<TService> = {
  /** Container element to attach hydrated content to */
  container: HTMLElement;
  /** Pre-rendered HTML string */
  html: string;
  /** Base service to extend with view modules (shared state like router, signals) */
  service: TService;
};

/**
 * Create a hydration region from pre-rendered HTML.
 *
 * 1. Parses HTML into a detached DOM tree (not yet in document)
 * 2. Creates hydration adapter for the detached tree
 * 3. Returns combined service (base + el/map with hydration adapter)
 *
 * The base service is extended with el/map modules using the hydration adapter.
 * This allows shared state (router, signals) to persist across page transitions
 * while each page gets its own view modules tied to its DOM.
 *
 * After running your component with the service, call attach() to:
 * - Insert the hydrated tree into the container
 * - Switch to normal DOM mode for subsequent updates
 *
 * This pattern separates parsing from DOM attachment, giving control over
 * when the DOM mutation happens (useful for view transitions).
 */
export async function createHydrateRegion<TService>(
  options: HydrateOptions<TService>
): Promise<HydrateRegion<TService>> {
  const { container, html, service } = options;

  // Lazy load SSR client to avoid bundling when not used
  const [
    { createDOMHydrationAdapter, createHydrationAdapter, withAsyncSupport },
    { createDOMAdapter },
  ] = await Promise.all([
    import('@rimitive/ssr/client'),
    import('@rimitive/view/adapters/dom'),
  ]);

  // Parse HTML into a detached tree (not yet in document)
  const template = document.createElement('template');
  template.innerHTML = html;
  const root = template.content.firstElementChild;

  if (!root) {
    throw new Error('No root element found in HTML');
  }

  // Create hydration adapter stack for the detached tree
  const hydrationAdapter = createDOMHydrationAdapter(root as HTMLElement);
  const clientAdapter = withAsyncSupport(createDOMAdapter());
  const combinedAdapter = createHydrationAdapter(
    hydrationAdapter,
    clientAdapter
  );

  // Create view modules with hydration adapter
  const viewModules = compose(
    ElModule.with({ adapter: combinedAdapter }),
    MapModule.with({ adapter: combinedAdapter })
  );

  // Combine base service with view modules
  return {
    service: { ...service, ...viewModules },
    attach: () => {
      // Insert hydrated tree into container and switch to DOM mode
      container.replaceChildren(root);
      combinedAdapter.switchToFallback();
    },
    dispose: () => {
      container.replaceChildren();
    },
  };
}

/**
 * Perform a view transition if supported.
 */
export async function withViewTransition(
  direction: 'forward' | 'back',
  action: () => void | Promise<void>
): Promise<void> {
  const supportsViewTransitions =
    typeof document !== 'undefined' && 'startViewTransition' in document;

  if (supportsViewTransitions) {
    document.documentElement.dataset.transition = direction;

    try {
      await document.startViewTransition(action).finished;
    } finally {
      delete document.documentElement.dataset.transition;
    }
  } else {
    await action();
  }
}

