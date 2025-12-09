import { compose } from '@lattice/lattice';
import { SignalModule, ComputedModule, BatchModule } from '@lattice/signals/extend';

export const createSvc = () => compose(SignalModule, ComputedModule, BatchModule)();
