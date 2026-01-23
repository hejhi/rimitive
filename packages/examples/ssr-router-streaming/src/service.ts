/**
 * SSR Streaming Service
 *
 * Service composition for the app. Both server and client
 * use this with their respective adapters.
 *
 * For streaming SSR, the server passes onResolve to stream data chunks.
 */
import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
} from '@rimitive/signals/extend';
import { createElModule } from '@rimitive/view/el';
import { createMapModule } from '@rimitive/view/map';
import { createMatchModule } from '@rimitive/view/match';
import { OnModule } from '@rimitive/view/deps/addEventListener';
import { createLoaderModule } from '@rimitive/view/load';
import { createRouterModule, type RouterOptions } from '@rimitive/router';
import type { Adapter, RefSpec } from '@rimitive/view/types';
import type { DOMTreeConfig } from '@rimitive/view/adapters/dom';
import { routes } from './routes.js';

/**
 * Portable component - receives service, returns a function that returns RefSpec
 */
export type Portable<TProps = Record<string, never>> = (
  svc: Service
) => (props: TProps) => RefSpec<unknown>;

/**
 * Service options
 */
export type ServiceOptions = RouterOptions & {
  /** Data from SSR for hydration - passed to loader as initialData */
  hydrationData?: Record<string, unknown>;
  /** Callback when a load() boundary resolves (for streaming SSR) */
  onResolve?: (id: string, data: unknown) => void;
};

/**
 * Create a full service with router
 *
 * @param adapter - DOM adapter (regular, server, or hydrating)
 * @param options - Optional config (initialPath for SSR, hydrationData for hydration, onResolve for streaming)
 */
export function createService(
  adapter: Adapter<DOMTreeConfig>,
  options?: ServiceOptions
) {
  return compose(
    SignalModule,
    ComputedModule,
    EffectModule,
    BatchModule,
    createElModule(adapter),
    createMapModule(adapter),
    createMatchModule(adapter),
    createLoaderModule({
      initialData: options?.hydrationData,
      onResolve: options?.onResolve,
    }),
    createRouterModule(routes, options),
    OnModule
  );
}

/**
 * Full service type - base + router methods + use helper
 */
export type Service = ReturnType<typeof createService>;
