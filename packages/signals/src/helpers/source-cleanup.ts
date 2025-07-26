// Source cleanup helpers - shared by computed.ts and effect.ts
import type { Consumer, Edge } from '../types';
import type { createNodePoolHelpers } from './node-pool';

export function createSourceCleanupHelpers({ removeFromTargets, releaseNode }: ReturnType<typeof createNodePoolHelpers>) {
  const disposeAllSources = (consumer: Consumer): void => {
    let node = consumer._sources;
    while (node) {
      const next = node.nextSource;
      removeFromTargets(node);
      releaseNode(node);
      node = next;
    }
    consumer._sources = undefined;
  };

  const cleanupSources = (consumer: Consumer): void => {
    let node = consumer._sources;
    let prev: Edge | undefined;

    while (node !== undefined) {
      const next = node.nextSource;

      if (node.version === -1) {
        // Remove this node from the linked list
        if (prev !== undefined) {
          prev.nextSource = next;
        } else {
          consumer._sources = next;
        }

        if (next !== undefined) (next.prevSource = prev);

        removeFromTargets(node);
        releaseNode(node);
      } else {
        prev = node;
      }

      node = next;
    }
  };

  return { disposeAllSources, cleanupSources };
}