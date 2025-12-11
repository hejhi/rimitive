/**
 * Router Example Service
 *
 * Service composition for the app.
 */
import { compose, merge } from '@lattice/lattice';
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
import { createRouter } from '@lattice/router';
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

// Compose base service - `use` is both callable AND has all services as properties
const use = compose(
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
  createElModule(adapter),
  createMapModule(adapter),
  createMatchModule(adapter),
  MountModule,
  OnModule
);

// Merge router into the service
export const svc = merge(
  use,
  createRouter({ signal: use.signal, computed: use.computed }, routes, {
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
