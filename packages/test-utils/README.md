# @lattice/test-utils

Test utilities for Lattice components that work WITH the architecture, not around it.

## Installation

```bash
npm install --save-dev @lattice/test-utils
```

## Overview

This package provides compositional test utilities that properly execute Lattice slice factories and resolve select() markers, making it easy to test Lattice components without fighting the framework.

## Key Features

- **Test Adapter**: Executes slice factories and resolves select() markers
- **Component Testing**: Easy helpers for testing complete components
- **Slice Testing**: Test individual slices in isolation
- **Model Testing**: Test model factories and mutations
- **View Testing**: Test view outputs and interactions

## Usage

### Testing a Complete Component

```typescript
import { createComponentTest } from '@lattice/test-utils';
import { counter } from './counter';

const test = createComponentTest(counter);

// Get current state
expect(test.getState().count).toBe(0);

// Execute actions
const actions = test.getActions();
actions.increment();
expect(test.getState().count).toBe(1);

// Test views
const view = test.getView('display');
expect(view.textContent).toBe('Count: 1');
```

### Testing Individual Slices

```typescript
import { testSlice } from '@lattice/test-utils';

const slice = createSlice(model, (m) => ({
  doubled: m.count * 2
}));

const { getResult, setState } = testSlice({ count: 5 }, slice);

expect(getResult()).toEqual({ doubled: 10 });

setState({ count: 10 });
expect(getResult()).toEqual({ doubled: 20 });
```

### Testing Models

```typescript
import { testModel } from '@lattice/test-utils';

const { model, store } = testModel(counterModel);

expect(model.count).toBe(0);
model.increment();
expect(store.getState().count).toBe(1);
```

### Testing Views

```typescript
import { testView } from '@lattice/test-utils';

const { getViewOutput, executeAction } = testView(todoList, 'filteredTodos');

expect(getViewOutput().count).toBe(2);

executeAction('setFilter', 'active');
expect(getViewOutput().count).toBe(1);
```

## API Reference

### `createComponentTest(componentFactory)`
Creates a test harness for a complete component.

### `testSlice(initialState, sliceFactory)`
Tests a single slice in isolation.

### `testModel(modelFactory)`
Tests a model factory with mutations.

### `testView(componentFactory, viewName)`
Tests view outputs and interactions.

### `waitForState(store, predicate, timeout?)`
Waits for state to match a predicate (useful for async operations).

### `createSnapshot(value)`
Creates a JSON snapshot for comparison testing.

## How It Works

The test adapter properly executes slice factories by:

1. Creating a test store that implements the minimal adapter interface
2. Executing slice factories with the current state
3. Recursively resolving select() markers in slice results
4. Caching results for performance (with cache invalidation on state changes)

This approach works WITH Lattice's compositional architecture, not around it.