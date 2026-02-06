import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
} from '@rimitive/signals/extend';
import { ResourceModule } from '@rimitive/resource';
import { createDOMAdapter } from '@rimitive/view/adapters/dom';
import { ElModule } from '@rimitive/view/el';
import { MapModule } from '@rimitive/view/map';
import { MatchModule } from '@rimitive/view/match';
import { MountModule } from '@rimitive/view/deps/mount';

// Create the DOM adapter
const adapter = createDOMAdapter();

// Compose everything together
const use = compose(
  // Signals
  SignalModule,
  ComputedModule,
  EffectModule,
  // Resource
  ResourceModule,
  // View
  ElModule.with({ adapter }),
  MapModule.with({ adapter }),
  MatchModule.with({ adapter }),
  // Helpers
  MountModule
);

export const { signal, computed, effect, resource, el, map, match, mount } =
  use;
