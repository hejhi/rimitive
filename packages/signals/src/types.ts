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
  (value: T): void; // Function call with argument for write
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
