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
import { OnModule } from '@lattice/view/deps/addEventListener';
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
  BatchModule,
  // View
  ElModule,
  MapModule,
  MatchModule,
  // Helpers
  OnModule,
  MountModule
);

// Export primitives
export const { signal, computed, effect, batch, el, map, match, on, mount } =
  use;
export { use };
