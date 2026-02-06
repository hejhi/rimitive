import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
} from '@rimitive/signals/extend';
import { ElModule } from '@rimitive/view/el';
import { MatchModule } from '@rimitive/view/match';
import { createDOMAdapter } from '@rimitive/view/adapters/dom';
import { MountModule } from '@rimitive/view/deps/mount';

const adapter = createDOMAdapter();

export const svc = compose(
  SignalModule,
  ComputedModule,
  EffectModule,
  ElModule.with({ adapter }),
  MatchModule.with({ adapter }),
  MountModule
);

export type Service = typeof svc;
