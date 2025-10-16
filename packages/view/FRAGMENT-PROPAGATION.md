# Fragment Dirty Propagation Spec

## Core Idea
Fragments (map, match) use the same push-pull dirty propagation as signals to track their DOM range size and trigger parent updates when their structure changes.

## Reuse Signal Infrastructure

### Constants (from `@lattice/signals/constants`)
```typescript
const CLEAN = 0;
const PENDING = 1 << 0;
const DIRTY = 1 << 1;
```

### Node Structure (analogous to signals)
```typescript
interface FragmentNode {
  status: number;                    // CLEAN | PENDING | DIRTY (same bit flags)
  cachedCount: number;               // Like computed.value - cached DOM node count

  // Graph structure (like ProducerNode/ConsumerNode)
  parentFragment?: FragmentNode;     // Like consumer.dependencies
  childFragments?: FragmentNode[];   // Like producer.subscribers (if we have nested fragments)

  // Fragment-specific
  firstChild?: ListItemNode;         // Internal linked list head
  lastChild?: ListItemNode;          // Internal linked list tail
}
```

## Push Phase (mark dirty)

When a fragment's structure changes (items added/removed/reordered in map, or element swapped in match):

```typescript
// In reconcile or match swap - after DOM updates
function notifyStructureChange(fragment: FragmentNode) {
  fragment.status = DIRTY;

  // Push PENDING up to parent (like signal propagation)
  if (fragment.parentFragment) {
    markPending(fragment.parentFragment);
  }
}

function markPending(fragment: FragmentNode) {
  // Already marked - stop propagation (like signals)
  if (fragment.status & (PENDING | DIRTY)) return;

  fragment.status = PENDING;

  // Continue propagation up
  if (fragment.parentFragment) {
    markPending(fragment.parentFragment);
  }
}
```

## Pull Phase (get count)

When a fragment needs its position (analogous to `computed()` reading value):

```typescript
function getDOMNodeCount(fragment: FragmentNode): number {
  // Like computed: check if stale, recompute if needed
  if (fragment.status !== CLEAN) {
    pullUpdate(fragment);
  }

  return fragment.cachedCount;
}

function pullUpdate(fragment: FragmentNode) {
  let count = 0;

  // Walk internal linked list (firstChild -> nextSibling chain)
  let node = fragment.firstChild;

  while (node) {
    if (node.fragment) {
      // Child is a fragment - recursively pull (like computed reading dependency)
      count += getDOMNodeCount(node.fragment);
    } else {
      // Regular element - always counts as 1
      count += 1;
    }
    node = node.nextSibling;
  }

  fragment.cachedCount = count;
  fragment.status = CLEAN;
}
```

## Parent-Child Graph Establishment

Fragments establish parent links when nested (analogous to dependency tracking):

```typescript
// In map's reconcile - when rendering an item
const rendered = renderItem(item);

if (isFragment(rendered)) {
  // Establish parent-child link (like trackDependency)
  rendered.parentFragment = this;

  // Store in node for pullUpdate
  node.fragment = rendered;
}

// In el() - when processing fragment children
if (isFragment(child)) {
  // If we're inside a fragment, establish parent link
  if (currentFragment) {
    child.parentFragment = currentFragment;
  }
  child(element, childNode);
}
```

## Insertion Position Calculation

Using the meta linked list (ChildNode structure from el()):

```typescript
// In map fragment - when inserting into empty list
function getInsertionIndex(selfNode: ChildNode): number {
  let count = 0;
  let current = selfNode.previousSibling;

  // Walk backwards counting DOM nodes (like pulling dependency chain)
  while (current) {
    count += current.getRange(); // Triggers pull if needed
    current = current.previousSibling;
  }

  return count;
}

// ChildNode methods
type ChildNode = {
  type: 'element' | 'text' | 'fragment';
  ref: ElementRef | Fragment;
  previousSibling?: ChildNode;
  nextSibling?: ChildNode;

  getRange(): number; // How many DOM nodes this child contributes
};

// For element/text
const elementNode: ChildNode = {
  getRange: () => 1, // Always 1
  // ...
};

// For fragment
const fragmentNode: ChildNode = {
  getRange: () => getDOMNodeCount(fragment.node), // Pull-based
  // ...
};
```

## Reconcile Integration

```typescript
// In reconcile - when inserting new items
function insertNewItem(item: T, index: number) {
  const rendered = renderItem(item);

  // If list is empty, calculate insertion position
  const insertionRef = parent.firstChild
    ? parent.firstChild.element  // Has items - use linked list
    : containerEl.children[parent.getInsertionIndex()]; // Empty - use calculated index

  renderer.insertBefore(containerEl, rendered.element, insertionRef || null);

  // Mark structure changed (push phase)
  parent.status = DIRTY;
  if (parent.parentFragment) {
    markPending(parent.parentFragment);
  }
}
```

## Key Differences from Signals

1. **No schedulers** - fragments update DOM immediately, not batched
2. **No effects** - fragments don't subscribe to changes, they're queried
3. **Simpler graph** - only parent links, no sibling traversal needed
4. **Count vs Value** - cache DOM node count instead of computed value
5. **Manual marking** - we explicitly call `notifyStructureChange` after reconcile

## Benefits

1. **Reuses signal patterns** - same push/pull mental model and bit flags
2. **Lazy evaluation** - only recalculates position when needed
3. **Nested fragments work** - recursive pull through PENDING chain
4. **No DOM querying** - purely structural graph traversal
5. **Cache efficiency** - CLEAN fragments skip recomputation

## Future: General Change Tracking

This same mechanism could optimize reconciliation:

```typescript
// Track if items array reference changed vs just reordered
effect(() => {
  const items = itemsSignal();

  // Check if we're CLEAN (no structural changes elsewhere)
  // Could skip reconcile if only data updated, not structure
  if (parent.status === CLEAN && sameKeys(items, prevItems)) {
    // Fast path - just update signals, no reconcile
    updateItemSignals(items);
    return;
  }

  reconcileList(...);
  parent.status = CLEAN;
});
```
