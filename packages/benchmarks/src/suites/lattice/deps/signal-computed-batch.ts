import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  BatchModule,
} from '@rimitive/signals/extend';

export const createSvc = () =>
  compose(SignalModule, ComputedModule, BatchModule);
