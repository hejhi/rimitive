// Setup file for vitest
import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { createElement, ReactElement } from 'react';
import { render } from '@testing-library/react';
import { SignalProvider } from './signals/context';
import { createSignals, SignalsSvc } from '@lattice/signals/presets/core';

// Create a test helper that wraps components with SignalProvider
export function renderWithSignals(ui: ReactElement): ReturnType<typeof render> {
  // Create a fresh signal service for each test
  return render(
    createElement(SignalProvider, { svc: createSignals()(), children: ui })
  );
}

// Also export svc creation for tests that need direct access
export function createTestSignalSvc(): SignalsSvc {
  return createSignals()();
}

// Clean up after each test to prevent memory leaks
afterEach(() => {
  // React Testing Library automatically cleans up after each test
  // but we can add additional cleanup here if needed
});
