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
export interface EffectAPI {
  effect?: (fn: () => void | (() => void)) => () => void;
  scopedEffect?: (fn: () => void | (() => void)) => () => void;
  [key: string]: unknown;
}

/**
 * Result of creating hydrating API wrapper
 */
export interface HydratingAPIResult<T extends EffectAPI> {
  /**
   * API with effects intercepted - use this during hydration
   */
  hydratingApi: T;

  /**
   * Activate all queued effects after successful hydration
   */
  activate: () => void;
}

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
 * const { hydratingApi, activate } = createHydratingApi({ ...signals, ...views });
 *
 * // Use hydratingApi during hydration - effects are queued
 * const nodeRef = Counter(props).create(hydratingApi);
 *
 * // After successful hydration, run all effects
 * activate();
 * ```
 */
export function createHydratingApi<T extends EffectAPI>(
  baseApi: T
): HydratingAPIResult<T> {
  const pendingEffects: Array<() => () => void> = [];

  // Create wrapped API
  const hydratingApi: T = {
    ...baseApi,
  };

  // Intercept effect if it exists
  if (baseApi.effect) {
    hydratingApi.effect = (fn: () => void | (() => void)) => {
      // Queue effect creation for later
      pendingEffects.push(() => baseApi.effect!(fn));
      // Return no-op cleanup
      return () => {};
    };
  }

  // Intercept scopedEffect if it exists
  if (baseApi.scopedEffect) {
    hydratingApi.scopedEffect = (fn: () => void | (() => void)) => {
      // Queue scoped effect creation for later
      pendingEffects.push(() => baseApi.scopedEffect!(fn));
      // Return no-op cleanup
      return () => {};
    };
  }

  // Activate function runs all queued effects
  const activate = () => {
    pendingEffects.forEach((createEffect) => createEffect());
    pendingEffects.length = 0;
  };

  return {
    hydratingApi,
    activate,
  };
}
