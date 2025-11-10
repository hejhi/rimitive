/**
 * Core Signals Preset
 * Pre-configured bundle of signal primitives with all necessary helpers wired up.
 * This eliminates the boilerplate of manually creating and wiring helpers.
 */

import { Signal } from '../signal';
import { Computed } from '../computed';
import { Effect } from '../effect';
import { Batch } from '../batch';
import { Subscribe } from '../subscribe';
import { createPushPullSchedule } from '../helpers';
import {
  createApi as createLatticeApi,
  CreateContextOptions,
} from '@lattice/lattice';

// Re-export types so they're part of the public API
export type { SubscribeFactory, SubscribeOpts, SubscribeProps, SubscribeFunction } from '../subscribe';
export type { SignalFactory, SignalOpts, SignalProps } from '../signal';
export type { ComputedFactory, ComputedOpts, ComputedProps, ComputedFunction } from '../computed';
export type { EffectFactory, EffectOpts, EffectProps } from '../effect';
export type { BatchFactory, BatchOpts, BatchProps } from '../batch';

export const extensions = {
  signal: Signal(),
  computed: Computed(),
  effect: Effect(),
  batch: Batch(),
  subscribe: Subscribe(),
};

export function createApi(
  ext = extensions,
  deps = createPushPullSchedule(),
  opts?: CreateContextOptions
) {
  const allExtensions = { ...extensions, ...ext };
  return {
    api: createLatticeApi(allExtensions, deps, opts),
    deps,
  };
}
