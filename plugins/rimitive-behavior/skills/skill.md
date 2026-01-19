---
name: rimitive-behavior
description: Create headless behaviors in Rimitive. Use when creating reusable state logic, hooks, or headless UI patterns like toggles, forms, disclosure, or any portable reactive logic.
---

# Creating Rimitive Behaviors

A **behavior** is a portable function that encapsulates reactive logic without any UI. It receives a service, returns a factory, and that factory returns an API of signals, computeds, and actions.

Think of behaviors as headless components—all the state and logic, none of the markup.

**Important:** Behaviors run once. They are not reactive closures—there's no re-rendering or re-execution at the function level. All reactivity is encapsulated in the primitives (`signal`, `computed`, `effect`). The function creates the reactive graph once; signals handle updates from there.

---

## The Simple Approach

The easiest way to create a behavior is to import primitives directly from your service:

```typescript
// behaviors/useCounter.ts
import { signal, computed } from '../service';

export const useCounter = (initial = 0) => {
  const count = signal(initial);
  const doubled = computed(() => count() * 2);

  return {
    count,
    doubled,
    increment: () => count(count() + 1),
    decrement: () => count(count() - 1),
    reset: () => count(initial),
  };
};
```

Use it anywhere:

```typescript
import { useCounter } from './behaviors/useCounter';

const counter = useCounter(10);
counter.increment();
counter.count();  // 11
```

This works great for simple cases when you have a single app context.

---

## The Portable Pattern

When you need behaviors that work across different contexts—testing with mocks, sharing between apps, or SSR—use the portable pattern.

```typescript
const behaviorName = (svc: SignalsSvc) => (options?) => {
  // Create state
  // Return API
};
```

Three levels:
1. **Service injection**: `(svc) =>` — receives primitives
2. **Factory**: `(options?) =>` — configures the instance
3. **API**: `{ ... }` — the reactive interface consumers use

### Counter Behavior

```typescript
type SignalsSvc = {
  signal: <T>(initial: T) => Writable<T>;
  computed: <T>(fn: () => T) => Readable<T>;
  effect: (fn: () => void | (() => void)) => () => void;
};

const counter = (svc: SignalsSvc) => (initial = 0) => {
  const { signal, computed } = svc;

  const count = signal(initial);
  const doubled = computed(() => count() * 2);

  return {
    count,
    doubled,
    increment: () => count(count() + 1),
    decrement: () => count(count() - 1),
    reset: () => count(initial),
  };
};
```

### Using It

```typescript
import { svc } from './service';

const useCounter = svc(counter);

const c = useCounter(10);
c.count();      // 10
c.increment();
c.count();      // 11
c.doubled();    // 22
```

`svc(counter)` injects the service. The caller just provides options.

---

## Composing Behaviors

Behaviors can use other behaviors. This is where the pattern shines.

### Disclosure (open/close)

```typescript
const disclosure = (svc: SignalsSvc) => (initialOpen = false) => {
  const { signal, computed } = svc;
  const isOpen = signal(initialOpen);

  return {
    isOpen,
    open: () => isOpen(true),
    close: () => isOpen(false),
    toggle: () => isOpen(!isOpen()),
    triggerProps: computed(() => ({
      'aria-expanded': String(isOpen()),
    })),
    contentProps: computed(() => ({
      hidden: !isOpen(),
    })),
  };
};
```

### Dropdown (disclosure + keyboard)

```typescript
const dropdown = (svc: SignalsSvc) => (options?: { initialOpen?: boolean }) => {
  const disc = disclosure(svc)(options?.initialOpen ?? false);

  const onKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        disc.close();
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        disc.toggle();
        break;
    }
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

### Modal (disclosure + focus trap + scroll lock)

```typescript
const modal = (svc: SignalsSvc) => (options?: { initialOpen?: boolean }) => {
  const { signal, effect } = svc;

  const disc = disclosure(svc)(options?.initialOpen ?? false);
  const previousFocus = signal<HTMLElement | null>(null);

  effect(() => {
    if (disc.isOpen()) {
      previousFocus(document.activeElement as HTMLElement);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      previousFocus()?.focus();
    }
  });

  return {
    ...disc,
    backdropProps: svc.computed(() => ({
      onclick: disc.close,
    })),
    contentProps: svc.computed(() => ({
      ...disc.contentProps(),
      onclick: (e: Event) => e.stopPropagation(),
    })),
  };
};
```

---

## Behaviors with Options

Use options for configuration:

```typescript
type PaginationOptions = {
  totalItems: number;
  pageSize?: number;
  initialPage?: number;
};

