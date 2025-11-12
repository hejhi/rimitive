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
import { createApi, type InstantiableExtension } from '@lattice/lattice';

// Re-export types so they're part of the public API
export type { SubscribeFactory, SubscribeOpts, SubscribeProps, SubscribeFunction } from '../subscribe';
export type { SignalFactory, SignalOpts, SignalProps, SignalFunction } from '../signal';
export type { ComputedFactory, ComputedOpts, ComputedProps, ComputedFunction } from '../computed';
export type { EffectFactory, EffectOpts, EffectProps } from '../effect';
export type { BatchFactory, BatchOpts, BatchProps } from '../batch';
export type { InstantiableExtension } from '@lattice/lattice';

export const defaultExtensions = <T extends Record<string, InstantiableExtension>>(
  extensions?: T
) => ({
  signal: Signal(),
  computed: Computed(),
  effect: Effect(),
  batch: Batch(),
  subscribe: Subscribe(),
  ...extensions,
});

export const defaultHelpers = createPushPullSchedule;
export const createSignalsApi = () => createApi(defaultExtensions(), defaultHelpers());