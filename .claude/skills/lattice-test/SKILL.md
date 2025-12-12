---
name: lattice-test
description: Write tests for Lattice code using Vitest. Use when creating unit tests, integration tests, or test utilities for signals, behaviors, modules, or view components.
---

# Writing Lattice Tests

Lattice uses Vitest for testing. Tests are co-located with source files (`*.test.ts`).

## Test Structure

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Feature', () => {
  beforeEach(() => {
    // Reset state between tests
  });

  it('does something', () => {
    // Arrange, Act, Assert
  });
});
```

## Testing Signals

### Using test-setup.ts

For signal tests, import from `./test-setup`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  signal,
  computed,
  effect,
  batch,
  resetGlobalState,
} from './test-setup';

describe('My signal feature', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  it('updates reactively', () => {
    const count = signal(0);
    const doubled = computed(() => count() * 2);

    expect(doubled()).toBe(0);
    count(5);
    expect(doubled()).toBe(10);
  });
});
```

### Tracking Computation Counts

```typescript
it('only recomputes when dependencies change', () => {
  const source = signal(1);
  let computeCount = 0;

  const derived = computed(() => {
    computeCount++;
    return source() * 2;
  });

  expect(derived()).toBe(2);
  expect(computeCount).toBe(1);

  // Same value - should still recompute to check
  source(1);
  derived();
  expect(computeCount).toBe(2);

  // Different value
  source(2);
  expect(derived()).toBe(4);
  expect(computeCount).toBe(3);
});
```

### Testing Effects

```typescript
it('runs effect on dependency change', () => {
  const value = signal(0);
  const calls: number[] = [];

  const dispose = effect(() => {
    calls.push(value());
  });

  expect(calls).toEqual([0]); // Initial run

  value(1);
  expect(calls).toEqual([0, 1]);

  value(2);
  expect(calls).toEqual([0, 1, 2]);

  dispose();
  value(3);
  expect(calls).toEqual([0, 1, 2]); // No more calls after dispose
});
```

### Testing Batched Updates

```typescript
it('batches multiple updates', () => {
  const a = signal(0);
  const b = signal(0);
  let effectCount = 0;

  effect(() => {
    a();
    b();
    effectCount++;
  });

  expect(effectCount).toBe(1);

  batch(() => {
    a(1);
    b(1);
  });

  // Only one effect run despite two signal changes
  expect(effectCount).toBe(2);
});
```

## Testing Behaviors

Behaviors are pure functions—test without DOM:

```typescript
import { describe, it, expect } from 'vitest';
import { compose } from '@lattice/lattice';
import { SignalModule, ComputedModule, EffectModule } from '@lattice/signals/extend';
import { counter } from './counter';

describe('counter behavior', () => {
  const createSvc = () => compose(SignalModule, ComputedModule, EffectModule);

  it('initializes with value', () => {
    const svc = createSvc();
    const c = svc(counter)(5);

    expect(c.count()).toBe(5);
  });

  it('increments', () => {
    const svc = createSvc();
    const c = svc(counter)(0);

    c.increment();
    expect(c.count()).toBe(1);

    c.increment();
    expect(c.count()).toBe(2);
  });

  it('computes derived values', () => {
    const svc = createSvc();
    const c = svc(counter)(3);

    expect(c.doubled()).toBe(6);

    c.increment();
    expect(c.doubled()).toBe(8);
  });
});
```

## Testing View Components

### Using test-utils.ts

For view tests, use the mock adapter:

```typescript
import { describe, it, expect } from 'vitest';
import { createElFactory } from './el';
import {
  createTestEnv,
  getTextContent,
  MockElement,
} from './test-utils';
import type { ElementRef } from './types';

describe('el primitive', () => {
  it('renders static content', () => {
    const { adapter, scopedEffect, createElementScope, onCleanup } = createTestEnv();
    const el = createElFactory({
      scopedEffect,
      adapter,
      createElementScope,
      onCleanup,
    });

    const ref = el('div').props({ className: 'test' })('Hello');
    const element = (ref.create() as ElementRef<MockElement>).element;

    expect(getTextContent(element)).toBe('Hello');
    expect(element.props.className).toBe('test');
  });
});
```

### Testing Reactive Props

```typescript
it('updates props reactively', () => {
  const { adapter, scopedEffect, createElementScope, onCleanup } = createTestEnv();
  const el = createElFactory({ scopedEffect, adapter, createElementScope, onCleanup });
  const { signal, computed } = createSignals();

  const isDisabled = signal(false);

  const ref = el('button').props({
    disabled: isDisabled,
  })('Click');

  const element = (ref.create() as ElementRef<MockElement>).element;

  expect(element.props.disabled).toBe(false);

  isDisabled(true);
  expect(element.props.disabled).toBe(true);
});
```

### Testing Children

```typescript
it('renders reactive children', () => {
  const { adapter, scopedEffect, createElementScope, onCleanup } = createTestEnv();
  const el = createElFactory({ scopedEffect, adapter, createElementScope, onCleanup });
  const { signal, computed } = createSignals();

  const name = signal('World');
  const ref = el('div')(computed(() => `Hello, ${name()}!`));

  const element = (ref.create() as ElementRef<MockElement>).element;

  expect(getTextContent(element)).toBe('Hello, World!');

  name('Lattice');
  expect(getTextContent(element)).toBe('Hello, Lattice!');
});
```

## Testing Modules

```typescript
import { describe, it, expect } from 'vitest';
import { compose } from '@lattice/lattice';
import { MyModule } from './my-module';

describe('MyModule', () => {
  it('provides expected API', () => {
    const svc = compose(MyModule);

    expect(typeof svc.myFeature).toBe('object');
    expect(typeof svc.myFeature.doSomething).toBe('function');
  });

  it('integrates with dependencies', () => {
    const svc = compose(MyModule, DependencyModule);

    const result = svc.myFeature.compute();
    expect(result).toBe(expectedValue);
  });
});
```

## Common Patterns

### Spy on Functions

```typescript
it('calls handler on click', () => {
  const handleClick = vi.fn();
  const ref = el('button').props({ onclick: handleClick })('Click');
  const element = (ref.create() as ElementRef<MockElement>).element;

  // Simulate click
  element.props.onclick?.();

  expect(handleClick).toHaveBeenCalledTimes(1);
});
```

### Test Cleanup

```typescript
it('cleans up on dispose', () => {
  const cleanup = vi.fn();
  const value = signal(0);

  const dispose = effect(() => {
    value();
    return cleanup;
  });

  expect(cleanup).not.toHaveBeenCalled();

  dispose();
  expect(cleanup).toHaveBeenCalledTimes(1);
});
```

### Async Tests

```typescript
it('handles async operations', async () => {
  const result = signal<string | null>(null);

  await someAsyncOperation();
  result('done');

  expect(result()).toBe('done');
});
```

## Running Tests

```bash
# All tests
pnpm test

# Specific package
pnpm --filter @lattice/signals test

# Specific file
pnpm --filter @lattice/signals test src/computed.test.ts

# Specific test name
pnpm --filter @lattice/signals test -- "should handle diamond"

# Watch mode
pnpm --filter @lattice/signals test --watch
```

## File Naming

- Test files: `*.test.ts` (co-located with source)
- Test utilities: `test-utils.ts`, `test-setup.ts`, `test-helpers.ts`
