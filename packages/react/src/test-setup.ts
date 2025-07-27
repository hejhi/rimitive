// Setup file for vitest
import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import React, { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { 
  createSignalAPI,
  createSignalFactory,
  createComputedFactory,
  createEffectFactory,
  createBatchFactory,
  createSubscribeFactory
} from '@lattice/signals';
import { SignalProvider } from './signals/context';

// Create a test helper that wraps components with SignalProvider
export function renderWithSignals(ui: ReactElement): ReturnType<typeof render> {
  // Create a fresh signal API for each test
  const api = createSignalAPI({
    signal: createSignalFactory,
    computed: createComputedFactory,
    effect: createEffectFactory,
    batch: createBatchFactory,
    subscribe: createSubscribeFactory,
  });

  return render(
    React.createElement(SignalProvider, { api, children: ui })
  );
}

// Also export api creation for tests that need direct access
export function createTestSignalAPI() {
  return createSignalAPI({
    signal: createSignalFactory,
    computed: createComputedFactory,
    effect: createEffectFactory,
    batch: createBatchFactory,
    subscribe: createSubscribeFactory,
  });
}

// Clean up after each test to prevent memory leaks
afterEach(() => {
  // React Testing Library automatically cleans up after each test
  // but we can add additional cleanup here if needed
});
