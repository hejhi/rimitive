/**
 * SSR Service - Shared Composition
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
import type { Adapter } from '@lattice/view/types';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
import type { RefSpec } from '@lattice/view/types';

/**
 * Create a service with the given adapter
 */
export function createService(adapter: Adapter<DOMAdapterConfig>) {
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
 * Service type - derived from the composition
 */
export type Service = ReturnType<typeof createService>;

/**
 * Island factory - typed wrapper that fixes Service type
 */
export function island<TProps>(
  id: string,
  factory: (svc: Service) => (props: TProps) => RefSpec<unknown>
): IslandComponent<TProps> {
  return baseIsland(id, factory);
}
