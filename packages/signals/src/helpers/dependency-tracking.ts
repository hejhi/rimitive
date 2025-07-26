// Dependency tracking helpers - shared by signal.ts and computed.ts
import type { Producer, Consumer } from '../types';
import type { createNodePoolHelpers } from './node-pool';

export function createDependencyHelpers(pool: ReturnType<typeof createNodePoolHelpers>) {
  const tryReuseNode = (source: Producer, target: Consumer, version: number): boolean => {
    const node = source._node;
    if (node !== undefined && node.target === target) {
      node.version = version;
      return true;
    }
    return false;
  };

  const findExistingNode = (source: Producer, target: Consumer, version: number): boolean => {
    let node = target._sources;
    while (node) {
      if (node.source === source) {
        node.version = version;
        return true;
      }
      node = node.nextSource;
    }
    return false;
  };

  const addDependency = (source: Producer, target: Consumer, version: number): void => {
    if (tryReuseNode(source, target, version)) return;
    if (findExistingNode(source, target, version)) return;
    pool.linkNodes(source, target, version);
  };

  return { addDependency };
}