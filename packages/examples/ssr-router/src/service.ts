/**
 * SSR Router Service (Basic Sync)
 *
 * Service composition for basic SSR without async data loading.
 * Both server and client use this with their respective adapters.
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
import { createShadowModule } from '@rimitive/view/shadow';
import { OnModule } from '@rimitive/view/deps/addEventListener';
import { createRouterModule, type RouterOptions } from '@rimitive/router';
import type { Adapter, RefSpec } from '@rimitive/view/types';
import type { TreeConfig } from '@rimitive/view/adapter';
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
export type ServiceOptions = RouterOptions;

/**
 * Create a full service with router (no async data loading)
 *
 * @param adapter - DOM adapter (regular, server, or hydrating)
 * @param options - Optional config (initialPath for SSR)
 */
export function createService<TConfig extends TreeConfig>(
  adapter: Adapter<TConfig>,
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
    createShadowModule(adapter),
    OnModule,
    createRouterModule(routes, options)
  );
}

/**
 * Full service type - base + router methods + use helper
 */
export type Service = ReturnType<typeof createService>;
