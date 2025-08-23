import { createContext } from './context';
import { createDependencySweeper } from './helpers/dependency-sweeper';
import { createDependencyGraph } from './helpers/dependency-graph';
import { createWorkQueue } from './helpers/work-queue';
import { createGraphWalker } from './helpers/graph-walker';

/**
 * Creates the default extended context with all required services.
 * Users can use this as a starting point or create their own.
 */
export function createDefaultContext() {
  const baseCtx = createContext();
  const graph = createDependencyGraph();
  const sourceCleanup = createDependencySweeper(graph.removeEdge);
  const workQueue = createWorkQueue(baseCtx);
  const graphWalker = createGraphWalker();
  
  return {
    ...baseCtx,
    graph,
    sourceCleanup,
    workQueue,
    graphWalker,
  };
}
