import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
} from '@rimitive/signals/extend';
import { createDOMAdapter } from '@rimitive/view/adapters/dom';
import { ElModule } from '@rimitive/view/el';
import { MapModule } from '@rimitive/view/map';
import { MatchModule } from '@rimitive/view/match';
import { createShadowModule } from '@rimitive/view/shadow';
import { MountModule } from '@rimitive/view/deps/mount';

/**
 * Create a sandbox service with all required modules composed.
 *
 * This is the single composition point for the sandbox UI.
 * Each sandbox instance should create its own service to avoid shared state.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createSandboxService() {
  const adapter = createDOMAdapter();

  return compose(
    SignalModule,
    ComputedModule,
    EffectModule,
    BatchModule,
    ElModule.with({ adapter }),
    MapModule.with({ adapter }),
    MatchModule.with({ adapter }),
    createShadowModule(adapter),
    MountModule
  );
}

/**
 * The service type used throughout the sandbox.
 * Components should destructure what they need from this.
 */
export type SandboxService = ReturnType<typeof createSandboxService>;
