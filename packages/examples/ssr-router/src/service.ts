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
import type { Adapter, Readable, RefSpec } from '@lattice/view/types';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
import type { MatchedRoute } from '@lattice/router';

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
 * Portable component - receives service, returns a function that returns RefSpec
 */
export type PortableComponent<TProps = Record<string, never>> = (
  svc: Service
) => (props: TProps) => RefSpec<unknown>;

/**
 * Full service type - base + router methods + use helper
 */
export type Service = BaseService & {
  navigate: (path: string) => void;
  currentPath: Readable<string>;
  matches: Readable<MatchedRoute[]>;
  /**
   * Bind a portable component to this service
   *
   * @example
   * ```ts
   * const Home = (svc: Service) => () => svc.el('div')('Hello');
   * // In AppLayout:
   * use(Home)({})  // returns RefSpec
   * ```
   */
  use: <TProps>(component: PortableComponent<TProps>) => (props: TProps) => RefSpec<unknown>;
};
