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
  flags: number; // Bit field containing state and properties
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

// ALGORITHM: Producer-Consumer Pattern
// The core of the reactivity system uses a bipartite graph with two node types:

// PRODUCERS: Nodes that other nodes depend on (signals, computed values)
// They maintain a list of consumers that depend on them
export interface ProducerNode extends ReactiveNode {
  value: unknown;
  dependents: Dependency | undefined; // Head of dependent list
  dependentsTail: Dependency | undefined; // Tail of dependent list
  lastChangedVersion: number; // Version when this node's value last changed
}

// CONSUMERS: Nodes that depend on other nodes (computed values, effects)
// They maintain a list of producers they depend on
export interface ConsumerNode extends ReactiveNode {
  dependencies: Dependency | undefined; // Head of dependency list
  dependencyTail: Dependency | undefined; // Current tracking position
  notify: (node: ConsumerNode) => void;
}

export interface DerivedNode extends ProducerNode, ConsumerNode {
  recompute(): boolean; // Execute the deferred work
  lastComputedVersion: number; // Tracking cycle version when node was last computed
}

// PATTERN: Deferred Execution Queue
// ScheduledNode represents consumers that batch their updates.
// Uses intrusive linked list for zero-allocation scheduling queue.
export interface ScheduledNode extends ConsumerNode {
  nextScheduled: ScheduledNode | undefined;  // Next node in scheduling queue (intrusive list)
  flush(): void;                  // Execute the deferred work
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
// 1. Producer's dependent list: prevDependent <-> dependency <-> nextDependent (all dependencies FROM same producer)
// 2. Consumer's dependency list: prevDependency <-> dependency <-> nextDependency (all dependencies TO same consumer)
//
// This allows efficient traversal in both directions:
// - Forward: "What depends on this producer?"
// - Backward: "What does this consumer depend on?"
export interface Dependency {
  producer: FromNode; // The producer (source of data)
  consumer: ToNode; // The consumer (depends on the producer)

  // Version tracking for dependency staleness
  // Each tracking cycle increments the global version, and dependencies
  // touched during tracking get the current version. Dependencies with
  // outdated versions are considered stale and can be pruned.
  version: number; // Tracking cycle version when this dependency was last used

  // Producer's dependent list navigation
  prevDependent: Dependency | undefined; // Previous in dependent list
  nextDependent: Dependency | undefined; // Next in dependent list

  // Consumer's dependency list navigation
  prevDependency: Dependency | undefined; // Previous in dependency list
  nextDependency: Dependency | undefined; // Next in dependency list
}


// Ensure module is not tree-shaken
export const __types = true;
