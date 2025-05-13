# Test Isolation Patterns

This document outlines recommended patterns for improving test isolation in the Lattice module. These patterns will be implemented during the next phase of development to address potential test interdependencies.

## Context Object Factories

### Problem
The context tracking objects (`DeriveContext`, `DispatchContext`, `MutateContext`) in tools.ts are global singletons with mutable state that can leak between tests.

### Recommended Pattern

```typescript
// Instead of global singletons:
export const DeriveContext = {
  inState: false,
  inView: false,
  /* methods */
};

// Use a factory function that returns a fresh instance for each test:
export function createDeriveContext() {
  return {
    inState: false, 
    inView: false,
    checkState() { /* implementation */ },
    runInState<T>(fn: () => T): T { /* implementation */ },
    runInView<T>(fn: () => T): T { /* implementation */ }
  };
}

// In test setup:
let deriveContext: ReturnType<typeof createDeriveContext>;

beforeEach(() => {
  deriveContext = createDeriveContext();
});
```

## Function Dependency Injection

### Problem
Tests directly replace global functions (`derive`, `dispatch`, `mutate`) without proper restoration guarantees.

### Recommended Pattern

```typescript
// Instead of direct function replacement:
// @ts-ignore
derive = mockDerive;  // Bad: global replacement

// Use dependency injection:
type DeriveFunction = <M, K extends keyof M, R>(source: M, key: K, transform?: (value: M[K]) => R) => R;

function testWithMockedDerive(mockDeriveImpl: DeriveFunction, testFn: () => void) {
  const originalDerive = derive;
  try {
    // @ts-ignore - Local replacement within controlled scope
    derive = mockDeriveImpl;
    testFn();
  } finally {
    // @ts-ignore - Always restore, even if test fails
    derive = originalDerive;
  }
}

// Usage:
it('should use derive', () => {
  const mockDerive = vi.fn().mockReturnValue(42);
  testWithMockedDerive(mockDerive, () => {
    // Test code that uses derive
    expect(mockDerive).toHaveBeenCalledWith(/* args */);
  });
});
```

## Consistent Cleanup with afterEach

### Problem
Not all test files have proper cleanup in `afterEach` handlers, which can lead to state leakage.

### Recommended Pattern

```typescript
describe('Module tests', () => {
  // Set up spies and mocks
  beforeEach(() => {
    vi.spyOn(DeriveContext, 'checkState');
    vi.spyOn(globalThis, 'checkDirectPropertyAssignment');
  });

  // Clean up ALL spies and mocks
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    // Reset any global state
    DeriveContext.inState = false;
    DeriveContext.inView = false;
  });

  // Tests...
});
```

## Scoped Mocks vs. Module Mocks

### Problem
Module-level mocks in create.ts affect all tests in the file and potentially other tests.

### Recommended Pattern

```typescript
// Instead of module-level mocks:
vi.mock('./validate', () => ({
  validatePreparedComponent: vi.fn(),
  // ...
}));

// Use scoped mocks with proper isolation:
describe('createLattice', () => {
  let validateMock: jest.SpyInstance;
  
  beforeEach(() => {
    // Create a fresh mock for each test
    validateMock = vi.spyOn(validateModule, 'validatePreparedComponent')
      .mockImplementation((component) => component);
  });
  
  afterEach(() => {
    validateMock.mockRestore();
  });
  
  it('should validate components', () => {
    // Test with locally scoped mock
    expect(validateMock).toHaveBeenCalled();
  });
});
```

## Factory for Test Fixtures

### Problem
Test fixtures are created inline in each test, leading to duplication and potential inconsistencies.

### Recommended Pattern

```typescript
// Create factory functions for common test fixtures
function createMockLattice(overrides = {}) {
  return {
    name: 'test-lattice',
    model: createMockPrepared(MODEL_INSTANCE_BRAND),
    state: createMockPrepared(STATE_INSTANCE_BRAND),
    actions: createMockPrepared(ACTIONS_INSTANCE_BRAND),
    view: {
      main: createMockPrepared(VIEW_INSTANCE_BRAND)
    },
    ...overrides
  };
}

// Usage
it('should validate a lattice', () => {
  const validLattice = createMockLattice();
  const invalidLattice = createMockLattice({
    model: createMockUnprepared(MODEL_INSTANCE_BRAND)
  });
  
  // Test with consistent fixtures
});
```

## Implementation Note

These patterns will be applied during the implementation phase, not during the current TDD phase. For now, we will keep tests in their current state to demonstrate the expected failures. These patterns are documented here for future reference.