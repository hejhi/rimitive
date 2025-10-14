# Test Suite Review - @lattice/view

## Executive Summary

The current test suite has **good coverage** but suffers from:
1. **Tautological tests** - testing implementation details instead of user-facing behavior
2. **High redundancy** - multiple tests for the same concept
3. **Mock-focused assertions** - checking mock internals instead of outcomes
4. **Verbose boilerplate** - duplicated setup code

## File-by-File Analysis

### `scope.test.ts` - 👍 Mostly Good

**Keep:**
- ✅ "disposes tracked items when scope is disposed"
- ✅ "disposes child scopes when parent is disposed"
- ✅ "disposes entire scope tree recursively"
- ✅ "is idempotent - can dispose same scope multiple times"
- ✅ "prevents tracking after disposal"
- ✅ "disposes partial tree without affecting parent"
- ✅ "isolates sibling scopes from each other"
- ✅ "ignores tracking when no scope is active"

**Remove/Refactor:**
- ❌ "disposes multiple tracked items" - **redundant** with "disposes tracked items"
- ❌ "restores previous scope on nested calls" - **internal implementation detail**
- ❌ "restores scope even when function throws" - **doesn't verify anything concrete**
- ❌ "supports effect cleanup pattern" - **redundant** with earlier disposal tests
- ❌ "supports nested component cleanup" - **redundant** with "disposes entire scope tree"

**Why:** Scope restoration is an implementation detail. Users don't care HOW scopes are restored, they care that disposal works correctly.

---

### `reconcile.test.ts` - ⚠️ Too Implementation-Focused

**Keep:**
- ✅ "renders and inserts new items" (rename to "displays all items in list")
- ✅ "disposes scopes when items are removed"
- ✅ "tracks items by object identity by default"
- ✅ "uses custom keyFn for tracking"
- ✅ "handles add + remove + reorder in single pass"

**Remove/Refactor:**
- ❌ "adds new items to end of existing list" - **redundant**, position is implementation detail
- ❌ "adds new items in the middle" - **redundant**, position is implementation detail
- ❌ "removes items from DOM" - **redundant** with "disposes scopes when items are removed"
- ❌ "removes all items" - **edge case of remove**
- ❌ "reorders existing items without re-rendering" - **implementation detail** (no re-render)
- ❌ "handles complex reordering" - **redundant** with regular reordering test

**Why:** Tests check `container.children.map(c => c.id)` which is mock internals. Users care about "list shows correct items", not DOM structure.

---

### `el.test.ts` - ⚠️ Tests Mock Implementation

**Keep:**
- ✅ "renders reactive text children"
- ✅ "updates props when signal changes"
- ✅ "cleans up on disconnect"
- ✅ "calls lifecycle cleanup function"

**Remove/Refactor:**
- ❌ "creates element with specified tag" - **trivial**, tests mock more than el()
- ❌ "applies static props" - **tests mock internals** (element.props)
- ❌ "attaches event handlers" - **tests mock internals** (element.listeners)
- ❌ "renders static text children" - **not behavior**, just checks children array
- ❌ "ignores null/undefined/false children" - **implementation detail**
- ❌ "renders nested elements" - **awkward API** (requires passing .element)
- ❌ "handles multiple reactive props" - **redundant** with "updates props"
- ❌ "handles complex nested structures" - **tests mock traversal**, not behavior
- ❌ "mixes static and reactive content" - **redundant** with other reactivity tests

**Why:** Assertions like `expect(ref.element.props.className).toBe('foo')` test the mock, not the actual behavior users would see.

---

### `elMap.test.ts` - ⚠️ Highly Redundant

**Keep:**
- ✅ "renders all items in list" (rename to "displays items")
- ✅ "adds new items to list" (merge add tests)
- ✅ "removes items from list" (merge remove tests)
- ✅ "reorders items without re-rendering" (rename to "preserves elements when reordering")
- ✅ "tracks items by object identity by default"
- ✅ "uses custom keyFn for tracking"
- ✅ "handles add + remove + reorder in single update"

**Remove/Refactor:**
- ❌ "renders empty list" - **edge case**, can be one assertion in main test
- ❌ "adds items to empty list" - **redundant** with "adds new items"
- ❌ "removes all items" - **edge case of remove**
- ❌ "handles complex reordering" - **redundant**, just more items
- ❌ "handles rapid sequential updates" - **nice to have** but doesn't test new behavior
- ❌ "creates container with display:contents" - **implementation detail**

**Why:** Testing add-to-end vs add-to-empty-list vs add-to-middle are all variations of "adds items". Tests should focus on outcomes, not permutations.

---

## Major Issues

### 1. **Testing Mock Internals Instead of Behavior**

