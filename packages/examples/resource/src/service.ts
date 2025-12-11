import { compose } from '@lattice/lattice';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
} from '@lattice/signals/extend';
import { ResourceModule } from '@lattice/resource';
import { createDOMAdapter } from '@lattice/view/adapters/dom';
import { createElModule } from '@lattice/view/el';
import { createMapModule } from '@lattice/view/map';
import { createMatchModule } from '@lattice/view/match';
import { MountModule } from '@lattice/view/deps/mount';

// Create the DOM adapter
const adapter = createDOMAdapter();

// Create adapter-bound view modules
const ElModule = createElModule(adapter);
const MapModule = createMapModule(adapter);
const MatchModule = createMatchModule(adapter);

// Compose everything together
const use = compose(
  // Signals
  SignalModule,
  ComputedModule,
  EffectModule,
  // Resource
  ResourceModule,
  // View
  ElModule,
  MapModule,
  MatchModule,
  // Helpers
  MountModule
);

// Export primitives
export const { signal, computed, effect, resource, el, map, match, mount } =
  use;
