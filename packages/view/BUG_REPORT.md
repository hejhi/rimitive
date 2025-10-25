# Reconciliation Bug Report

## Summary

Created comprehensive TDD tests exposing critical bugs in the reconciliation implementation. Tests are designed to fail with current implementation and pass once bugs are fixed.

## Test Results

### reconcile-positional-bugs.test.ts
**Status: 8/8 tests FAILING** ✅ (correctly exposing bugs)

**Critical Issues Detected:**
1. Elements recreated on every reconciliation instead of being reused
2. `create()` called for ALL items on every update, not just new items
3. Element identity lost across updates
4. Custom state/properties lost when elements recreated

**Evidence:**
```
FAIL: should REUSE elements when list content unchanged
  - Elements have different IDs after update (recreated)
  - Expected: ul.children[0] === originalElements[0]
  - Actual: Different object instances

FAIL: should preserve element state across updates
  - Expected createCounts: { a: 1, b: 1, c: 1 }
  - Actual createCounts: { a: 2, b: 2, c: 2 }
  - Proves create() called again for existing items

FAIL: should only create() new items, not existing ones
  - Adding 'c' to ['a', 'b']
  - Expected: ['c'] created
  - Actual: ['a', 'b', 'c'] all created
```

**Root Cause (reconcile.ts:246-326):**
```typescript
// Line 269: WRONG - creates new node to "compare"
const newNode = refSpec.create();

// Then compares by element reference:
const oldElement = isElementRef(oldNode) ? oldNode.element : null;
const newElement = isElementRef(newNode) ? newNode.element : null;

if (oldElement === newElement) {
  continue; // Same element
}
```

This defeats reconciliation - it creates DOM elements just to check if they changed, then throws them away or uses them. Should instead:
1. Compare RefSpec identity or keys
2. Only call create() for genuinely new items
3. Reuse existing nodes for unchanged positions

---

### reconcile-keyed-bugs.test.ts
**Status: 7/13 tests FAILING** ✅ (correctly exposing bugs)

**Issues Detected:**
- Complex LIS reorderings produce wrong DOM order
- Elements not reused when in LIS (recreated instead)
- Anchor logic doesn't track previous element correctly

**Evidence:**
```
PASS: should maintain correct order after reverse (simple case)
FAIL: should handle complex reordering with LIS optimization
  - Expected element A at position 1 to be same instance
  - Different IDs show it was recreated

FAIL: should handle insertion between LIS elements
  - Insert B between A and C
  - Elements have different IDs (recreated, not reused)

FAIL: should handle all elements in LIS (no moves needed)
  - When nothing changes, ALL elements recreated
  - Expected: Same 5 element instances
  - Actual: All new instances with different IDs
```

**Root Cause (reconcile.ts:204-236):**
```typescript
// Line 205: Sets global anchor to first LIS element
let anchor: TElement | null = resolveNextElement(nextSibling);
if (lisLen > 0) {
  const firstLISPos = newPosBuf[lisBuf[0]!]!;
  const firstLISNode = nodes[firstLISPos]!;
  if (isElementRef(firstLISNode)) {
    anchor = firstLISNode.element;
  }
}

// Line 214: Doesn't track previous element during iteration
for (let i = 0; i < nodes.length; i++) {
  const node = nodes[i]!;
  if (node.position === nextLISPos) {
    // Update anchor to next LIS element
  } else {
    // Insert before anchor - but this is GLOBAL, not relative to prev
    renderer.insertBefore(parentElement, node.element, anchor);
  }
}
```

**Original Algorithm (map.ts:498):**
```typescript
const sib = (prev?.next ?? parent.firstChild) as ListItemNode<...>;
```

The original tracks `prev` element and inserts relative to `prev.next`, maintaining correct sibling relationships. New algorithm uses global anchor which doesn't respect local ordering.

---

## Test Coverage

### reconcile-positional-bugs.test.ts
**Element Reuse Tests:**
- ✅ Reuse elements when content unchanged
- ✅ Reuse elements at unchanged positions
- ✅ Preserve element state across updates
- ✅ Only create() for new items
- ✅ Preserve custom properties
- ✅ Minimize create() calls on partial updates

**Comparison Logic Tests:**
- ✅ Detect unchanged RefSpec without calling create()
- ✅ Detect changed RefSpec and replace element

### reconcile-keyed-bugs.test.ts
**Positioning Algorithm Tests:**
- ✅ Maintain correct order after reverse
- ✅ Handle complex reordering with LIS optimization
- ✅ Position elements before and after LIS
- ✅ Insert between LIS elements
- ✅ Move to beginning before LIS
- ✅ Move to end after LIS
- ✅ Multiple non-LIS elements in sequence
- ✅ Interleaved LIS and non-LIS elements
- ✅ Swap adjacent elements
- ✅ Rotation pattern

**Edge Cases:**
- ✅ Single element (no LIS needed)
- ✅ All elements in LIS (no moves)
- ✅ No elements in LIS (complete reorder)

---

## Fix Strategy

### For reconcilePositional:

1. **Track RefSpec identity** instead of creating to compare:
   ```typescript
   // Store RefSpec references in state
   itemsByIndex: { refSpec: RefSpec, nodeRef: NodeRef }[]

   // Compare RefSpecs, not created elements
   if (oldItem.refSpec === newRefSpec) {
     // Reuse nodeRef - don't call create()
     continue;
   }
   ```

2. **Only call create() for new items:**
   ```typescript
   if (i < newItems.length && i < itemsByIndex.length) {
     // Existing position - check RefSpec identity
   } else if (i < newItems.length) {
     // New item - NOW call create()
   }
   ```

### For reconcileWithKeys:

1. **Fix anchor tracking** to match original algorithm:
   ```typescript
   let prev: ReconcileNode<TElement> | undefined;
   for (const node of nodes) {
     if (not in LIS) {
       const anchor = (prev?.next ?? firstChild) as ReconcileNode;
       renderer.insertBefore(parentElement, node.element, anchor?.element);
     }
     prev = node; // Track previous for next iteration
   }
   ```

2. **Don't recreate nodes on every reconciliation** - verify build phase reuses existing nodes from Map

---

## Success Criteria

All 21 tests passing:
- 8/8 positional tests pass
- 13/13 keyed tests pass

Performance characteristics:
- create() only called for new items
- Element identity preserved across updates
- DOM operations minimized via LIS
- No unnecessary allocations

---

## Notes

These bugs explain why the original map.ts exists as a built-in primitive rather than user-space helper. The reconciliation algorithm is subtle and easy to get wrong. The extracted version needs the same level of care and testing as the original.

The test suite provides a specification for correct behavior that can guide the fix.
