import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
} from '@rimitive/signals/extend';

export const createSvc = () =>
  compose(SignalModule, ComputedModule, EffectModule);
