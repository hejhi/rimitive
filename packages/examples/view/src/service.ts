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
import { OnModule } from '@rimitive/view/deps/addEventListener';
import { MountModule } from '@rimitive/view/deps/mount';

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

export const { signal, computed, effect, batch, el, map, match, on, mount } =
  use;
export { use };
