import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
} from '@rimitive/signals/extend';
import { ElModule } from '@rimitive/view/el';
import { MapModule } from '@rimitive/view/map';
import { createDOMAdapter } from '@rimitive/view/adapters/dom';
import { MountModule } from '@rimitive/view/deps/mount';

const adapter = createDOMAdapter();

export const svc = compose(
  SignalModule,
  ComputedModule,
  EffectModule,
  ElModule.with({ adapter }),
  MapModule.with({ adapter }),
  MountModule
);

export type Service = typeof svc;
