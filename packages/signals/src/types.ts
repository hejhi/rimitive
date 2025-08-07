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
export interface Readable<T = unknown> {
  readonly value: T;  // Triggers dependency tracking when accessed
  peek(): T;          // Read without creating dependencies (optimization)
}

export interface Writable<T = unknown> extends Readable<T> {
  value: T;  // Writable allows assignment, triggering invalidation
}

// PATTERN: Resource Management
// Disposable pattern for explicit cleanup of subscriptions/effects
export interface Disposable {
  dispose(): void;
}

// ALGORITHM: Producer-Consumer Pattern
// The core of the reactivity system uses a bipartite graph with two node types:

// PRODUCERS: Nodes that other nodes depend on (signals, computed values)
// They maintain a list of consumers (targets) that depend on them
export interface ProducerNode extends ReactiveNode {
  _targets: Edge | undefined;  // Head of intrusive linked list of dependents
  
  // LOCAL VERSION COUNTER (VALUE CHANGE TRACKING)
  // Incremented when THIS node's value changes.
  // Used to detect if specific dependencies have new values.
  // 
  // PURPOSE: Fine-grained change detection
  // - Stored in edge.version when dependencies are registered
  // - Compared against edge.version to detect if this dependency changed
  // 
  // NOT REDUNDANT WITH GENERATION: This tracks value changes,
  // while generation tracks which edges to keep/remove.
  _version: number;
}

// CONSUMERS: Nodes that depend on other nodes (computed values, effects)
// They maintain a list of producers (sources) they depend on
export interface ConsumerNode extends ReactiveNode {
  _sources: Edge | undefined; // Head of intrusive linked list of dependencies

  // GENERATION COUNTER (STRUCTURAL CHANGE TRACKING)
  // Incremented before each recomputation to mark current "generation".
  // Used for dynamic dependency cleanup after conditional logic changes.
  //
  // PURPOSE: Identifies which edges were accessed in current computation
  // - Before recompute: increment generation
  // - During recompute: set edge.generation = this._generation for accessed deps
  // - After recompute: remove edges where edge.generation !== this._generation
  //
  // NOT REDUNDANT WITH VERSIONS: This tracks WHICH dependencies are active,
  // while versions track WHEN values change.
  _generation: number;

  _invalidate(): void; // Called when dependencies change
  _refresh(): boolean;
  _flags: number; // Bit field containing OUTDATED, RUNNING, DISPOSED, etc.
}

// PATTERN: Deferred Execution Queue
// ScheduledNode represents consumers that batch their updates.
// Uses intrusive linked list for zero-allocation scheduling queue.
export interface ScheduledNode extends ConsumerNode, Disposable {
  _nextScheduled?: ScheduledNode;  // Next node in scheduling queue (intrusive list)
  _flush(): void;                  // Execute the deferred work
}

type EdgeSourceNode = ProducerNode | (ProducerNode & ConsumerNode);
type EdgeTargetNode = ConsumerNode | (ProducerNode & ConsumerNode);

// ALGORITHM: Intrusive Doubly-Linked Graph Edges
// Edge represents a dependency relationship in the graph.
// Uses intrusive linked lists for memory efficiency:
// - No separate allocation for list nodes
// - Better cache locality
// - O(1) insertion/removal
//
// The edge is part of TWO doubly-linked lists simultaneously:
// 1. source.prevSource <-> edge <-> edge.nextSource (all edges from same source)
// 2. target.prevTarget <-> edge <-> edge.nextTarget (all edges to same target)
//
// This allows efficient traversal in both directions:
// - Forward: "What depends on this producer?"
// - Backward: "What does this consumer depend on?"
export interface Edge {
  source: EdgeSourceNode; // The dependency
  target: EdgeTargetNode | (EdgeTargetNode & Disposable) | (EdgeTargetNode & ScheduledNode); // The dependent

  // Intrusive list pointers for source's edge list
  prevSource?: Edge; // Previous edge from same source
  nextSource?: Edge; // Next edge from same source

  // Intrusive list pointers for target's edge list
  prevTarget?: Edge; // Previous edge to same target
  nextTarget?: Edge; // Next edge to same target

  // CACHED PRODUCER VERSION (STALENESS DETECTION)
  // Stores the producer's _version at the time this edge was created/validated.
  // Updated whenever the consumer reads from the producer.
  //
  // PURPOSE: O(1) staleness detection without pointer chasing
  // - If edge.version !== source._version, the producer has changed
  // - Avoids dereferencing source just to check if it changed
  //
  // NOT REDUNDANT: This is a cache of producer._version for performance
  version: number;

  // CACHED CONSUMER GENERATION (EDGE LIFECYCLE)
  // Stores the consumer's _generation when this edge was last accessed.
  // Updated whenever consumer reads from producer during recomputation.
  //
  // PURPOSE: Identifies stale edges for cleanup
  // - If edge.generation !== consumer._generation, edge wasn't used
  // - Enables automatic cleanup of conditional dependencies
  //
  // ORTHOGONAL TO VERSION: Version tracks value changes (temporal),
  // generation tracks edge usage (structural)
  generation: number;
}

// Ensure module is not tree-shaken
export const __types = true;

