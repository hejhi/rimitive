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
import { createPortalModule } from '@rimitive/view/portal';
import { MountModule } from '@rimitive/view/deps/mount';
import type { PackageSelection, ExecutionContext } from '../types';

/**
 * Create an execution context with Rimitive primitives based on package selection
 */
export function createExecutionContext(
  selection: PackageSelection
): ExecutionContext {
  // Build the context based on selection
  if (selection.view) {
    // Signals + View
    const adapter = createDOMAdapter();
    const svc = compose(
      SignalModule,
      ComputedModule,
      EffectModule,
      BatchModule,
      ElModule.with({ adapter }),
      MapModule.with({ adapter }),
      MatchModule.with({ adapter }),
      createPortalModule(adapter),
      MountModule
    );

    return {
      signal: svc.signal,
      computed: svc.computed,
      effect: svc.effect,
      batch: svc.batch,
      el: svc.el,
      map: svc.map,
      match: svc.match,
      portal: svc.portal,
    };
  }

  // Signals only
  const svc = compose(
    SignalModule,
    ComputedModule,
    EffectModule,
    BatchModule
  );

  return {
    signal: svc.signal,
    computed: svc.computed,
    effect: svc.effect,
    batch: svc.batch,
  };
}

/**
 * Get the default package selection
 */
export function getDefaultSelection(): PackageSelection {
  return {
    signals: true,
    view: true,
    router: false,
    resource: false,
  };
}

/**
 * Package metadata for UI display
 */
export const packageInfo: Record<
  keyof PackageSelection,
  { label: string; description: string }
> = {
  signals: {
    label: 'Signals',
    description: 'signal, computed, effect, batch',
  },
  view: {
    label: 'View',
    description: 'el, map, match, portal',
  },
  router: {
    label: 'Router',
    description: 'router, Link, useParams',
  },
  resource: {
    label: 'Resource',
    description: 'resource, createResource',
  },
};
