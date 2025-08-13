import { createContext } from './context';
import { createDependencySweeper } from './helpers/dependency-sweeper';
import { createDependencyGraph } from './helpers/dependency-graph';

/**
 * Creates the default extended context with all required services.
 * Users can use this as a starting point or create their own.
 */
export function createDefaultContext() {
  const baseCtx = createContext();
  const dependencies = createDependencyGraph();
  const sourceCleanup = createDependencySweeper(dependencies.unlinkFromProducer);
  return {
    ...baseCtx,
    dependencies,
    sourceCleanup,
  };
}
