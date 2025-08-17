/**
 * ALGORITHM: Bidirectional Dependency Graph Management
 * 
 * This module implements the core graph algorithms that power the reactive system.
 * The key insight is using a bidirectional graph with intrusive linked lists:
 * 
 * INSPIRATION:
 * - Glimmer's reference system (version tracking)
 * - Linux kernel's intrusive lists (memory efficiency)  
 * - V8's inline caches (edge caching)
 * - Database query planners (dependency analysis)
 */
import { CONSTANTS } from '../constants';
import type { ProducerNode, ConsumerNode, Edge, ToNode } from '../types';

// OPTIMIZATION: Edge Caching
// Producers cache their last accessed edge to avoid linked list traversal
// This optimization is based on the observation that the same consumer
// often accesses the same producer multiple times in succession
export type TrackedProducer = ProducerNode;

const { TRACKING, INVALIDATED, STALE, PENDING } = CONSTANTS;

export interface DependencyGraph {
  connect: (producer: TrackedProducer | (TrackedProducer & ConsumerNode), consumer: ConsumerNode, producerVersion: number) => Edge;
  ensureLink: (producer: TrackedProducer, consumer: ConsumerNode, producerVersion: number) => void;
  unlinkFromProducer: (edge: Edge) => void;
  refreshConsumers: (consumer: ConsumerNode) => boolean;
}

// Stack frame type - follows Alien's pattern, never mutates Edge
interface StackFrame {
  edge: Edge;
  next: Edge | undefined;
  to: ToNode;
  stale: boolean;
  prev: StackFrame | undefined;
}

