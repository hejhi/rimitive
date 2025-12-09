/**
 * SSR Router Service - Shared Composition
 *
 * Single source of truth for service composition.
 * Both server and client use this with their respective adapters.
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
import { island as baseIsland, type IslandComponent } from '@lattice/islands';
import {
  connect as baseConnect,
  type ConnectedSvc,
  type RouteContext,
} from '@lattice/router';
import type { Adapter, Readable, RefSpec } from '@lattice/view/types';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';

/**
 * Create a base service with the given adapter
 */
export function createBaseService(adapter: Adapter<DOMAdapterConfig>) {
  const use = compose(
    SignalModule,
    ComputedModule,
    EffectModule,
    BatchModule,
    createElModule(adapter),
    createMapModule(adapter),
    createMatchModule(adapter),
    OnModule
  );
  return use();
}

/**
 * Base service type - from composition (without router)
 */
export type BaseService = ReturnType<typeof createBaseService>;

/**
 * Full service type - base + router methods
 *
 * Islands use `currentPath` to derive URL-based state reactively.
 * No separate "context" mechanism needed - currentPath is just
 * another signal on the service.
 */
export type Service = BaseService & {
  navigate: (path: string) => void;
  currentPath: Readable<string>;
};

/**
 * Island factory - typed wrapper that fixes Service type
 *
 * Islands receive the service which includes currentPath for URL-based reactivity.
 */
export function island<TProps>(
  id: string,
  factory: (svc: Service) => (props: TProps) => RefSpec<unknown>
): IslandComponent<TProps> {
  return baseIsland(id, factory);
}

/**
 * Connected service type for this app
 */
export type AppConnectedSvc = ConnectedSvc<DOMAdapterConfig>;

/**
 * Route context type for this app
 */
export type AppRouteContext = RouteContext<DOMAdapterConfig>;

/**
 * Typed connect for this app
 *
 * Connected components receive two arguments:
 * - svc: The service (el, signal, computed, navigate, currentPath, etc.)
 * - routeCtx: Route-specific data (children, params)
 *
 * This keeps the service "owned" by you while making route data explicit.
 *
 * @example
 * ```typescript
 * const HomePage = connect((svc, { children }) => () => {
 *   const { el, navigate } = svc;
 *   return el('div')(
 *     el('h1')('Welcome'),
 *     ...children ?? []
 *   );
 * });
 * ```
 */
export function connect<TUserProps = Record<string, unknown>>(
  wrapper: (
    svc: AppConnectedSvc,
    routeCtx: AppRouteContext
  ) => (userProps: TUserProps) => RefSpec<DOMAdapterConfig['baseElement']>
): (
  ...args: [TUserProps?]
) => (routeContext: RouteContext<DOMAdapterConfig>) => RefSpec<DOMAdapterConfig['baseElement']> {
  return baseConnect<DOMAdapterConfig, DOMAdapterConfig['baseElement'], TUserProps>(wrapper);
}
