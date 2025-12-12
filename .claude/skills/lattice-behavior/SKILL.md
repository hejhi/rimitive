---
name: lattice-behavior
description: Create headless behaviors in Lattice. Use when creating reusable state logic, hooks, or headless UI patterns like toggles, forms, disclosure, or any portable reactive logic.
---

# Creating Lattice Behaviors

Behaviors are portable functions that encapsulate reactive logic without UI. They follow a specific three-level pattern.

## The Pattern

```typescript
type SignalsSvc = {
  signal: <T>(initial: T) => Writable<T>;
  computed: <T>(fn: () => T) => Readable<T>;
  effect: (fn: () => void | (() => void)) => () => void;
};

const behaviorName = (svc: SignalsSvc) => (options?: Options) => {
  // Create reactive state with svc.signal()
  // Derive values with svc.computed()
  // Set up effects with svc.effect()
  // Return the public API
  return { /* signals, computeds, actions */ };
};
```

Three levels:
1. **Service injection**: `(svc) =>` — receives signal primitives
2. **Factory**: `(options?) =>` — configures the instance
3. **API**: `{ ... }` — the reactive interface consumers use

## Instructions

1. **Define the options type** (if needed):
   ```typescript
   type CounterOptions = {
     initial?: number;
     min?: number;
     max?: number;
   };
   ```

2. **Create signals for internal state**:
   ```typescript
   const count = svc.signal(opts.initial ?? 0);
   ```

3. **Create computeds for derived values**:
   ```typescript
   const doubled = svc.computed(() => count() * 2);
   const canIncrement = svc.computed(() => count() < (opts.max ?? Infinity));
   ```

4. **Create effects for side effects** (cleanup is returned):
   ```typescript
   svc.effect(() => {
     console.log('Count changed:', count());
     return () => console.log('Cleanup');
   });
   ```

5. **Return the public API**:
   - Expose signals consumers need to read/write
   - Expose computeds for derived state
   - Expose action functions for mutations

## Derived Actions Pattern

For simple behaviors with one primary signal, attach actions directly:

```typescript
const toggle = (svc: SignalsSvc) => (initial = false) => {
  const value = svc.signal(initial);
  return Object.assign(value, {
    on: () => value(true),
    off: () => value(false),
    toggle: () => value(v => !v),
  });
};
```

## Composition

Behaviors can use other behaviors:

```typescript
const dropdown = (svc: SignalsSvc) => (options?: { initialOpen?: boolean }) => {
  // Compose the disclosure behavior
  const disc = disclosure(svc)(options?.initialOpen ?? false);

  // Add keyboard handling
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') disc.close();
  };

  return {
    ...disc,
    triggerProps: svc.computed(() => ({
      ...disc.triggerProps(),
      onkeydown: onKeyDown,
    })),
  };
};
```

## File Location

Place behaviors in a `behaviors/` directory:
- `packages/examples/*/src/behaviors/` for examples
- `packages/headless/src/` for the headless package
- Or co-locate with components that use them

## Naming Conventions

Choose one consistently:
- Plain: `counter`, `disclosure`, `pagination`
- `use` prefix: `useCounter`, `useDisclosure` (familiar to React users)
- `create` prefix: `createCounter` (emphasizes factory nature)

## Testing

Behaviors are trivial to test—no DOM needed:

```typescript
import { compose } from '@lattice/lattice';
import { SignalModule, ComputedModule, EffectModule } from '@lattice/signals/extend';

const createTestSvc = () => compose(SignalModule, ComputedModule, EffectModule);

it('increments', () => {
  const svc = createTestSvc();
  const c = counter(svc)(5);

  expect(c.count()).toBe(5);
  c.increment();
  expect(c.count()).toBe(6);
});
```

## Common Patterns

- **Toggle**: boolean with on/off/toggle
- **Disclosure**: open/close state with ARIA props
- **Field**: value + touched + error for forms
- **Pagination**: currentPage, totalPages, hasNext, hasPrev
- **Selection**: selected items in a list
- **Async Action**: pending/error/result for mutations
