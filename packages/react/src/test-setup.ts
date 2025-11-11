// Setup file for vitest
import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { createElement, ReactElement } from 'react';
import { render } from '@testing-library/react';
import { SignalProvider } from './signals/context';
import { createApi } from '@lattice/signals/presets/core';

// Type alias for the API created with our standard components
type TestSignalAPI = ReturnType<typeof createApi>['api'];

// Create a test helper that wraps components with SignalProvider
export function renderWithSignals(ui: ReactElement): ReturnType<typeof render> {
  // Create a fresh signal API for each test
  const { api } = createApi();

  return render(createElement(SignalProvider, { api, children: ui }));
}

// Also export api creation for tests that need direct access
export function createTestSignalAPI(): TestSignalAPI {
  return createApi().api;
}

// Clean up after each test to prevent memory leaks
afterEach(() => {
  // React Testing Library automatically cleans up after each test
  // but we can add additional cleanup here if needed
});
