import { createContext } from './context';
import { createWorkQueue } from './helpers/work-queue';
import { createGraphWalker } from './helpers/graph-walker';
import { createSourceCleanupHelpers } from './helpers/source-cleanup';
import { createDependencyHelpers } from './helpers/dependency-tracking';

/**
 * Creates the default extended context with all required services.
 * Users can use this as a starting point or create their own.
 */
export function createDefaultContext() {
  return {
    ...createContext(),
    workQueue: createWorkQueue(),
    graphWalker: createGraphWalker(),
    createSourceCleanupHelpers,
    createDependencyHelpers,
  };
}
