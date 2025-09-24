/**
 * Stack Pool - Pre-allocated stack for graph traversal
 *
 * OPTIMIZATION: Eliminates heap allocations during graph traversal
 * by using a pre-allocated array-based stack that can be reused.
 *
 * Benefits:
 * - No GC pressure during traversal (hot path)
 * - Better cache locality with contiguous memory
 * - Reusable across multiple traversals
 * - Bounded memory usage with automatic growth
 */

// Stack item can hold either a Dependency or DerivedNode for different traversal types
export type StackItem<T> = T;

export interface StackPool<T> {
  push(item: T): void;
  pop(): T | undefined;
  isEmpty(): boolean;
  clear(): void;
  // For debugging/monitoring
  readonly capacity: number;
  readonly size: number;
}

const INITIAL_CAPACITY = 128; // Reasonable default for most graphs
const GROWTH_FACTOR = 2;

/**
 * Create a reusable stack pool for graph traversal.
 * Uses a pre-allocated array to avoid heap allocations.
 */
export function createStackPool<T>(): StackPool<T> {
  let items: (T | undefined)[] = new Array(INITIAL_CAPACITY);
  let top = -1; // Points to the top item, -1 when empty
  let capacity = INITIAL_CAPACITY;

  const grow = (): void => {
    const newCapacity = capacity * GROWTH_FACTOR;
    const newItems = new Array(newCapacity);

    // Copy existing items
    for (let i = 0; i <= top; i++) {
      newItems[i] = items[i];
    }

    items = newItems;
    capacity = newCapacity;
  };

  return {
    push(item: T): void {
      top++;
      if (top >= capacity) {
        grow();
      }
      items[top] = item;
    },

    pop(): T | undefined {
      if (top < 0) return undefined;

      const item = items[top];
      items[top] = undefined; // Clear reference for GC
      top--;
      return item;
    },

    isEmpty(): boolean {
      return top < 0;
    },

    clear(): void {
      // Clear all references for GC
      for (let i = 0; i <= top; i++) {
        items[i] = undefined;
      }
      top = -1;
    },

    get capacity(): number {
      return capacity;
    },

    get size(): number {
      return top + 1;
    }
  };
}

// Global singleton pools for different traversal types
// These are lazily created and reused across all operations
let dependencyStackPool: StackPool<any> | undefined;
let nodeStackPool: StackPool<any> | undefined;

/**
 * Get or create the global dependency stack pool.
 * Singleton pattern ensures we reuse the same pool.
 */
export function getDependencyStackPool<T>(): StackPool<T> {
  if (!dependencyStackPool) {
    dependencyStackPool = createStackPool<T>();
  }
  return dependencyStackPool as StackPool<T>;
}

/**
 * Get or create the global node stack pool.
 * Singleton pattern ensures we reuse the same pool.
 */
export function getNodeStackPool<T>(): StackPool<T> {
  if (!nodeStackPool) {
    nodeStackPool = createStackPool<T>();
  }
  return nodeStackPool as StackPool<T>;
}