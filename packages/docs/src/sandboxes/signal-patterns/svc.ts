import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
} from '@rimitive/signals/extend';
import { ElModule } from '@rimitive/view/el';
import { createDOMAdapter } from '@rimitive/view/adapters/dom';
import { MountModule } from '@rimitive/view/deps/mount';

const svc = compose(
  SignalModule,
  ComputedModule,
  EffectModule,
  ElModule.with({ adapter: createDOMAdapter() }),
  MountModule
);

export const { signal, computed, effect, el, mount } = svc;
export type Service = typeof svc;
