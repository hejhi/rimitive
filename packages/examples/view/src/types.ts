/**
 * Type definitions for the Lattice API with Signals + View
 *
 * Parameterize view factories with DOM type for proper HTML element typing
 */

import type { ExtensionsToContext, LatticeExtension } from '@lattice/lattice';
import type { SignalFactory } from '@lattice/signals/signal';
import type { ComputedFactory } from '@lattice/signals/computed';
import type { EffectFactory } from '@lattice/signals/effect';
import type { ElFactory } from '@lattice/view/el';
import type { OnFactory } from '@lattice/view/on';
import type { RefSpec, FragmentRef } from '@lattice/view/types';
import type { DOM } from '@lattice/view/renderers/dom';

/**
 * Map factory type
 */
export type MapFactory = LatticeExtension<
  'map',
  <T>(
    items: () => T[],
    render: (itemSignal: import('@lattice/view/types').Reactive<T>) => RefSpec<DOM>,
    keyFn?: (item: T) => string | number
  ) => FragmentRef<DOM>
>;

/**
 * Combined Lattice API with signals and DOM view primitives
 * Parameterize view factories with DOM type - works for any renderer!
 */
export type LatticeViewAPI = ExtensionsToContext<
  [SignalFactory, ComputedFactory, EffectFactory, ElFactory<DOM>, OnFactory, MapFactory]
>;
