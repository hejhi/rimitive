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
import { createRouter } from '@lattice/router';
import type { RefSpec } from '@lattice/view/types';
import { routes } from './routes';

/**
 * Portable component - receives service, returns a function that returns RefSpec
 */
export type Portable<TProps = Record<string, never>> = (
  svc: Service
) => (props: TProps) => RefSpec<unknown>;

// Create the DOM adapter
const adapter = createDOMAdapter();

// Compose base service
const baseSvc = compose(
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
  createElModule(adapter),
  createMapModule(adapter),
  createMatchModule(adapter),
  MountModule,
  OnModule
)();

// Create router with route config
const router = createRouter(
  { signal: baseSvc.signal, computed: baseSvc.computed },
  routes,
  {
    initialPath:
      typeof window !== 'undefined'
        ? window.location.pathname + window.location.search + window.location.hash
        : '/',
  }
);

// Full service with router methods
export const svc = {
  ...baseSvc,
  ...router,
  // Ergonomic convenience for portable components
  use: <TProps>(fn: Portable<TProps>) => fn(svc),
};

/**
 * Full service type
 */
export type Service = typeof svc;
