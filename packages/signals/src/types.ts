/**
 * ALGORITHM: Reactive Dependency Graph
 * 
 * This file defines the core data structures for implementing a push-pull reactive system.
 * The system uses a directed acyclic graph (DAG) where:
 * - Nodes represent reactive values (signals, computed, effects)
 * - Edges represent dependencies between nodes
 * 
 * Key algorithmic insights:
 * 1. Push-Pull Algorithm: Combines eager notification (push) with lazy evaluation (pull)
 * 2. Version-based tracking: Avoids redundant computations
 * 3. Doubly-linked edges: Enables O(1) dependency updates
 * 4. Intrusive linked lists: Memory-efficient graph representation
 */

// Type Brand
// The __type field acts as a nominal type brand to distinguish reactive nodes
// from regular objects at runtime. This is a common TypeScript pattern for
// creating nominal types in a structural type system.
export interface ReactiveNode {
  readonly __type: string;
  status: number; // Current node status (CLEAN, PENDING, DIRTY, DISPOSED) + node type flags (PRODUCER, CONSUMER, SCHEDULED)
}

export interface Readable<T> {
  (): T;
}

export interface Writable<T> extends Readable<T> {
  (value: T): void;  // Function call with argument for write
}

// ALGORITHM: Producer-Consumer Pattern
// The core of the reactivity system uses a bipartite graph with two node types:

// PRODUCERS: Nodes that other nodes depend on (signals, computed values)
// They maintain a single list of all consumers (computeds and effects)
// Effects are identified by the SCHEDULED flag and filtered during traversal
export interface ProducerNode extends ReactiveNode {
  value: unknown;
  subscribers: Dependency | undefined; // Head of all subscribers (computeds + effects)
  subscribersTail: Dependency | undefined; // Tail of all subscribers
}

// CONSUMERS: Nodes that depend on other nodes (computed values, effects)
// They maintain a list of producers they depend on
export interface ConsumerNode extends ReactiveNode {
  dependencies: Dependency | undefined; // Head of dependency list
  dependencyTail: Dependency | undefined; // Current tracking position
  trackingVersion: number; // Global version when this node was last tracked
}

export interface DerivedNode<T = unknown> extends ProducerNode, ConsumerNode {
  compute: () => T; // The computation function
}

// Deferred Execution Queue
// ScheduledNode represents consumers that batch their updates.
// Uses intrusive linked list for zero-allocation scheduling queue.
export interface ScheduledNode extends ConsumerNode {
  nextScheduled: ScheduledNode | undefined; // Next node in scheduling queue (intrusive list)
  flush(): void; // Execute the deferred work
}

// Node types for edges
// Note: Computed nodes are both ProducerNode AND ConsumerNode
export type FromNode = ProducerNode | DerivedNode;
export type ToNode = ConsumerNode | DerivedNode | ScheduledNode;

// ALGORITHM: Intrusive Doubly-Linked Graph Dependencies
// Dependency represents a dependency relationship in the graph.
// Uses intrusive linked lists for memory efficiency:
// - No separate allocation for list nodes
// - Better cache locality
// - O(1) insertion/removal
//
// The dependency is part of TWO doubly-linked lists simultaneously:
// 1. Producer's dependent list: prevConsumer <-> dependency <-> nextConsumer (all dependencies FROM same producer)
// 2. Consumer's dependency list: prevDependency <-> dependency <-> nextDependency (all dependencies TO same consumer)
//
// This allows efficient traversal in both directions:
// - Forward: "What depends on this producer?"
// - Backward: "What does this consumer depend on?"
export interface Dependency {
  producer: FromNode; // The producer (source of data)
  consumer: ToNode; // The consumer (depends on the producer)

  // Producer's dependent list navigation
  prevConsumer: Dependency | undefined; // Previous in dependent list
  nextConsumer: Dependency | undefined; // Next in dependent list

  // Consumer's dependency list navigation
  prevDependency: Dependency | undefined; // Previous in dependency list
  nextDependency: Dependency | undefined; // Next in dependency list

  // Version tracking for efficient dependency pruning
  version: number; // Consumer's trackingVersion when this dependency was created
}


// Ensure module is not tree-shaken
export const __types = true;
