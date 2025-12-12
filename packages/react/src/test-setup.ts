// Setup file for vitest
import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { createElement, ReactElement } from 'react';
import { render } from '@testing-library/react';
import { SignalProvider, SignalSvc } from './signals/context';
import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
} from '@rimitive/signals/extend';

/** Create a signals service for testing */
function createTestSignals(): SignalSvc {
  const use = compose(SignalModule, ComputedModule, EffectModule, BatchModule);
  return {
    signal: use.signal,
    computed: use.computed,
    effect: use.effect,
    batch: use.batch,
    dispose: () => {},
  };
}

// Create a test helper that wraps components with SignalProvider
export function renderWithSignals(ui: ReactElement): ReturnType<typeof render> {
  // Create a fresh signal service for each test
  return render(
    createElement(SignalProvider, { svc: createTestSignals(), children: ui })
  );
}

// Also export svc creation for tests that need direct access
export function createTestSignalSvc(): SignalSvc {
  return createTestSignals();
}

// Clean up after each test to prevent memory leaks
afterEach(() => {
  // React Testing Library automatically cleans up after each test
  // but we can add additional cleanup here if needed
});
