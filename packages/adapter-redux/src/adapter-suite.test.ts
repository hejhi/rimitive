import { describe } from 'vitest';
import { createAdapterTestSuite } from '@lattice/core';
import { createReduxAdapter } from './index';

describe('Redux Adapter', () => {
  createAdapterTestSuite('Redux', createReduxAdapter);
});