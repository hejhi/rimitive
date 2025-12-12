import { compose } from '@rimitive/core';
import { SignalModule, EffectModule } from '@rimitive/signals/extend';

export const createSvc = () => compose(SignalModule, EffectModule);
