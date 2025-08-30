import { createContext } from './context';
import { createDependencyGraph } from './helpers/dependency-graph';
import { createWorkQueue } from './helpers/work-queue';

/**
 * Creates the default extended context with all required services.
 * Users can use this as a starting point or create their own.
 */
export function createDefaultContext() {
  const baseCtx = createContext();
  const graph = createDependencyGraph(baseCtx);
  const workQueue = createWorkQueue(baseCtx);
  
  return {
    ...baseCtx,
    graph,
    workQueue,
  };
}
