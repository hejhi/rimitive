/**
 * Type definitions for the Lattice API with Signals + View
 *
 * Parameterize view factories with DOM type for proper HTML element typing
 */

import type { ExtensionsToContext } from '@lattice/lattice';
import type { SignalFactory } from '@lattice/signals/signal';
import type { ComputedFactory } from '@lattice/signals/computed';
import type { EffectFactory } from '@lattice/signals/effect';
import type { ElFactory } from '@lattice/view/el';
import type { MapFactory } from '@lattice/view/map';
import type { MatchFactory } from '@lattice/view/match';
import type { DOM } from '@lattice/view/renderers/dom';

/**
 * Combined Lattice API with signals and DOM view primitives
 * Parameterize view factories with DOM type - works for any renderer!
 */
export type LatticeViewAPI = ExtensionsToContext<
  [SignalFactory, ComputedFactory, EffectFactory, ElFactory<DOM>, MapFactory<DOM>, MatchFactory<DOM>]
>;
