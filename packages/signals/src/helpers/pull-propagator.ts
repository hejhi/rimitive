import type { ToNode, Dependency } from '../types';
import { CONSTANTS } from '../constants';
import { createNodeState } from './node-state';

const {
  STATUS_CLEAN,
  STATUS_DIRTY,
  STATUS_CHECKING,
  STATUS_RECOMPUTING,
  HAS_CHANGED,
  MASK_STATUS_AWAITING,
  MASK_STATUS_PROCESSING,
} = CONSTANTS;

interface Stack<T> {
  value: T;
  prev: Stack<T> | undefined;
}

export interface PullPropagator {
  pullUpdates: (node: ToNode) => void;
}

const { getStatus, hasAnyOf, resetStatus, setStatus, recomputeNode } = createNodeState();

export function createPullPropagator(): PullPropagator {
  const pullUpdates = (node: ToNode): void => {
    const flags = node.flags;
    const status = getStatus(flags);
    const isDerivedNode = 'recompute' in node;
    
    if (
      status === STATUS_CLEAN ||
      status === STATUS_CHECKING ||
      status === STATUS_RECOMPUTING
    )
      return;
    
    if (status === STATUS_DIRTY) {
      if (isDerivedNode) recomputeNode(node, flags);
      else node.flags = resetStatus(flags);
      return;
    }
    
    node.flags = setStatus(flags, STATUS_CHECKING);

    let stack: Stack<Dependency> | undefined;
    let currentNode = node;
    let currentDependency = node.dependencies;
    let stale = false;

    for (;;) {
      while (currentDependency) {
        const source = currentDependency.producer;
        const sFlags = source.flags;
        
        if (hasAnyOf(sFlags, HAS_CHANGED)) {
          stale = true;
          break;
        }
        
        const nextDependency = currentDependency.nextDependency;
        const isComputed = 'recompute' in source;

        if (!isComputed) {
          currentDependency = nextDependency;
          continue;
        }

        if (hasAnyOf(sFlags, MASK_STATUS_AWAITING)) {
          if (hasAnyOf(sFlags, MASK_STATUS_PROCESSING)) {
            currentDependency = nextDependency;
            continue;
          }

          const sourceStatus = getStatus(sFlags);
          
          if (sourceStatus === STATUS_DIRTY) {
            stale = recomputeNode(source, sFlags);

            if (stale) break;

            currentDependency = nextDependency;
            continue;
          }

          source.flags = setStatus(sFlags, STATUS_CHECKING);

          if (nextDependency) {
            if (!stack) stack = { value: nextDependency, prev: undefined };
            else stack = { value: nextDependency, prev: stack };
          }

          currentNode = source;
        }

        currentDependency = nextDependency;
      }

      if (currentNode !== node && ('recompute' in currentNode)) {
        const currentFlags = currentNode.flags;
        const currentState = getStatus(currentFlags);
        
        if (currentState === STATUS_DIRTY || stale) {
          stale = recomputeNode(currentNode, currentFlags);
        } else {
          currentNode.flags = resetStatus(currentFlags);
          stale = false;
        }
      }
      
      if (!stack) break;
      
      currentDependency = stack.value;
      currentNode = currentDependency.consumer;
      stack = stack.prev;
    }

    const newFlags = node.flags;

    if (stale && isDerivedNode) recomputeNode(node, newFlags);
    else node.flags = resetStatus(newFlags);
  };

  return { pullUpdates };
}