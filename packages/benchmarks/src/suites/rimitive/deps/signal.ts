import { compose } from '@rimitive/core';
import { SignalModule } from '@rimitive/signals/extend';

export const createSvc = () => compose(SignalModule);
