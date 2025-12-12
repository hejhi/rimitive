import { compose } from '@rimitive/core';
import { SignalModule, ComputedModule } from '@rimitive/signals/extend';

export const createSvc = () => compose(SignalModule, ComputedModule);