export function createDependencyGraph(): DependencyGraph {
   // ALGORITHM: Edge Creation and Insertion
   // Creates a new edge between producer and consumer, inserting at head of sources
   // and appending to tail of targets for correct effect execution order
   const connect = (
     producer: TrackedProducer | (TrackedProducer & ConsumerNode),
     consumer: ConsumerNode,
     producerVersion: number
   ): Edge => {
     // Get current heads and tails
     const nextIn = consumer._in; // Consumer's current first dependency
     const prevOut = producer._outTail; // Producer's current last dependent
     
     // ALGORITHM: Doubly-Linked List Node Creation
     // Create new edge that will be head of sources, tail of targets
     const newNode: Edge = {
       from: producer,
       to: consumer,
       fromVersion: producerVersion, // Store producer's version at time of edge creation
       toGen: consumer._gen, // Tag with current generation
       prevIn: undefined, // Will be head of sources, so no previous
       prevOut, // Link to current tail of producer's targets
       nextIn, // Link to old head of consumer's sources
       nextOut: undefined, // Will be new tail of targets, so no next
     };

     // Update source list (prepend to consumer's sources)
     if (nextIn) nextIn.prevIn = newNode;
     consumer._in = newNode; // Consumer now depends on this edge first
     
     // FLAG: Computed nodes can be both producers AND consumers
     // When a computed has consumers, we set the TRACKING flag to indicate
     // it's part of an active dependency chain and should update when read
     if ('_flags' in producer) producer._flags |= TRACKING;
     
     // Append to target list (preserve execution order)
     if (prevOut) {
       prevOut.nextOut = newNode;
     } else {
       producer._out = newNode; // First target
     }
     producer._outTail = newNode; // Update tail pointer
     
     // OPTIMIZATION: Update tail pointer for O(1) access to recent dependencies
     if (!consumer._inTail) {
       consumer._inTail = newNode;
     }

     return newNode;
   };
  
  // ALGORITHM: Dependency Registration with Deduplication
  // This is called during signal/computed reads to establish dependencies
  // It either updates an existing edge or creates a new one
  const ensureLink = (
    producer: TrackedProducer,
    consumer: ConsumerNode,
    producerVersion: number
  ): void => {
    // OPTIMIZATION: Check consumer's tail pointer (last accessed dependency)
    // This handles sequential access patterns efficiently
    const tail = consumer._inTail;
    if (tail && tail.from === producer) {
      // Found at tail - update and cache
      tail.fromVersion = producerVersion;
      tail.toGen = consumer._gen;
      // Tail is already correct, no need to update
      return;
    }
    
    // Check the second-to-last edge (common for alternating patterns)
    if (tail?.prevIn && tail.prevIn.from === producer) {
      const edge = tail.prevIn;
      edge.fromVersion = producerVersion;
      edge.toGen = consumer._gen;
      consumer._inTail = edge; // Move to tail for next access
      return;
    }
    
    // FALLBACK: Linear search from head
    // Look for existing edge (active or recyclable)
    let node = consumer._in;
    while (node) {
      if (node.from === producer) {
        // Found edge - either active (version >= 0) or recyclable (version = -1)
        // Reactivate/update it
        node.fromVersion = producerVersion;
        node.toGen = consumer._gen;
        // Move to tail for better locality
        consumer._inTail = node;
        return;
      }
      node = node.nextIn;
    }

    // No existing edge found - create new one
    connect(producer, consumer, producerVersion);
  };

  // ALGORITHM: Edge Removal from Producer's Target List  
  // Removes an edge from the producer's linked list of consumers
  // This is O(1) because we have direct pointers to neighbors
  const unlinkFromProducer = ({ from, prevOut, nextOut }: Edge): void => {
    // Remove from doubly-linked list
    if (prevOut) {
      // Middle or end of list - update previous node
      prevOut.nextOut = nextOut;
    } else {
      // Head of list - update producer's head pointer
      from._out = nextOut;

      // OPTIMIZATION: Only check TRACKING flag if this was the last consumer
      // Combine the checks to reduce branches
      if (!nextOut && '_flags' in from) from._flags &= ~TRACKING;
    }
    
    if (nextOut) {
      nextOut.prevOut = prevOut;
    } else {
      // This was the tail - update tail pointer
      from._outTail = prevOut;
    }
  };

  /**
   * ALGORITHM: Zero-Allocation Dependency Checking
   * Streamlined single-pass traversal with intrusive stack
   */
  const refreshConsumers = (toNode: ToNode): boolean => {
    const flags = toNode._flags;
    if (!(flags & INVALIDATED)) return false;
    if (flags & STALE) return true;

    let node = toNode;
    let edge = toNode._in;
    let stack: StackFrame | undefined;
    let dirty = false;

    while (true) {
      // Skip recycled edges
      while (edge && edge.fromVersion === -1) {
        edge = edge.nextIn;
      }

      if (edge) {
        const source = edge.from;
        const oldVersion = edge.fromVersion;
        const newVersion = source._version;
        edge.fromVersion = newVersion;
        const changed = oldVersion !== newVersion;
        
        // Branch on node type for better prediction
        if ('_in' in source) {
          // Computed node
          const sourceFlags = source._flags;
          
          if (sourceFlags & STALE) {
            dirty = true;
          } else if (changed || (sourceFlags & PENDING)) {
            if (sourceFlags & INVALIDATED) {
              // Push to stack
              stack = { edge, next: edge.nextIn, to: node, stale: dirty, prev: stack };
              node = source;
              edge = source._in;
              dirty = false;
              continue;
            }
            dirty = true;
          }
        } else {
          // Signal node - just version check
          dirty = dirty || changed;
        }
        
        edge = edge.nextIn;
        continue;
      }

      // Clear INVALIDATED if clean
      if (!dirty) node._flags &= ~INVALIDATED;
      
      if (!stack) break;

      // Stack unwind
      const frame: StackFrame = stack;
      if (dirty) {
        node._updateValue();
        if ('_version' in node) {
          dirty = frame.edge.fromVersion !== node._version;
          frame.edge.fromVersion = node._version;
        }
      }

      edge = frame.next;
      node = frame.to;
      stack = frame.prev;
      dirty = frame.stale || dirty;
    }

    // Single flag operation
    toNode._flags = dirty ? (flags | STALE) & ~INVALIDATED : flags & ~INVALIDATED;
    return dirty;
  };

  return {
    ensureLink,
    unlinkFromProducer,
    connect,
    refreshConsumers,
  };
}
