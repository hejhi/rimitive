/**
 * Base type for all reactive graph nodes.
 *
 * The `__type` field acts as a nominal type brand to distinguish reactive nodes
 * from regular objects at runtime. This is a common TypeScript pattern for
 * creating nominal types in a structural type system.
 *
 * @internal Used by the reactivity implementation, not part of public API.
 */
export type ReactiveNode = {
  /** Type brand for runtime node identification */
  readonly __type: string;
  /** Bitfield: node status (CLEAN, PENDING, DIRTY, DISPOSED) + type flags (PRODUCER, CONSUMER, SCHEDULED) */
  status: number;
};

/**
 * A readable reactive value (signal or computed).
 *
 * Call with no arguments to read the current value.
 * Reading inside a reactive context (effect, computed) creates a dependency.
 *
 * @example
 * ```ts
 * const count: Readable<number> = computed(() => items().length);
 *
 * // Read the value
 * console.log(count()); // 5
 *
 * // Reading inside effect creates dependency
 * effect(() => {
 *   console.log(count()); // Tracks count as dependency
 * });
 * ```
 */
export type Readable<T> = { (): T };

/**
 * A writable reactive value (signal).
 *
 * Call with no arguments to read, call with a value to write.
 * Writing notifies all subscribers.
 *
 * @example
 * ```ts
 * const name: Writable<string> = signal('Alice');
 *
 * // Read
 * console.log(name()); // 'Alice'
 *
 * // Write
 * name('Bob');
 * console.log(name()); // 'Bob'
 * ```
 */
export type Writable<T> = Readable<T> & { (value: T): void };

/**
 * Union type for any reactive value (readable or writable).
 *
 * Use this when a function accepts either signals or computeds.
 *
 * @example
 * ```ts
 * // Function that works with any reactive value
 * function double(source: Reactive<number>): Readable<number> {
 *   return computed(() => source() * 2);
 * }
 *
 * const count = signal(5);
 * const doubled = double(count); // Works with signal
 *
 * const derived = computed(() => count() + 1);
 * const derivedDoubled = double(derived); // Works with computed too
 * ```
 */
export type Reactive<T> = Readable<T> | Writable<T>;

// ============================================================================
// ALGORITHM: Producer-Consumer Pattern
// The core of the reactivity system uses a bipartite graph with two node types.
// These types are internal implementation details.
// ============================================================================

/**
 * Producer node - a node that other nodes can depend on.
 *
 * Signals and computeds are producers. They maintain a linked list
 * of all consumers (computeds and effects) that depend on them.
 *
 * @internal Implementation detail, not part of public API.
 */
export type ProducerNode = ReactiveNode & {
  /** Current value of this producer */
  value: unknown;
  /** Head of subscriber linked list */
  subscribers: Dependency | undefined;
  /** Tail of subscriber linked list (for O(1) append) */
  subscribersTail: Dependency | undefined;
};

/**
 * Consumer node - a node that depends on other nodes.
 *
 * Computeds and effects are consumers. They maintain a linked list
 * of all producers (signals and computeds) they depend on.
 *
 * @internal Implementation detail, not part of public API.
 */
export type ConsumerNode = ReactiveNode & {
  /** Head of dependency linked list */
  dependencies: Dependency | undefined;
  /** Tail pointer for dependency tracking during computation */
  dependencyTail: Dependency | undefined;
  /** Version counter for efficient dependency pruning */
  trackingVersion: number;
};

/**
 * Derived node - both a producer AND consumer.
 *
 * Computeds are derived nodes: they consume other values and produce
 * a derived value that others can depend on.
 *
 * @internal Implementation detail, not part of public API.
 */
export type DerivedNode<T = unknown> = ProducerNode &
  ConsumerNode & {
    /** The computation function that derives the value */
    compute: () => T;
  };

/**
 * Scheduled node - a consumer that batches its execution.
 *
 * Effects are scheduled nodes. When their dependencies change,
 * they're added to a scheduling queue rather than running immediately.
 *
 * @internal Implementation detail, not part of public API.
 */
export type ScheduledNode = ConsumerNode & {
  /** Next node in the scheduling queue (intrusive linked list) */
  nextScheduled: ScheduledNode | undefined;
  /** Execute the scheduled work */
  flush(node: ScheduledNode): void;
};

/** @internal */
export type FromNode = ProducerNode | DerivedNode;
/** @internal */
export type ToNode = ConsumerNode | DerivedNode | ScheduledNode;

/**
 * An edge in the reactive dependency graph.
 *
 * Dependencies form a doubly-linked structure that can be traversed
 * in both directions:
 * - From producer → all consumers (for invalidation propagation)
 * - From consumer → all producers (for pull-based updates)
 *
 * @internal Implementation detail, not part of public API.
 */
export type Dependency = {
  /** The producer node (source of data) */
  producer: FromNode;
  /** The consumer node (depends on the producer) */
  consumer: ToNode;

  // Producer's subscriber list navigation (doubly-linked)
  /** Previous dependency in producer's subscriber list */
  prevConsumer: Dependency | undefined;
  /** Next dependency in producer's subscriber list */
  nextConsumer: Dependency | undefined;

  // Consumer's dependency list navigation (doubly-linked)
  /** Previous dependency in consumer's dependency list */
  prevDependency: Dependency | undefined;
  /** Next dependency in consumer's dependency list */
  nextDependency: Dependency | undefined;

  /** Version stamp for efficient dependency pruning during recomputation */
  version: number;
};

// Ensure module is not tree-shaken
export const __types = true;
