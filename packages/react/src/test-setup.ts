// Setup file for vitest
import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import React, { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { createSignalAPI, type FactoriesToAPI } from '@lattice/signals/api';
import { createDefaultContext } from '@lattice/signals/default-context';
import { createSignalFactory, type SignalInterface } from '@lattice/signals/signal';
import { createComputedFactory, type ComputedInterface } from '@lattice/signals/computed';
import { createEffectFactory, type EffectDisposer } from '@lattice/signals/effect';
import { createBatchFactory } from '@lattice/signals/batch';
import { createSubscribeFactory } from '@lattice/signals/subscribe';
import type { LatticeExtension } from '@lattice/lattice';
import type { Readable, ProducerNode } from '@lattice/signals/types';
import { SignalProvider } from './signals/context';

// Define the factories type for consistent usage
const testFactories = {
  signal: createSignalFactory as (ctx: unknown) => LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
  computed: createComputedFactory as (ctx: unknown) => LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>>,
  effect: createEffectFactory as (ctx: unknown) => LatticeExtension<'effect', (fn: () => void | (() => void)) => EffectDisposer>,
  batch: createBatchFactory as (ctx: unknown) => LatticeExtension<'batch', <T>(fn: () => T) => T>,
  subscribe: createSubscribeFactory as (ctx: unknown) => LatticeExtension<'subscribe', <T>(source: Readable<T> & ProducerNode, callback: (value: T) => void, options?: { skipEqualityCheck?: boolean }) => () => void>,
} as const;

// Type alias for the API created with our standard factories
type TestSignalAPI = FactoriesToAPI<typeof testFactories>;

// Create a test helper that wraps components with SignalProvider
export function renderWithSignals(ui: ReactElement): ReturnType<typeof render> {
  // Create a fresh signal API for each test
  const api = createSignalAPI(testFactories, createDefaultContext());

  return render(
    React.createElement(SignalProvider, { api, children: ui })
  );
}

// Also export api creation for tests that need direct access
export function createTestSignalAPI(): TestSignalAPI {
  return createSignalAPI(testFactories, createDefaultContext());
}

// Clean up after each test to prevent memory leaks
afterEach(() => {
  // React Testing Library automatically cleans up after each test
  // but we can add additional cleanup here if needed
});