const pagination = (svc: SignalsSvc) => (options: PaginationOptions) => {
  const { signal, computed } = svc;

  const pageSize = options.pageSize ?? 10;
  const currentPage = signal(options.initialPage ?? 1);

  const totalPages = computed(() =>
    Math.ceil(options.totalItems / pageSize)
  );

  const hasNext = computed(() => currentPage() < totalPages());
  const hasPrev = computed(() => currentPage() > 1);

  return {
    currentPage,
    totalPages,
    hasNext,
    hasPrev,
    next: () => hasNext() && currentPage(currentPage() + 1),
    prev: () => hasPrev() && currentPage(currentPage() - 1),
    goTo: (page: number) => {
      if (page >= 1 && page <= totalPages()) {
        currentPage(page);
      }
    },
  };
};
```

---

## Behaviors with Reactive Options

When options need to be reactive, accept signals:

```typescript
import type { Readable } from '@rimitive/signals';

type SearchOptions = {
  query: Readable<string>;
  debounceMs?: number;
};

const search = (svc: SignalsSvc) => (options: SearchOptions) => {
  const { signal, computed, effect } = svc;

  const results = signal<SearchResult[]>([]);
  const isSearching = signal(false);

  let timeoutId: number | undefined;

  effect(() => {
    const q = options.query();

    clearTimeout(timeoutId);

    if (!q) {
      results([]);
      return;
    }

    isSearching(true);

    timeoutId = window.setTimeout(async () => {
      const data = await performSearch(q);
      results(data);
      isSearching(false);
    }, options.debounceMs ?? 300);
  });

  return {
    results,
    isSearching,
    resultCount: computed(() => results().length),
  };
};
```

---

## Using Behaviors in React

Behaviors work in React via `@rimitive/react`:

```typescript
import { SignalProvider, createHook, useSubscribe } from '@rimitive/react';
import { compose } from '@rimitive/core';
import { SignalModule, ComputedModule, EffectModule } from '@rimitive/signals/extend';

// Create hooks from behaviors
const useCounter = createHook(counter);
const useDisclosure = createHook(disclosure);

function ReactDropdown() {
  const disc = useDisclosure(false);

  // Subscribe to signals for React re-renders
  const isOpen = useSubscribe(disc.isOpen);
  const triggerProps = useSubscribe(disc.triggerProps);

  return (
    <div>
      <button {...triggerProps} onClick={disc.toggle}>
        Toggle
      </button>
      {isOpen && <div>Dropdown content</div>}
    </div>
  );
}

// Wrap app with provider
const svc = compose(SignalModule, ComputedModule, EffectModule);

function App() {
  return (
    <SignalProvider svc={svc}>
      <ReactDropdown />
    </SignalProvider>
  );
}
```

**Note:** In React, use `useSubscribe(signal)` to read signal values and trigger re-renders. Calling `signal()` directly won't cause React to update.

---

## When to Use Behaviors

**Good candidates:**
- State that multiple components share (disclosure, selection, pagination)
- Complex state logic (forms, wizards, data fetching)
- Reusable interaction patterns (drag-and-drop, keyboard navigation)
- Anything you'd put in a custom hook in React

**Not necessary for:**
- One-off component state (just use signals directly)
- Pure presentation logic (no state to manage)
- Framework-specific integrations

---

## Testing Behaviors

Behaviors are trivial to test—no DOM, no framework:

```typescript
import { describe, it, expect } from 'vitest';
import { compose } from '@rimitive/core';
import { SignalModule, ComputedModule, EffectModule } from '@rimitive/signals/extend';

describe('counter', () => {
  const createTestSvc = () => compose(SignalModule, ComputedModule, EffectModule);

  it('increments and decrements', () => {
    const svc = createTestSvc();
    const c = counter(svc)(5);

    expect(c.count()).toBe(5);

    c.increment();
    expect(c.count()).toBe(6);

    c.decrement();
    c.decrement();
    expect(c.count()).toBe(4);
  });

  it('computes doubled', () => {
    const svc = createTestSvc();
    const c = counter(svc)(3);

    expect(c.doubled()).toBe(6);

    c.increment();
    expect(c.doubled()).toBe(8);
  });
});
```

Pure functions, pure tests.

---

## Naming Conventions

Choose one consistently:

- Plain: `counter`, `disclosure`, `pagination`
- `use` prefix: `useCounter`, `useDisclosure` (familiar to React users)
- `create` prefix: `createCounter` (emphasizes factory nature)

The `use` prefix doesn't mean React hooks. There's no magic—behaviors are plain functions.

---

## Common Patterns

- **Toggle**: boolean with on/off/toggle
- **Disclosure**: open/close state with ARIA props
- **Field**: value + touched + error for forms
- **Pagination**: currentPage, totalPages, hasNext, hasPrev
- **Selection**: selected items in a list
- **Async Action**: pending/error/result for mutations
