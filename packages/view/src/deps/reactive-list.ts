/**
 * Reactive Linked List - O(1) list operations without reconciliation
 *
 * A linked list data structure designed for reactive views where mutations
 * directly trigger DOM updates without reconciliation.
 *
 * Inspired by @rimitive/signals dependency graph which uses doubly-linked
 * lists for O(1) add/remove of reactive edges.
 *
 * @example
 * ```ts
 * const todos = createReactiveList<Todo>((todo) => todo.id);
 *
 * // O(1) mutations
 * todos.append(newTodo);
 * todos.prepend(urgentTodo);
 * todos.update(modifiedTodo);
 * todos.remove(doneTodo);
 *
 * // In view - map() accepts Iter directly for O(1) DOM updates
 * map(todos, (todoSignal) =>
 *   el('li')(todoSignal().text)
 * );
 * ```
 */

/**
 * A node in the reactive list (internal)
 */
export type ListNode<T> = {
  key: string | number;
  value: T;
  prev: ListNode<T> | null;
  next: ListNode<T> | null;
};

/**
 * Callbacks for list mutations - the view layer hooks into these
 */
export type ListCallbacks<T> = {
  onAppend?: (node: ListNode<T>) => void;
  onPrepend?: (node: ListNode<T>) => void;
  onInsertAfter?: (node: ListNode<T>, refNode: ListNode<T>) => void;
  onInsertBefore?: (node: ListNode<T>, refNode: ListNode<T>) => void;
  onRemove?: (node: ListNode<T>) => void;
  onUpdate?: (node: ListNode<T>, oldValue: T) => void;
  onClear?: () => void;
};

/**
 * Reactive list with O(1) mutations
 */
export type ReactiveList<T> = {
  /** First node in the list */
  readonly head: ListNode<T> | null;
  /** Last node in the list */
  readonly tail: ListNode<T> | null;
  /** Number of items */
  readonly size: number;

  // === O(1) Mutations ===

  /** Append item to end of list */
  append(value: T): ListNode<T>;
  /** Prepend item to beginning of list */
  prepend(value: T): ListNode<T>;
  /** Insert item after reference item */
  insertAfter(refValue: T, value: T): ListNode<T> | null;
  /** Insert item before reference item */
  insertBefore(refValue: T, value: T): ListNode<T> | null;
  /** Remove item from list */
  remove(value: T): T | null;
  /** Update item in place (finds by key, replaces value) */
  update(value: T): boolean;

  // === Key-based operations ===

  /** Remove by key */
  removeByKey(key: string | number): T | null;
  /** Get value by key */
  getByKey(key: string | number): T | undefined;
  /** Check if key exists */
  has(key: string | number): boolean;
  /** Get node by key (for insertAfter/insertBefore by key) */
  getNode(key: string | number): ListNode<T> | undefined;

  /** Clear all items */
  clear(): void;

  // === Iteration ===

  /** Iterate over nodes */
  [Symbol.iterator](): Iterator<ListNode<T>>;
  /** Iterate over values */
  values(): IterableIterator<T>;
  /** Iterate over keys */
  keys(): IterableIterator<string | number>;

  // === Callbacks (for view binding) ===

  /** Set callbacks for mutations */
  setCallbacks(callbacks: ListCallbacks<T>): void;
};

/**
 * Create a reactive list with O(1) operations
 *
 * @param keyFn - Function to derive key from value (like map's key function)
 */
