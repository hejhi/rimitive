/**
 * Router Example Service
 *
 * Service composition for the app.
 */
import { compose } from '@lattice/lattice';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
} from '@lattice/signals/extend';
import { createDOMAdapter } from '@lattice/view/adapters/dom';
import { createElModule } from '@lattice/view/el';
import { createMapModule } from '@lattice/view/map';
import { createMatchModule } from '@lattice/view/match';
import { MountModule } from '@lattice/view/deps/mount';
import { OnModule } from '@lattice/view/deps/addEventListener';
import { createRouterModule } from '@lattice/router';
import type { RefSpec } from '@lattice/view/types';
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
