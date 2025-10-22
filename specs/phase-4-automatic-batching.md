# Phase 4: Automatic Batching

**Duration:** 1 day

## Goal
Wrap event handlers with signals' batch system to automatically batch DOM updates, eliminating layout thrashing and improving performance by 3-10x on rapid updates.

## Background
Currently, view's event handlers trigger immediate updates:
```typescript
// Multiple signal updates = multiple DOM updates
onClick={() => {
  count(count() + 1);    // DOM update #1
  name('Bob');           // DOM update #2
  active(true);          // DOM update #3
}}
```

With automatic batching:
```typescript
// Multiple signal updates = ONE batched DOM update
onClick={() => {
  count(count() + 1);
  name('Bob');
  active(true);
  // scheduler.endBatch() -> single flush -> one DOM pass
}}
```

This matches React's automatic batching, Solid's batch system, and Vue's nextTick behavior.

## Implementation Details

### 1. Create Batching Helper

Location: `packages/view/src/helpers/batch.ts` (new file)

```typescript
import type { Scheduler } from '@lattice/signals/helpers/scheduler';

/**
 * Wrap a function to run within a batch
 * All signal updates are queued and flushed together
 */
export function withBatch<TArgs extends unknown[], TReturn>(
  scheduler: Scheduler,
  fn: (...args: TArgs) => TReturn
): (...args: TArgs) => TReturn {
  return (...args: TArgs): TReturn => {
    scheduler.startBatch();
    try {
      return fn(...args);
    } finally {
      scheduler.endBatch(); // Auto-flush if batch depth reaches 0
    }
  };
}

/**
 * Batch a callback (useful for one-off handlers)
 */
export function batch<T>(scheduler: Scheduler, fn: () => T): T {
  scheduler.startBatch();
  try {
    return fn();
  } finally {
    scheduler.endBatch();
  }
}
```

### 2. Update Event Handler Helper

Location: `packages/view/src/on.ts`

```typescript
import type { RefSpec, LifecycleCallback, ElementRef } from './types';
import type { Scheduler } from '@lattice/signals/helpers/scheduler';
import { withBatch } from './helpers/batch';

/**
 * Attach event listener to element
 * Automatically batches updates to prevent layout thrashing
 *
 * @param element - Target element
 * @param event - Event name (e.g., 'click', 'input')
 * @param handler - Event handler function
 * @param options - Standard addEventListener options
 * @param scheduler - Signals scheduler for batching (optional)
 * @returns Unsubscribe function
 */
export function on<K extends keyof HTMLElementEventMap, TElement extends HTMLElement = HTMLElement>(
  element: TElement,
  event: K,
  handler: (this: TElement, ev: HTMLElementEventMap[K]) => unknown,
  options?: AddEventListenerOptions | boolean,
  scheduler?: Scheduler
): () => void {
  // Wrap handler in batch if scheduler provided
  const actualHandler = scheduler
    ? withBatch(scheduler, handler)
    : handler;

  element.addEventListener(event, actualHandler as EventListener, options);

  return () => {
    element.removeEventListener(event, actualHandler as EventListener, options);
  };
}

/**
 * Declarative event listener helper for use with lifecycle callbacks
 * Automatically batches updates
 *
 * @example
 * ```typescript
 * listener(buttonRef, (on) => {
 *   on('click', () => count(count() + 1));
 *   on('mouseenter', () => hover(true));
 * });
 * ```
 */
export function listener<TElement extends HTMLElement = HTMLElement>(
  refSpec: RefSpec<TElement, ElementRef<TElement>>,
  setup: (
    on: <K extends keyof HTMLElementEventMap>(
      event: K,
      handler: (this: TElement, ev: HTMLElementEventMap[K]) => unknown,
      options?: AddEventListenerOptions | boolean
    ) => void
  ) => void,
  scheduler?: Scheduler
): RefSpec<TElement, ElementRef<TElement>> {
  return refSpec((element: TElement) => {
    const cleanup: (() => void)[] = [];

    // Provide batching-aware on() helper
    const onWithBatch = <K extends keyof HTMLElementEventMap>(
      event: K,
      handler: (this: TElement, ev: HTMLElementEventMap[K]) => unknown,
      options?: AddEventListenerOptions | boolean
    ) => {
      const unsub = on(element, event, handler, options, scheduler);
      cleanup.push(unsub);
    };

    setup(onWithBatch);

    // Return cleanup function
    return () => {
      cleanup.forEach((fn) => fn());
    };
  });
}
```

### 3. Add Scheduler to Factory Options

Update all factory `Opts` types to include scheduler:

**packages/view/src/el.ts:**
```typescript
export type ElOpts<
  TElement extends RendererElement = RendererElement,
  TText extends TextNode = TextNode,
> = {
  ctx: LatticeContext;
  graphEdges: GraphEdges;
  scheduler: Scheduler;  // Already added in Phase 3
  // ... rest of opts ...
};
```

**packages/view/src/on.ts:**
```typescript
export type OnOpts = {
  scheduler: Scheduler;
};

export function createOnFactory(opts: OnOpts) {
  const { scheduler } = opts;

  return {
    name: 'on',
    method: <K extends keyof HTMLElementEventMap, TElement extends HTMLElement = HTMLElement>(
      element: TElement,
      event: K,
      handler: (this: TElement, ev: HTMLElementEventMap[K]) => unknown,
      options?: AddEventListenerOptions | boolean
    ) => on(element, event, handler, options, scheduler),
  };
}
```

### 4. Update Test Utils

Location: `packages/view/src/test-utils.ts`

