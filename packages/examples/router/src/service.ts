/**
 * Router Example Service
 *
 * Service composition for the app.
 */
import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
} from '@rimitive/signals/extend';
import { createDOMAdapter } from '@rimitive/view/adapters/dom';
import { createElModule } from '@rimitive/view/el';
import { createMapModule } from '@rimitive/view/map';
import { createMatchModule } from '@rimitive/view/match';
import { MountModule } from '@rimitive/view/deps/mount';
import { OnModule } from '@rimitive/view/deps/addEventListener';
import { createRouterModule } from '@rimitive/router';
import type { RefSpec } from '@rimitive/view/types';
import { routes } from './routes';

/**
 * Portable component - receives service, returns a function that returns RefSpec
 */
export type Portable<TProps = Record<string, never>> = (
  use: typeof svc
) => (props: TProps) => RefSpec<unknown>;

// Create the DOM adapter
const adapter = createDOMAdapter();

// Compose all modules including router - router is now a proper module
export const svc = compose(
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
  createElModule(adapter),
  createMapModule(adapter),
  createMatchModule(adapter),
  MountModule,
  OnModule,
  createRouterModule(routes, {
    initialPath:
      typeof window !== 'undefined'
        ? window.location.pathname +
          window.location.search +
          window.location.hash
        : '/',
  })
);

/**
 * Full service type
 */
export type Service = typeof svc;
