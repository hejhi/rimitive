/**
 * ALGORITHM: Alien Signals-style Immediate Propagation
 * 
 * This module implements the propagation algorithm from Alien Signals,
 * which provides superior performance by:
 * 1. Immediate traversal when signals change (no root collection)
 * 2. Direct effect queuing during traversal (no intermediate scheduling)
 * 3. Inline stack-based DFS without abstraction overhead
 * 
 * The algorithm uses bit flags for state management and a manual stack
 * for iterative traversal, avoiding function call overhead.
 */

import { CONSTANTS } from '../constants';
import type { Edge, ScheduledNode } from '../types';
import type { SignalContext } from '../context';

const { NOTIFIED, DISPOSED, RUNNING } = CONSTANTS;

// Stack frame for iterative DFS
interface StackFrame {
  edge: Edge | undefined;
  prev: StackFrame | undefined;
}

/**
 * Propagate changes through the dependency graph starting from an edge.
 * This is called when a signal/computed value changes.
 * 
 * ALGORITHM:
 * 1. Traverse the graph depth-first using a manual stack
 * 2. Mark nodes as NOTIFIED to indicate they need updating
 * 3. Queue effects immediately when encountered
 * 4. Skip already notified/disposed/running nodes
 */
export function propagate(from: Edge | undefined, ctx: SignalContext): void {
  if (!from) return;
  
  let stack: StackFrame | undefined;
  let current = from;
  
  // Iterative DFS with manual stack management
  top: do {
    const target = current.target;
    const flags = target._flags;
    
    // Skip if already processed or in invalid state
    if (flags & (NOTIFIED | DISPOSED | RUNNING)) {
      // Move to next sibling
      if (current.nextTarget) {
        current = current.nextTarget;
        continue;
      }
      // Pop from stack
      while (stack) {
        const popped = stack.edge;
        stack = stack.prev;
        if (popped) {
          current = popped;
          continue top;
        }
      }
      break;
    }
    
    // Mark as notified
    target._flags |= NOTIFIED;
    
    // If it's an effect/subscription, queue it
    if ('_nextScheduled' in target) {
      const scheduled = target as ScheduledNode;
      // Use _nextScheduled as a queued flag - if undefined, not queued
      if (scheduled._nextScheduled === undefined) {
        scheduled._nextScheduled = scheduled; // Mark as queued
        ctx.queuedEffects[ctx.queuedEffectsLength++] = scheduled;
      }
    }
    
    // If target is also a producer (computed), traverse its dependents
    if ('_targets' in target && (target as any)._targets) {
      const childTargets = (target as any)._targets as Edge;
      
      // Push current sibling to stack if exists
      if (current.nextTarget) {
        stack = { edge: current.nextTarget, prev: stack };
      }
      
      // Continue with children
      current = childTargets;
      continue;
    }
    
    // Move to next sibling
    if (current.nextTarget) {
      current = current.nextTarget;
      continue;
    }
    
    // Pop from stack
    while (stack) {
      const popped = stack.edge;
      stack = stack.prev;
      if (popped) {
        current = popped;
        continue top;
      }
    }
    break;
  } while (true);
}

/**
 * Flush all queued effects.
 * Called at the end of a batch or immediately if not batched.
 */
export function flushEffects(ctx: SignalContext): void {
  while (ctx.notifyIndex < ctx.queuedEffectsLength) {
    const effect = ctx.queuedEffects[ctx.notifyIndex];
    ctx.queuedEffects[ctx.notifyIndex++] = undefined;
    if (effect) {
      effect._nextScheduled = undefined; // Clear queued flag
      effect._flush();
    }
  }
  ctx.notifyIndex = 0;
  ctx.queuedEffectsLength = 0;
}