/**
 * Hydrating API Wrapper
 *
 * Intercepts effect creation during hydration to prevent side effects.
 * Effects are queued and run after successful hydration completes.
 *
 * This keeps the signals/view packages pure - they don't need to know
 * about islands or hydration. All interception happens at this layer.
 */

/**
 * API with effect/scopedEffect methods that need interception
 */
export type EffectAPI = {
  effect?: (fn: () => void | (() => void)) => () => void;
  scopedEffect?: (fn: () => void | (() => void)) => () => void;
  [key: string]: unknown;
};

/**
 * Result of creating hydrating API wrapper
 */
export type HydrationAPIResult<T extends EffectAPI> = {
  /**
   * API with effects intercepted - use this during hydration
   */
  hydratingApi: T;

  /**
   * Activate all queued effects after successful hydration
   * @param apiForEffects - Optional API to use when creating effects (e.g., with regular renderer instead of hydrating renderer)
   */
  activate: (apiForEffects?: T) => void;
};

/**
 * Create a hydrating API wrapper
 *
 * Wraps an API to queue effects during hydration instead of running them.
 * After successful hydration, call activate() to run all queued effects.
 *
 * @param baseApi - Original API with effect/scopedEffect methods
 * @returns Wrapped API and activate function
 *
 * @example
 * ```ts
 * const signals = createSignalsApi();
 * const views = createViewHelpers(hydratingRenderer, signals);
 *
 * const { hydratingApi, activate } = createHydrationApi({ ...signals, ...views });
 *
 * // Use hydratingApi during hydration - effects are queued
 * const nodeRef = Counter(props).create(hydratingApi);
 *
 * // After successful hydration, run all effects
 * activate();
 * ```
 */
export function createHydrationApi<T extends EffectAPI>(
  baseApi: T
): HydrationAPIResult<T> {
  // Store effect functions and their types
  const pendingEffects: Array<{
    type: 'effect' | 'scopedEffect';
    fn: () => void | (() => void);
  }> = [];

  // Create wrapped API
  const hydratingApi: T = { ...baseApi };

  // Intercept effect if it exists
  if (baseApi.effect) {
    hydratingApi.effect = (fn: () => void | (() => void)) => {
      // Queue effect function for later
      pendingEffects.push({ type: 'effect', fn });
      // Return no-op cleanup
      return () => {};
    };
  }

  // Intercept scopedEffect if it exists
  if (baseApi.scopedEffect) {
    hydratingApi.scopedEffect = (fn: () => void | (() => void)) => {
      // Queue scoped effect function for later
      pendingEffects.push({ type: 'scopedEffect', fn });
      // Return no-op cleanup
      return () => {};
    };
  }

  // Activate function runs all queued effects
  // Can optionally use a different API (e.g., with regular renderer instead of hydrating renderer)
  const activate = (apiForEffects?: T) => {
    const api = apiForEffects || baseApi;

    pendingEffects.forEach(({ type, fn }) => {
      if (type === 'effect' && api.effect) {
        api.effect(fn);
      } else if (type === 'scopedEffect' && api.scopedEffect) {
        api.scopedEffect(fn);
      }
    });

    pendingEffects.length = 0;
  };

  return { hydratingApi, activate };
}