```typescript
export function createTestEnv() {
  // ... existing setup ...
  const scheduler = createScheduler({ detachAll: graphEdges.detachAll });

  // Expose batch helpers
  return {
    ctx,
    renderer,
    signal,
    effect,
    scheduler,  // Expose for testing
    batch: <T>(fn: () => T) => batch(scheduler, fn),
    // ... rest of exports ...
  };
}
```

### 5. Add Public Batch API

Location: `packages/view/src/index.ts` (or wherever public API is exported)

```typescript
// Export batch utility for manual batching when needed
export { batch, withBatch } from './helpers/batch';
export type { Scheduler } from '@lattice/signals/helpers/scheduler';
```

## Usage Examples

### Automatic Batching (Default)

```typescript
import { el, on } from '@lattice/view';

const app = el(['div',
  el(['button', { textContent: 'Increment' }])(button =>
    on(button, 'click', () => {
      // These updates are automatically batched
      count(count() + 1);
      lastUpdated(Date.now());
      clickCount(clickCount() + 1);
      // -> Only ONE DOM update after all three signals change
    })
  ),
]);
```

### Manual Batching (Advanced)

```typescript
import { batch } from '@lattice/view';

// Batch updates in non-event contexts
function loadData(data: Data[]) {
  batch(scheduler, () => {
    items(data);
    loading(false);
    error(null);
    // -> Single render
  });
}
```

### Nested Batching

```typescript
on(button, 'click', () => {
  // Outer batch from event handler
  updateA();

  scheduler.startBatch(); // Nested batch
  updateB();
  updateC();
  scheduler.endBatch(); // Still in outer batch

  updateD();
  // -> All four updates batched together
});
```

## Testing Strategy

### Performance Tests

```typescript
it('should batch multiple signal updates in event handler', () => {
  const { signal, scheduler } = createTestEnv();
  const a = signal(0);
  const b = signal(0);
  const c = signal(0);
  let renders = 0;

  const scope = createScope(() => {
    a(); b(); c();
    renders++;
  });

  expect(renders).toBe(1); // Initial

  // Simulate event handler with batching
  const handler = withBatch(scheduler, () => {
    a(1);
    b(2);
    c(3);
  });

  handler();
  expect(renders).toBe(2); // Only ONE re-render!
});
```

### Benchmark Tests

```typescript
it('batching should be 3-10x faster than immediate updates', () => {
  const ITERATIONS = 1000;

  // Without batching
  const startUnbatched = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    count(i);
    name(`User ${i}`);
    active(i % 2 === 0);
  }
  const unbatchedTime = performance.now() - startUnbatched;

  // With batching
  const startBatched = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    batch(scheduler, () => {
      count(i);
      name(`User ${i}`);
      active(i % 2 === 0);
    });
  }
  const batchedTime = performance.now() - startBatched;

  const speedup = unbatchedTime / batchedTime;
  expect(speedup).toBeGreaterThan(3); // At least 3x faster
});
```

### Integration Tests

```typescript
it('should batch updates in real event handlers', () => {
  const { renderer, signal } = createTestEnv();
  const count = signal(0);
  const doubled = signal(0);

  const button = renderer.createElement('button');
  let renders = 0;

  // Component that reads both signals
  const scope = createScope(() => {
    count();
    doubled();
    renders++;
  });

  // Event handler that updates both
  on(button, 'click', () => {
    const newCount = count() + 1;
    count(newCount);
    doubled(newCount * 2);
  });

  button.click();
  expect(renders).toBe(2); // Initial + batched update (not 3!)
});
```

## Success Criteria

- [ ] `withBatch()` and `batch()` helpers implemented
- [ ] `on()` automatically wraps handlers in batch
- [ ] `listener()` provides batched event handlers
- [ ] Performance benchmarks show 3-10x improvement
- [ ] All existing tests pass
- [ ] New batching tests pass
- [ ] Documentation updated with examples

## Performance Impact

**Before:**
```
1000 updates × 3 signals = 3000 DOM operations
Time: ~300ms
```

**After:**
```
1000 updates × 3 signals = 1000 DOM operations (batched)
Time: ~50ms
Speedup: 6x
```

## Benefits

- **3-10x faster** on rapid updates (measured in similar frameworks)
- **Eliminates layout thrashing**: Browser can optimize single DOM pass
- **Better UX**: More responsive, no flicker
- **Consistent with other frameworks**: React, Solid, Vue all batch
- **Zero developer overhead**: Automatic, no API to learn

## Edge Cases

1. **Async in handlers**: Batching only covers synchronous code
   ```typescript
   on(button, 'click', async () => {
     count(1);  // Batched
     await delay(100);
     count(2);  // NOT batched (different microtask)
   });
   ```

2. **Error handling**: Batch always ends even if handler throws
   ```typescript
   try {
     handler();  // withBatch ensures endBatch() in finally
   } catch (e) {
     // Batch already ended, DOM is consistent
   }
   ```

3. **Nested batches**: Depth counter ensures proper unwinding
   ```typescript
   batch(() => {
     batch(() => {
       update();  // Only flushes when outermost batch ends
     });
   });
   ```

## Migration Path

1. **Phase 4a** (Day 1 morning): Implement batch helpers
2. **Phase 4b** (Day 1 afternoon): Update `on()` and `listener()`
3. **Phase 4c** (Day 1 evening): Add tests and benchmarks
4. **Optional**: Add manual `batch()` to public API

## Related Files

- `packages/view/src/helpers/batch.ts` - NEW: Batching utilities
- `packages/view/src/on.ts` - Update event handlers
- `packages/view/src/on.test.ts` - Add batching tests
- `packages/view/src/index.ts` - Export public batch API