**Current:**
```typescript
expect(ref.element.props.className).toBe('foo');
expect(container.children).toHaveLength(3);
expect(container.children.map(c => c.id)).toEqual(['item-a', 'item-b', 'item-c']);
```

**Problem:** These test the mock's internal data structures, not what users would actually see.

**Better:** Test by simulating user interactions or observable side effects:
```typescript
// Test that clicking triggers handler
const clicked = vi.fn();
const button = el(['button', { onClick: clicked }]);
button.element.listeners.get('click')?.(); // Simulate click
expect(clicked).toHaveBeenCalled();

// Test that content updates
const [text, setText] = createSignal('hello');
const div = el(['div', text]);
expect(getTextContent(div.element)).toBe('hello');
setText('world');
expect(getTextContent(div.element)).toBe('world');
```

### 2. **Redundant Test Variations**

Many tests cover the same logical behavior with different data:
- "adds items to end" + "adds items to middle" + "adds to empty" → **one "adds items" test**
- "removes one item" + "removes all items" → **one "removes items" test**
- "reorders 3 items" + "complex reorders 5 items" → **one "reorders items" test**

### 3. **Verbose Boilerplate**

Every test recreates:
- Context
- Renderer
- Signal implementation
- Effect implementation

**Solution:** Create test utilities:
```typescript
// test-utils.ts
export function createTestEnv() {
  const ctx = createViewContext();
  const renderer = createMockRenderer();
  const signals = new Map();

  const signal = <T>(val: T) => {
    const sig = createSignal(val);
    signals.set(sig.read, sig);
    return sig.read;
  };

  const effect = (fn: () => void) => {
    signals.forEach(sig => sig.subscribers.add(fn));
    fn();
    return () => signals.forEach(sig => sig.subscribers.delete(fn));
  };

  return { ctx, renderer, signal, effect };
}
```

### 4. **Missing User-Centric Tests**

No tests for real-world patterns:
- Todo list (add/check/remove items)
- Form handling (input validation, submission)
- Conditional rendering (show/hide based on state)
- Error boundaries
- Loading states

---

## Recommendations

### 1. Create Test Utilities (`test-utils.ts`)
- Shared setup (context, renderer, signal, effect)
- Helper to extract text content from mock elements
- Helper to simulate user interactions

### 2. Consolidate Redundant Tests
- One test per behavior, not per variation
- Use parameterized tests if you need multiple scenarios

### 3. Focus on User-Visible Outcomes
- Test "displays correct content" not "children array has length 3"
- Test "updates when signal changes" not "effect was called"

### 4. Add Integration Tests
- Real-world component patterns
- Multiple primitives working together
- Error scenarios

### 5. Remove Implementation Tests
- Don't test scope restoration mechanics
- Don't test internal data structures
- Don't test private helpers

---

## Suggested Refactored Test Structure

```typescript
// scope.test.ts - ~50% fewer tests
describe('Scope disposal', () => {
  it('cleans up tracked items')
  it('cleans up entire tree recursively')
  it('is idempotent')
  it('prevents tracking after disposal')
  it('isolates subtrees')
})

// el.test.ts - ~60% fewer tests
describe('Element primitive', () => {
  it('renders static content')
  it('renders reactive content')
  it('updates reactive props')
  it('cleans up effects on disconnect')
  it('calls lifecycle cleanup')
})

// elMap.test.ts - ~50% fewer tests
describe('List primitive', () => {
  it('displays items')
  it('updates when items added/removed')
  it('preserves elements when reordering')
  it('tracks by identity')
  it('tracks by custom key')
})

// integration.test.ts - NEW
describe('Real-world patterns', () => {
  it('todo list with add/toggle/remove')
  it('form with validation')
  it('conditional rendering')
})
```

---

## Code Path Coverage Analysis

**Well covered:**
- ✅ Disposal (scopes, effects, lifecycle)
- ✅ Reactivity (props, children, updates)
- ✅ List operations (add, remove, reorder)
- ✅ Identity vs key tracking

**Needs coverage:**
- ❌ Error handling (malformed specs, invalid children)
- ❌ Edge cases (circular refs, null signals, disposed elements)
- ❌ Integration between primitives
- ❌ Memory leaks (disposables not cleaned up)
- ❌ Concurrent updates
- ❌ Real-world patterns

---

## Next Steps

1. Create `test-utils.ts` with shared setup
2. Refactor tests to focus on behavior, not mocks
3. Consolidate redundant tests
4. Add integration tests
5. Add error handling tests
6. Remove implementation-detail tests

**Goal:** Tests that serve as **documentation** for users, showing how to use the primitives, not how they're implemented internally.
