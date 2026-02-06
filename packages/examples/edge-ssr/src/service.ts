/**
 * Shared Service Factory
 *
 * Used by both the edge worker (SSR) and client (hydration).
 * The adapter is passed in - parse5 for server, DOM for client.
 */
import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
} from '@rimitive/signals/extend';
import { ElModule } from '@rimitive/view/el';
import { MatchModule } from '@rimitive/view/match';
import { ErrorBoundaryModule } from '@rimitive/view/error-boundary';
import { createLoaderModule } from '@rimitive/view/load';
import { LazyModule } from '@rimitive/view/lazy';
import { RouterModule, type RouterOptions } from '@rimitive/router';
import type { Adapter, TreeConfig } from '@rimitive/view/types';

import { routes } from './routes.js';

/**
 * Service options
 */
export type ServiceOptions = RouterOptions & {
  /** Hydration data from SSR */
  hydrationData?: Record<string, unknown>;
  /** Callback when a load() boundary resolves (for streaming SSR) */
  onResolve?: (id: string, data: unknown) => void;
};

/**
 * Create the app service with routing
 */
export function createService<TConfig extends TreeConfig>(
  adapter: Adapter<TConfig>,
  options?: ServiceOptions
) {
  return compose(
    SignalModule,
    ComputedModule,
    EffectModule,
    ElModule.with({ adapter }),
    MatchModule.with({ adapter }),
    ErrorBoundaryModule.with({ adapter }),
    LazyModule,
    createLoaderModule({
      initialData: options?.hydrationData,
      onResolve: options?.onResolve,
    }),
    RouterModule.with({ routes, ...options })
  );
}

export type Service = ReturnType<typeof createService>;
