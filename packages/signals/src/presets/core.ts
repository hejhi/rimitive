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
export type { SubscribeFactory, SubscribeFunction, SubscribeCallback } from '../subscribe';
export type { SignalFactory } from '../signal';
export type { ComputedFactory } from '../computed';
export type { EffectFactory } from '../effect';
export type { BatchFactory } from '../batch';

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
  return {
    extensions: createLatticeApi({ ...extensions, ...ext }, deps, opts),
    deps,
  };
}
