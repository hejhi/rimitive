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
  _out: Edge | undefined;  // Head of output list
  _outTail: Edge | undefined;  // Tail of output list
  
  // LOCAL VERSION COUNTER (VALUE CHANGE TRACKING)
  // Incremented when THIS node's value changes.
  // Used to detect if specific dependencies have new values.
  // 
  // PURPOSE: Fine-grained change detection
  // - Stored in edge.fromVersion when dependencies are registered
  // - Compared against edge.fromVersion to detect if this dependency changed
  // 
  // NOT REDUNDANT WITH GENERATION: This tracks value changes,
  // while generation tracks which edges to keep/remove.
  _version: number;
}

// CONSUMERS: Nodes that depend on other nodes (computed values, effects)
// They maintain a list of producers they depend on
export interface ConsumerNode extends ReactiveNode {
  _in: Edge | undefined; // Head of input list
  _inTail: Edge | undefined; // Tail of input list

  _updateValue(): boolean; // Update this node's value (if it produces one)
  _flags: number; // Bit field containing STALE, RUNNING, DISPOSED, etc.
  // REMOVED: _gen field - using alien-signals' simpler tail-marking approach
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
export type FromNode = ProducerNode | (ProducerNode & ConsumerNode);
export type ToNode = ConsumerNode | (ProducerNode & ConsumerNode);

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

  // CACHED PRODUCER VERSION (STALENESS DETECTION)
  // Stores the producer's _version at the time this edge was created/validated.
  // Updated whenever the consumer reads from the producer.
  //
  // PURPOSE: O(1) staleness detection without pointer chasing
  // - If edge.fromVersion !== source._version, the producer has changed
  // - Avoids dereferencing source just to check if it changed
  //
  // NOT REDUNDANT: This is a cache of producer._version for performance
  fromVersion: number;

  // REMOVED: toGen field - using alien-signals' simpler tail-marking approach
  // Instead of tracking generation per edge, we'll mark tail at start of run
  // and prune everything after the tail at the end
}

// Ensure module is not tree-shaken
export const __types = true;
