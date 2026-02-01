import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
} from '@rimitive/signals/extend';
import { createElModule } from '@rimitive/view/el';
import { OnModule } from '@rimitive/view/deps/addEventListener';
import { createDOMAdapter } from '@rimitive/view/adapters/dom';
import { MountModule } from '@rimitive/view/deps/mount';

const adapter = createDOMAdapter();

const svc = compose(
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
  createElModule(adapter),
  OnModule,
  MountModule
);

export const { signal, computed, effect, el, on, mount } = svc;
export type Service = typeof svc;
