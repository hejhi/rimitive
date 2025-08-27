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

// PATTERN: Type Brand
// The __type field acts as a nominal type brand to distinguish reactive nodes
// from regular objects at runtime. This is a common TypeScript pattern for
// creating nominal types in a structural type system.
export interface ReactiveNode {
  readonly __type: string;
}

// DESIGN: User-facing API contracts
// These interfaces define the public API without exposing internal graph mechanics.
// This separation allows changing the implementation without breaking the API.
// ALIEN-SIGNALS PATTERN: Function-based APIs for cleaner usage
export interface Readable<T = unknown> {
  (): T;             // Triggers dependency tracking when called
  peek(): T;         // Read without creating dependencies (optimization)
}

export interface Writable<T = unknown> extends Readable<T> {
  (value: T): void;  // Function call with argument for write
}

// PATTERN: Resource Management
// Disposable pattern for explicit cleanup of subscriptions/effects
export interface Disposable {
  dispose(): void;
}

// ALGORITHM: Producer-Consumer Pattern
// The core of the reactivity system uses a bipartite graph with two node types:

// PRODUCERS: Nodes that other nodes depend on (signals, computed values)
// They maintain a list of consumers that depend on them
export interface ProducerNode extends ReactiveNode {
  value: unknown;
  _out: Edge | undefined; // Head of output list
  _outTail: Edge | undefined; // Tail of output list
  _flags: number; // Bit field containing DIRTY flag and others
}

// CONSUMERS: Nodes that depend on other nodes (computed values, effects)
// They maintain a list of producers they depend on
export interface ConsumerNode extends ReactiveNode {
  _in: Edge | undefined; // Head of input list
  _inTail: Edge | undefined; // Tail of input list
  _flags: number; // Bit field containing DIRTY, RUNNING, DISPOSED, etc.
}

export interface DerivedNode extends ProducerNode, ConsumerNode {
  _recompute(): boolean; // Execute the deferred work
}

// PATTERN: Deferred Execution Queue
// ScheduledNode represents consumers that batch their updates.
// Uses intrusive linked list for zero-allocation scheduling queue.
export interface ScheduledNode extends ConsumerNode, Disposable {
  _nextScheduled: ScheduledNode | undefined;  // Next node in scheduling queue (intrusive list)
  _flush(): void;                  // Execute the deferred work
}

// Node types for edges
// Note: Computed nodes are both ProducerNode AND ConsumerNode
export type FromNode = ProducerNode | DerivedNode;
export type ToNode = ConsumerNode | DerivedNode | ScheduledNode;

// ALGORITHM: Intrusive Doubly-Linked Graph Edges
// Edge represents a dependency relationship in the graph.
// Uses intrusive linked lists for memory efficiency:
// - No separate allocation for list nodes
// - Better cache locality
// - O(1) insertion/removal
//
// The edge is part of TWO doubly-linked lists simultaneously:
// 1. Producer's output list: prevOut <-> edge <-> nextOut (all edges FROM same producer)
// 2. Consumer's input list: prevIn <-> edge <-> nextIn (all edges TO same consumer)
//
// This allows efficient traversal in both directions:
// - Forward: "What depends on this producer?"
// - Backward: "What does this consumer depend on?"
export interface Edge {
  from: FromNode; // The producer (source of data)
  to: ToNode; // The consumer (depends on the producer)

  // Producer's output list navigation
  prevOut: Edge | undefined; // Previous in output list
  nextOut: Edge | undefined; // Next in output list

  // Consumer's input list navigation
  prevIn: Edge | undefined; // Previous in input list
  nextIn: Edge | undefined; // Next in input list
}

// Ensure module is not tree-shaken
export const __types = true;
