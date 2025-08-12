import { createContext } from './context';
import { createWorkQueue } from './helpers/work-queue';
import { createGraphWalker } from './helpers/graph-walker';
import { createDependencySweeper } from './helpers/dependency-sweeper';
import { createDependencyGraph } from './helpers/dependency-graph';
import { createPropagator } from './helpers/propagator';

/**
 * Creates the default extended context with all required services.
 * Users can use this as a starting point or create their own.
 */
export function createDefaultContext() {
  const baseCtx = createContext();
  const workQueue = createWorkQueue();
  const graphWalker = createGraphWalker();
  const propagator = createPropagator();
  const dependencies = createDependencyGraph();
  const sourceCleanup = createDependencySweeper(dependencies.unlinkFromProducer);
  return {
    ...baseCtx,
    workQueue,
    graphWalker,
    propagator,
    dependencies,
    sourceCleanup,
  };
}
