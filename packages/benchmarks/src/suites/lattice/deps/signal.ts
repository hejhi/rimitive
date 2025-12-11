import { compose } from '@lattice/lattice';
import { SignalModule } from '@lattice/signals/extend';

export const createSvc = () => compose(SignalModule);
