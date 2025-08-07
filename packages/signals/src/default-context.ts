import { createContext } from './context';
import { createWorkQueue } from './helpers/work-queue';
import type { ExtendedSignalContext } from './api';

/**
 * Creates the default extended context with all required services.
 * Users can use this as a starting point or create their own.
 */
export function createDefaultContext(): ExtendedSignalContext {
  return {
    ...createContext(),
    workQueue: createWorkQueue(),
  };
}