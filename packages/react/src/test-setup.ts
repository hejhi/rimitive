// Setup file for vitest
import '@testing-library/jest-dom';
import { afterEach } from 'vitest';

// Clean up after each test to prevent memory leaks
afterEach(() => {
  // React Testing Library automatically cleans up after each test
  // but we can add additional cleanup here if needed
});
