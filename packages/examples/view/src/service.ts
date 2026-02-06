import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
} from '@rimitive/signals/extend';
import { createDOMAdapter } from '@rimitive/view/adapters/dom';
import { ElModule } from '@rimitive/view/el';
import { MapModule } from '@rimitive/view/map';
import { MatchModule } from '@rimitive/view/match';
import { OnModule } from '@rimitive/view/deps/addEventListener';
import { MountModule } from '@rimitive/view/deps/mount';

// Create the DOM adapter
const adapter = createDOMAdapter();

// Compose everything together
const use = compose(
  // Signals
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
  // View
  ElModule.with({ adapter }),
  MapModule.with({ adapter }),
  MatchModule.with({ adapter }),
  // Helpers
  OnModule,
  MountModule
);

export const { signal, computed, effect, batch, el, map, match, on, mount } =
  use;
export { use };
