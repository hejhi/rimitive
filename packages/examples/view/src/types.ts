/**
 * Type definitions for the Lattice API with Signals + View
 *
 * Uses DOMViewAPI helper from @lattice/view/renderers/dom to automatically
 * derive the API type with proper HTML element typing
 */

import type { SignalFactory } from '@lattice/signals/signal';
import type { ComputedFactory } from '@lattice/signals/computed';
import type { EffectFactory } from '@lattice/signals/effect';
import type { DOMViewAPI } from '@lattice/view/renderers/dom';

/**
 * Combined Lattice API with signals and DOM view primitives
 * Automatically derived using DOMViewAPI helper - no manual overrides needed!
 */
export type LatticeViewAPI = DOMViewAPI<[SignalFactory, ComputedFactory, EffectFactory]>;
