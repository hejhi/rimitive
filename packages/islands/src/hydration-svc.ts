/**
 * Hydrating Service Wrapper
 *
 * Intercepts effect creation during hydration to prevent side effects.
 * Effects are queued and run after successful hydration completes.
 *
 * This keeps the signals/view packages pure - they don't need to know
 * about islands or hydration. All interception happens at this layer.
 */

/**
 * Service with effect/scopedEffect methods that need interception
 */
export type EffectSvc = {
  effect?: (fn: () => void | (() => void)) => () => void;
  scopedEffect?: (fn: () => void | (() => void)) => () => void;
  [key: string]: unknown;
};

/**
 * Result of creating hydrating service wrapper
 */
export type HydrationSvcResult<T extends EffectSvc> = {
  /**
   * Service with effects intercepted - use this during hydration
   */
  hydratingSvc: T;

  /**
   * Activate all queued effects after successful hydration
   */
  activate: (effectsSvc?: T) => void;
};

/**
 * Create a hydrating service wrapper
 *
 * Wraps a service to queue effects during hydration instead of running them.
 * After successful hydration, call activate() to run all queued effects.
 */
export function createHydrationSvc<T extends EffectSvc>(
  baseSvc: T
): HydrationSvcResult<T> {
  // Store effect functions and their types
  const pendingEffects: Array<{
    type: 'effect' | 'scopedEffect';
    fn: () => void | (() => void);
  }> = [];

  const hydratingSvc: T = { ...baseSvc };

  // Intercept effect if it exists
  if (baseSvc.effect) {
    hydratingSvc.effect = (fn: () => void | (() => void)) => {
      // Queue effect function for later
      pendingEffects.push({ type: 'effect', fn });
      // Return no-op cleanup
      return () => {};
    };
  }

  // Intercept scopedEffect if it exists
  if (baseSvc.scopedEffect) {
    hydratingSvc.scopedEffect = (fn: () => void | (() => void)) => {
      // Queue scoped effect function for later
      pendingEffects.push({ type: 'scopedEffect', fn });
      // Return no-op cleanup
      return () => {};
    };
  }

  // Activate function runs all queued effects
  const activate = (svc?: T) => {
    const _svc = svc || baseSvc;

    pendingEffects.forEach(({ type, fn }) => {
      if (type === 'effect' && _svc.effect) {
        _svc.effect(fn);
      } else if (type === 'scopedEffect' && _svc.scopedEffect) {
        _svc.scopedEffect(fn);
      }
    });

    pendingEffects.length = 0;
  };

  return { hydratingSvc, activate };
}
