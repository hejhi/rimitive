import { createContext } from './context';
import { createDependencyGraph } from './helpers/dependency-graph';
import { createNodeScheduler } from './helpers/node-scheduler';

/**
 * Creates the default extended context with all required services.
 * Users can use this as a starting point or create their own.
 */
export function createDefaultContext() {
  const baseCtx = createContext();
  const graph = createDependencyGraph();
  const nodeScheduler = createNodeScheduler(baseCtx);
  
  return {
    ...baseCtx,
    graph,
    nodeScheduler,
  };
}
