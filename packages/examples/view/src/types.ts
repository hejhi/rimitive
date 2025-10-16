/**
 * Type definitions for the Lattice API with Signals + View
 *
 * Uses ExtensionsToContext to automatically derive the API type from extensions
 */

import type { ExtensionsToContext } from '@lattice/lattice';
import type { SignalFactory } from '@lattice/signals/signal';
import type { ComputedFactory } from '@lattice/signals/computed';
import type { EffectFactory } from '@lattice/signals/effect';
import type { ElFactory } from '@lattice/view/el';
import type { ElMapFactory } from '@lattice/view/elMap';
import type { ElementSpec, ElementRef } from '@lattice/view/types';

/**
 * Combined Lattice API with signals and view primitives
 * Automatically derived from the extension factories, with DOM-specific overrides
 */
export type LatticeViewAPI = Omit<
  ExtensionsToContext<[SignalFactory, ComputedFactory, EffectFactory, ElFactory, ElMapFactory]>,
  'el'
> & {
  // Override el() to return specific HTML element types for DOM renderer
  el: <Tag extends keyof HTMLElementTagNameMap>(spec: ElementSpec<Tag>) => ElementRef<HTMLElementTagNameMap[Tag]>;
};
