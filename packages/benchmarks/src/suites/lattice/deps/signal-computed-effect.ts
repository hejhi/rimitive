import { compose } from '@lattice/lattice';
import { SignalModule, ComputedModule, EffectModule } from '@lattice/signals/extend';

export const createSvc = () => compose(SignalModule, ComputedModule, EffectModule)();
