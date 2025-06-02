# Task: Implement API Parameter for Middleware Support

## Overview

Add the `api` parameter to all slice factories to enable the unified middleware system. This allows both composition middleware and runtime middleware to work together seamlessly.

## Approach

We'll use an incremental approach with backwards compatibility initially, then make a breaking change in a major version.

## Phase 1: Foundation (No Breaking Changes)

### 1.1 Update Core Types
**File**: `packages/core/src/index.ts`

- [ ] Add `AdapterAPI` interface
- [ ] Update `SliceFactory` type to include optional `api` parameter
- [ ] Export `AdapterAPI` type

```typescript
export interface AdapterAPI<Model> {
  executeSlice: <T>(sliceFactory: SliceFactory<Model, T>) => T;
  getState: () => Model;
}

// Make api optional initially for backward compatibility
export type SliceFactory<Model, Slice> = (
  model: Model, 
  api?: AdapterAPI<Model>
) => Slice;
```

### 1.2 Create Test Adapter with API
**File**: `packages/test-utils/src/test-adapter.ts`

- [ ] Update `TestAdapter` to create and pass API object
- [ ] Add test-specific API methods for testing middleware
- [ ] Ensure backward compatibility with existing tests

```typescript
const testApi: AdapterAPI<Model> = {
  executeSlice,
  getState,
  // Test helpers
  _calls: [],
  _log: (action, data) => testApi._calls.push({ action, data })
};
```

## Phase 2: Prove the Pattern

### 2.1 Update Memory Adapter
**File**: `packages/adapter-memory/src/index.ts`

- [ ] Create API object in adapter
- [ ] Update `executeSliceFactory` to pass API
- [ ] Handle computed views (inject API as last param)
- [ ] Add memory-specific API methods (`reset`, `snapshot`)

### 2.2 Write Comprehensive Tests
**Files**: Various `*.test.ts` files

- [ ] Test slice factories receiving API parameter
- [ ] Test computed views with API injection
- [ ] Test backward compatibility (missing API param)
- [ ] Test middleware patterns
- [ ] Test adapter-specific API methods

## Phase 3: Production Adapters

### 3.1 Update Zustand Adapter
**File**: `packages/adapter-zustand/src/index.ts`

- [ ] Create Zustand API with `subscribe` method
- [ ] Update slice execution to include API
- [ ] Update view processing for computed views
- [ ] Test with React hooks

### 3.2 Update Redux Adapter
**File**: `packages/adapter-redux/src/index.ts`

- [ ] Create Redux API with `dispatch` method
- [ ] Update slice execution to include API
- [ ] Update view processing for computed views
- [ ] Test with Redux DevTools integration

## Phase 4: Documentation & Examples

### 4.1 Update Examples
**Files**: `packages/examples/src/apps/*.tsx`

- [ ] Update todo app to use computed views
- [ ] Add example using API for logging
- [ ] Add example of middleware composition
- [ ] Show adapter-specific API usage

### 4.2 Update Core Documentation
**Files**: Various `*.md` files

- [ ] Update README with API parameter examples
- [ ] Update adapter documentation
- [ ] Add migration guide for existing users
- [ ] Update TypeScript examples

## Phase 5: Breaking Change

### 5.1 Make API Required
**File**: `packages/core/src/index.ts`

- [ ] Remove optional `?` from API parameter
- [ ] Update all type definitions
- [ ] Bump major version in all packages

```typescript
// Final type - api is required
export type SliceFactory<Model, Slice> = (
  model: Model, 
  api: AdapterAPI<Model>  // No longer optional
) => Slice;
```

### 5.2 Remove Backward Compatibility
**Files**: All adapters

- [ ] Remove any compatibility checks
- [ ] Clean up optional chaining for API
- [ ] Update all tests to assume API present

## Testing Checklist

For each adapter, verify:

- [ ] Actions receive API parameter
- [ ] Static views work with API available
- [ ] Computed views receive API as last parameter
- [ ] Adapter-specific API methods work
- [ ] Middleware can enhance the API
- [ ] TypeScript types are correct
- [ ] No runtime errors with existing code

## Success Criteria

- [ ] All adapters pass their test suites
- [ ] Examples demonstrate new capabilities
- [ ] Documentation is complete and clear
- [ ] Migration path is documented
- [ ] TypeScript compilation has no errors
- [ ] Backward compatibility works (Phase 1-4)
- [ ] Clean break in Phase 5

## Code Review Checklist

Before merging each phase:

- [ ] All tests pass
- [ ] TypeScript types are correct
- [ ] Documentation is updated
- [ ] Examples work correctly
- [ ] No console warnings/errors
- [ ] API is consistent across adapters

## Notes

- Consider creating a feature branch for all changes
- Run full test suite after each phase
- Get code review after Phase 2 (pattern validation)
- Announce breaking change before Phase 5
- Consider beta release before Phase 5