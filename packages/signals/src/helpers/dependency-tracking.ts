// Dependency tracking helpers - shared by signal.ts and computed.ts
import type { ProducerNode, ConsumerNode } from '../types';
import type { createNodePoolHelpers, EdgeCache } from './node-pool';

export function createDependencyHelpers({ linkNodes }: ReturnType<typeof createNodePoolHelpers>) {
  const addDependency = (
    source: ProducerNode & EdgeCache,
    target: ConsumerNode,
    version: number
  ): void => {
    let node = source._lastEdge;
    if (node !== undefined && node.target === target) {
      node.version = version;
      return;
    }
    node = target._sources;
    while (node) {
      if (node.source === source) {
        node.version = version;
        return;
      }
      node = node.nextSource;
    }

    linkNodes(source, target, version);
  };

  return { addDependency };
}