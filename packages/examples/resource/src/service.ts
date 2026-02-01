import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
} from '@rimitive/signals/extend';
import { ResourceModule } from '@rimitive/resource';
import { createDOMAdapter } from '@rimitive/view/adapters/dom';
import { createElModule } from '@rimitive/view/el';
import { createMapModule } from '@rimitive/view/map';
import { createMatchModule } from '@rimitive/view/match';
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
  // Resource
  ResourceModule,
  // View
  ElModule,
  MapModule,
  MatchModule,
  // Helpers
  MountModule
);

export const { signal, computed, effect, resource, el, map, match, mount } =
  use;
