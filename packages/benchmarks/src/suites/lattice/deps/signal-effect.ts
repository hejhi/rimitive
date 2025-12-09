import { compose } from '@lattice/lattice';
import { SignalModule, EffectModule } from '@lattice/signals/extend';

export const createSvc = () => compose(SignalModule, EffectModule)();
