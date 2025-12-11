/**
 * SSR Streaming Service
 *
 * Service composition for the app. Both server and client
 * use this with their respective adapters.
 *
 * For streaming SSR, the server passes onResolve to stream data chunks.
 */
import { compose } from '@lattice/lattice';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
} from '@lattice/signals/extend';
import { createElModule } from '@lattice/view/el';
import { createMapModule } from '@lattice/view/map';
import { createMatchModule } from '@lattice/view/match';
import { OnModule } from '@lattice/view/deps/addEventListener';
import { createLoaderModule } from '@lattice/view/load';
import { createRouterModule, type RouterOptions } from '@lattice/router';
import type { Adapter, RefSpec } from '@lattice/view/types';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
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
  /** Initial data for async boundaries (from SSR) */
  loaderData?: Record<string, unknown>;
  /** Callback when a load() boundary resolves (for streaming SSR) */
  onResolve?: (id: string, data: unknown) => void;
};

/**
 * Create a full service with router
 *
 * @param adapter - DOM adapter (regular, server, or hydrating)
 * @param options - Optional config (initialPath for SSR, loaderData for hydration, onResolve for streaming)
 */
export function createService(
  adapter: Adapter<DOMAdapterConfig>,
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
      initialData: options?.loaderData,
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
