/**
 * SSR Router Service
 *
 * Service composition for the app. Both server and client
 * use this with their respective adapters.
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
import { createLoader } from '@lattice/view/load';
import { createRouter, type RouterOptions } from '@lattice/router';
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
};

/**
 * Create a full service with router
 *
 * @param adapter - DOM adapter (regular, server, or hydrating)
 * @param options - Optional config (initialPath for SSR, loaderData for hydration)
 */
export function createService(
  adapter: Adapter<DOMAdapterConfig>,
  options?: ServiceOptions
) {
  const baseSvc = compose(
    SignalModule,
    ComputedModule,
    EffectModule,
    BatchModule,
    createElModule(adapter),
    createMapModule(adapter),
    createMatchModule(adapter),
    OnModule
  );

  // Create loader with optional initial data for hydration
  const loader = createLoader({
    signal: baseSvc.signal,
    initialData: options?.loaderData,
  });

  const router = createRouter(
    { signal: baseSvc.signal, computed: baseSvc.computed },
    routes,
    options
  );

  const service = {
    ...baseSvc,
    ...router,
    // Loader API
    load: loader.load,
    getLoaderData: loader.getData,
    // Ergonomic convenience for portable components
    use: <TProps>(fn: Portable<TProps>) => fn(service),
  };

  return service;
}

/**
 * Full service type - base + router methods + use helper
 */
export type Service = ReturnType<typeof createService>;