export function createReactiveList<T>(
  keyFn: (value: T) => string | number
): ReactiveList<T> {
  let head: ListNode<T> | null = null;
  let tail: ListNode<T> | null = null;
  let size = 0;
  const byKey = new Map<string | number, ListNode<T>>();
  let callbacks: ListCallbacks<T> = {};

  const append = (value: T): ListNode<T> => {
    const key = keyFn(value);
    if (byKey.has(key)) {
      throw new Error(`Key "${key}" already exists in list`);
    }

    const node: ListNode<T> = { key, value, prev: tail, next: null };
    byKey.set(key, node);

    if (tail) {
      tail.next = node;
    } else {
      head = node;
    }
    tail = node;
    size++;

    callbacks.onAppend?.(node);
    return node;
  };

  const prepend = (value: T): ListNode<T> => {
    const key = keyFn(value);
    if (byKey.has(key)) {
      throw new Error(`Key "${key}" already exists in list`);
    }

    const node: ListNode<T> = { key, value, prev: null, next: head };
    byKey.set(key, node);

    if (head) {
      head.prev = node;
    } else {
      tail = node;
    }
    head = node;
    size++;

    callbacks.onPrepend?.(node);
    return node;
  };

  const insertAfter = (refValue: T, value: T): ListNode<T> | null => {
    const refKey = keyFn(refValue);
    const refNode = byKey.get(refKey);
    if (!refNode) return null;

    const key = keyFn(value);
    if (byKey.has(key)) {
      throw new Error(`Key "${key}" already exists in list`);
    }

    const node: ListNode<T> = { key, value, prev: refNode, next: refNode.next };
    byKey.set(key, node);

    if (refNode.next) {
      refNode.next.prev = node;
    } else {
      tail = node;
    }
    refNode.next = node;
    size++;

    callbacks.onInsertAfter?.(node, refNode);
    return node;
  };

  const insertBefore = (refValue: T, value: T): ListNode<T> | null => {
    const refKey = keyFn(refValue);
    const refNode = byKey.get(refKey);
    if (!refNode) return null;

    const key = keyFn(value);
    if (byKey.has(key)) {
      throw new Error(`Key "${key}" already exists in list`);
    }

    const node: ListNode<T> = { key, value, prev: refNode.prev, next: refNode };
    byKey.set(key, node);

    if (refNode.prev) {
      refNode.prev.next = node;
    } else {
      head = node;
    }
    refNode.prev = node;
    size++;

    callbacks.onInsertBefore?.(node, refNode);
    return node;
  };

  const remove = (value: T): T | null => {
    const key = keyFn(value);
    return removeByKey(key);
  };

  const removeByKey = (key: string | number): T | null => {
    const node = byKey.get(key);
    if (!node) return null;

    byKey.delete(key);

    if (node.prev) {
      node.prev.next = node.next;
    } else {
      head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      tail = node.prev;
    }

    size--;

    callbacks.onRemove?.(node);
    return node.value;
  };

  const update = (value: T): boolean => {
    const key = keyFn(value);
    const node = byKey.get(key);
    if (!node) return false;

    const oldValue = node.value;
    node.value = value;

    callbacks.onUpdate?.(node, oldValue);
    return true;
  };

  const getByKey = (key: string | number): T | undefined => {
    return byKey.get(key)?.value;
  };

  const has = (key: string | number): boolean => {
    return byKey.has(key);
  };

  const getNode = (key: string | number): ListNode<T> | undefined => {
    return byKey.get(key);
  };

  const clear = (): void => {
    callbacks.onClear?.();
    head = null;
    tail = null;
    size = 0;
    byKey.clear();
  };

  function* iterateNodes(): Iterator<ListNode<T>> {
    let current = head;
    while (current) {
      yield current;
      current = current.next;
    }
  }

  function* iterateValues(): IterableIterator<T> {
    let current = head;
    while (current) {
      yield current.value;
      current = current.next;
    }
  }

  function* iterateKeys(): IterableIterator<string | number> {
    let current = head;
    while (current) {
      yield current.key;
      current = current.next;
    }
  }

  const setCallbacks = (newCallbacks: ListCallbacks<T>): void => {
    callbacks = newCallbacks;
  };

  return {
    get head() { return head; },
    get tail() { return tail; },
    get size() { return size; },
    append,
    prepend,
    insertAfter,
    insertBefore,
    remove,
    removeByKey,
    update,
    getByKey,
    has,
    getNode,
    clear,
    [Symbol.iterator]: iterateNodes,
    values: iterateValues,
    keys: iterateKeys,
    setCallbacks,
  };
}
