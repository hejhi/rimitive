# Lattice TDD Implementation Plan

This document outlines the Test-Driven Development approach for implementing the
Lattice component framework. Each section lists testable tasks derived from the
draft specification.

## 1. Core Factory Helpers and Middleware

### `withStoreSync` Middleware

- ✅ Test that it properly subscribes to all provided stores
  - Implemented in: `/packages/core/src/tests/withStoreSync.test.ts`
  - Verifies: subscription to source stores, cleanup handling
- ✅ Test that it correctly updates target store when source stores change
  - Implemented in: `/packages/core/src/tests/withStoreSync.test.ts`
  - Verifies: reactivity to source store changes
- ✅ Test that it initializes with the correct selected values from source
  stores
  - Implemented in: `/packages/core/src/tests/withStoreSync.test.ts`
  - Verifies: proper initial synchronization
- ✅ Test with multiple source stores to verify proper synchronization
  - Implemented in: `/packages/core/src/tests/withStoreSync.test.ts`
  - Verifies: handling multiple store dependencies simultaneously
- Test with complex selector functions to verify data transformation
- Test performance with many rapid store updates
- ✅ Implement main withStoreSync middleware
  - Implemented in: `/packages/core/src/withStoreSync.ts` and
    `/packages/core/src/index.ts`
  - Ensures: proper store synchronization according to draft spec
  - Key learnings:
    - Subscription management is critical for proper cleanup
    - Type safety requires careful generic parameter handling
    - Initial state must be properly synchronized before returning

### `withLattice` Middleware

- ✅ Test merging of API objects from base lattice and config
  - Implemented in: `/packages/core/src/tests/withLattice.test.ts`
  - Verifies: proper merging of API objects
- ✅ Test combining of hooks from base lattice and config
  - Implemented in: `/packages/core/src/tests/withLattice.test.ts`
  - Verifies: hooks from base and config are merged correctly
- ✅ Test proper merging of props objects with special merge logic
  - Implemented in: `/packages/core/src/tests/withLattice.test.ts`
  - Verifies: props are merged using mergeProps utility
- ✅ Test preservation of the `use` method from base lattice
  - Implemented in: `/packages/core/src/tests/withLattice.test.ts`
  - Verifies: use method is preserved during lattice composition
- ✅ Test with empty config objects to verify defaults
  - Implemented in: `/packages/core/src/tests/withLattice.test.ts`
  - Verifies: default values are applied when properties are missing
- Test merging complex nested structures

### `createAPI` Utility

- ✅ Test creation of API store with basic config
  - Implemented in: `/packages/core/src/tests/createAPI.test.ts`
  - Verifies: store structure, state access, mutation functionality, hooks
    interface
  - Key learnings:
    - Need to retrieve latest state after mutations (Zustand state is immutable)
    - Hooks system needs initialization before API exposure
    - Type safety is important for _hooks property
- ✅ Implement proper type definitions for createAPI
  - Implemented in: `/packages/core/src/types.ts`
  - Ensures compatibility with Zustand's type system
  - Eliminates use of `any` types for better developer experience
- ✅ Extract createAPI to dedicated module
  - Implemented in: `/packages/core/src/createAPI.ts`
  - Improves code organization and maintainability
- ✅ Test wrapping config with middleware (e.g., withStoreSync)
  - Implemented in: `/packages/core/src/tests/createAPI.test.ts`
  - Verifies: createAPI can accept configuration wrapped with withStoreSync
    middleware
  - Confirms that properties synchronized from source stores are correctly
    accessible
  - Validates that changes to source stores properly propagate to the API state
- ✅ Test hooks system initialization and attachment to store
  - Implemented in: `/packages/core/src/tests/createAPI.test.ts`
  - Verifies: hooks system is properly integrated with API methods
  - Ensures hooks execute when API methods are called
- ✅ Test clean interface exposure with hooks.before and hooks.after
- ✅ Test API immutability (functions can't be directly modified)
  - Implemented in: `/packages/core/src/tests/createAPI.test.ts`
  - Verifies: API methods cannot be overwritten after creation
  - Uses Object.defineProperty to make methods non-writable and non-configurable
  - Ensures API security by preventing malicious function replacement

### `createProps` Utility

- ✅ Test simple case: createProps with just partName and config
  - Implemented in: `/packages/core/src/tests/createProps.test.ts`
  - Verifies: store structure, get method functionality, props object
  - Key learnings:
    - Store should include partName for reference and future extensions
    - Type safety requires careful handling of the various parameter patterns
    - Factory function pattern (get method) provides flexibility for props
      creation
- ✅ Implement createProps utility and test basic functionality
  - Implemented in: `/packages/core/src/createProps.ts`
  - Handles multiple signature patterns:
    - Case 1: createProps(partName, config) - Simple case with direct config
    - Case 2: createProps(partName, middleware, config) - With middleware
      function
    - Case 3: createProps(partName, dependencies, config) - With store
      dependencies
    - Case 4: createProps(partName) or createProps(partName, {}, config) -
      Default case
  - Key implementations:
    - Preserves partName in all cases for reference
    - Handles both simple and complex dependency patterns
    - Integrates with withStoreSync for store dependency cases
- Test with dependencies as middleware function (e.g., withStoreSync)
- Test with store dependencies object (withStoreSync case)
- Test with empty config to verify defaults
- Test reactivity of returned props to store changes

### `createLattice` Utility

- ✅ Test creation with minimal config (just name)
  - Implemented in: `/packages/core/src/tests/createLattice.test.ts`
  - Verifies: lattice created with just a name has default properties
- ✅ Test with complete config (api, hooks, props, use)
  - Implemented in: `/packages/core/src/tests/createLattice.test.ts`
  - Verifies: all properties are correctly assigned
- ✅ Test default empty values for missing config sections
  - Implemented in: `/packages/core/src/tests/createLattice.test.ts`
  - Verifies: missing properties get default values
- ✅ Test name assignment and preservation
  - Implemented in: `/packages/core/src/tests/createLattice.test.ts`
  - Verifies: name is correctly assigned and accessible
- ✅ Test the structure of returned lattice object
  - Implemented in: `/packages/core/src/tests/createLattice.test.ts`
  - Verifies: returned object has all expected properties and methods

## 2. Lattice Composition

### Feature Composition

- ✅ Test creation of feature enhancers
  - Implemented in: `/packages/core/src/tests/composition.test.ts`
  - Verifies: feature enhancers follow the pattern in the spec
- ✅ Test applying enhancers to base lattice
  - Implemented in: `/packages/core/src/tests/composition.test.ts`
  - Verifies: enhancers properly modify the base lattice
- Test selection state management (add/remove/query selected items)
- Test multi-selection with modifier flag
- Test reactivity of feature state
- ✅ Test integration with multiple features
  - Implemented in: `/packages/core/src/tests/composition.test.ts`
  - Verifies: multiple features can be composed together

### Complex Feature Examples

- Test creation of drag and drop feature
- Test applying drag and drop to base lattice
- Test drag state management (drag start, in-progress, end)
- Test drop target validation
- Test actual drop operation success/failure
- Test integration of selection with drag and drop
- Test hook registration for feature events

### Composition Patterns

- ✅ Test chaining multiple feature enhancements (.use().use())
  - Implemented in: `/packages/core/src/tests/composition.test.ts`
  - Verifies: multiple features can be chained
- ✅ Test order dependency of features
  - Implemented in: `/packages/core/src/tests/composition.test.ts`
  - Verifies: the order of composition affects the result
- Test isolation between different lattice instances
- Test cross-communication between features via hooks
- Test error handling during feature application

## 3. 🦕 Props System [LEGACY: SEE SECTION 8]

> **Note on ARIA Attributes**: The Lattice framework provides structure for
> managing props and facilitating accessibility, but does not automatically
> include ARIA attributes. It is the developer's responsibility to explicitly
> add appropriate ARIA attributes based on component state.

- ✅ Test creation of props for various UI parts
  - Implemented in: `/packages/core/src/tests/createProps.test.ts`
  - Verifies: props factory correctly generates UI attributes
- ✅ Test props structure with manually added ARIA attributes
  - Implemented in: `/packages/core/src/tests/createProps.test.ts`
  - Verifies: user-defined ARIA attributes are properly included and reactive to
    state
- ✅ Test reactivity of props to state changes
  - Implemented in: `/packages/core/src/tests/createProps.test.ts`
  - Verifies: props update correctly when underlying state changes
- ✅ Test props function parameters (id, context, etc.)
  - Implemented in: `/packages/core/src/tests/createProps.test.ts`
  - Verifies: get method properly uses parameters to construct props
- ✅ Test merging of props from multiple composed features
  - Implemented in: `/packages/core/src/tests/createProps.test.ts`
  - Verifies: props from multiple sources can be merged correctly
- Test resolution of conflicting props (precedence rules)
- Test performance with deeply nested props objects

## 4. Instance-based Architecture

- Test creating multiple independent instances
- Test state isolation between instances
- Test applying different features to different instances
- Test instance-specific hook registrations
- Test that modifying one instance doesn't affect others
- Test memory usage with many instances

## 5. Hooks System

- ✅ Implement hooks system with before/after methods
  - Implemented in: `/packages/core/src/createHooks.ts`
  - Includes proper type definitions in `/packages/core/src/types.ts`
  - Provides clean interface for registering hooks
- ✅ Test registration of before/after hooks for API methods
  - Implemented in: `/packages/core/src/tests/createHooks.test.ts`
  - Verifies: proper registration and storage of hook callbacks
  - Ensures hooks are stored in registration order
- ✅ Test hook execution order with multiple registered hooks
  - Implemented in: `/packages/core/src/tests/createHooks.test.ts`
  - Verifies: hooks execute in registration order
  - Ensures proper calling sequence of before/after hooks
- ✅ Test hook parameters (method arguments) passed correctly
  - Implemented in: `/packages/core/src/tests/createHooks.test.ts` and
    `/packages/core/src/tests/createAPI.test.ts`
  - Verifies: arguments are correctly passed to hooks
  - Confirms original API method arguments are preserved
- ✅ Test hook return values affecting execution flow
  - Implemented in: `/packages/core/src/tests/createHooks.test.ts` and
    `/packages/core/src/tests/createAPI.test.ts`
  - Verifies: before hooks can modify arguments
  - Verifies: after hooks can modify return values
- ✅ Test error handling in hooks
  - Implemented in: `/packages/core/src/tests/createHooks.test.ts`
  - Verifies: errors thrown in hooks propagate correctly
  - Ensures error handling doesn't cause side effects
- ✅ Test removing hooks
  - Implemented in: `/packages/core/src/tests/createHooks.test.ts`
  - Verifies: hooks can be removed after registration
  - Ensures removal affects only the specific hook
- ✅ createAPI to fully integrate with hooks system
  - Implemented in: `/packages/core/src/createAPI.ts`
  - Added method wrapping to automatically execute hooks
  - Ensures hooks execute for every API method call

## 6. Integration Tests

- Test full lattice creation with multiple composed features
- Test React component consumption (useStore pattern)
- Test framework-agnostic pattern with adapters
- Test realistic tree view example with selection and DnD
- Test that props structure facilitates WCAG accessibility compliance when used
  correctly
- Test performance with complex real-world scenarios

## 7. Edge Cases and Reliability

- Test with invalid inputs to all core functions
- Test with empty/null/undefined values where appropriate
- Test circular dependencies between stores
- Test rapid state changes and race conditions
- Test memory leaks from lingering subscriptions

## 8. Props Architecture

### `createProps` Tests

- ✅ Test basic props creation with partName and config
  - Verify store structure includes partName metadata
  - Confirm get method returns proper props object
  - Check props include all attributes defined in config
  - Implemented in: `/packages/core/src/tests/createProps.test.ts`
  - Key learnings:
    - Store partName metadata both on the store object and in state
    - Type safety through generic params for props function parameters
    - Maintain clean interface with minimal dependencies

- ✅ Implement createProps with partName metadata
  - Implemented in: `/packages/core/src/createProps.ts`
  - Store partName in both the state and as a property of the store itself
  - Provide type-safe interfaces for props parameters and return values
  - Create flexible API that works with the new composition pattern

- ✅ Test props reactivity to state changes
  - Verify props update when underlying state changes
  - Implemented in: `/packages/core/src/tests/createProps.test.ts`
  - Confirmed that props automatically update when source stores change
  - Leveraged Zustand's built-in reactivity for efficient updates

- ✅ Test factory function behavior with different parameters
  - Verify params are correctly passed to get method
  - Test with simple and complex parameter objects
  - Validate proper handling of optional parameters
  - Implemented in: `/packages/core/src/tests/createProps.test.ts`
  - Demonstrated flexibility with various parameter patterns including optional
    values

### `withProps` Middleware Tests

- ✅ Create failing test for complex nested attribute merging
  - Implemented in: `/packages/core/src/tests/withProps.test.ts`
  - Verifies deep nested objects are properly merged
  - Tests that event handlers are properly composed
  - Ensures attribute precedence works correctly (overrides vs preserves)

- ✅ Implement withProps middleware with manual merging approach
  - Implemented in: `/packages/core/src/withProps.ts`
  - Provides access to base lattice props with matching partName
  - Allows manual merging of nested structures by users
  - Ensures type safety with proper TypeScript interfaces

- ✅ Test creation of middleware with base lattice
  - Verify middleware function signature and return value
  - Confirm middleware correctly forwards base lattice props

- ✅ Test base lattice props access in config callback
  - Verify third argument contains base lattice props
  - Test access to get method of base lattice props
  - Confirm proper namespacing of props from base lattice

- ✅ Test composition of multiple props objects
  - Verify props from base lattice and current config are merged
  - Confirm proper precedence (current config overrides base)

- ✅ Test event handler composition
  - Verify ability to call base handlers from overridden handlers
  - Test composition sequence is deterministic
  - Validate event propagation patterns

### Integration Tests

- Test composition through lattice architecture
  - Verify proper integration with withLattice middleware
  - Test full lattice creation with composed props
  - Validate props inheritance through lattice composition chain

- Test real-world usage patterns
  - Test selection feature using new props system
  - Verify drag-and-drop feature with props composition
  - Validate proper ARIA attribute management across composed features

## Progress Summary

### Completed

- Created basic project structure with TypeScript, Vitest, and Zustand
- Set up TDD workflow with test-setup.ts
- Implemented core types in `/packages/core/src/types.ts`
- Implemented createAPI utility in `/packages/core/src/createAPI.ts`
- Wrote and passed first test for createAPI in
  `/packages/core/src/tests/createAPI.test.ts`
- Improved type safety throughout createAPI implementation:
  - Added proper TypeScript interfaces for hooks system
  - Eliminated usage of `any` types
  - Ensured compatibility with Zustand's API
  - Properly typed state creator functions and store APIs
- Implemented withStoreSync middleware in `/packages/core/src/withStoreSync.ts`
  - Wrote and passed tests in `/packages/core/src/tests/withStoreSync.test.ts`
  - Added proper subscription and cleanup mechanisms
  - Integrated with the core Zustand pattern
  - Ensured type safety with generics
- Extracted createHooks to dedicated module in
  `/packages/core/src/createHooks.ts`
- Modularized the codebase for better organization:
  - Moved each core function to its own dedicated file
  - Updated index.ts to re-export from individual modules
  - Ensured proper imports/exports between modules
- Improved and refined type system:
  - Extracted shared StoreWithHooks type for consistent typing
  - Created StoreStateSelector type for cleaner store synchronization
  - Established proper type hierarchy (HooksSystem extends HooksInterface)
  - Reduced type duplication across modules
  - Improved type assertions throughout the codebase
- Implemented createProps utility in `/packages/core/src/createProps.ts`
  - Wrote and passed test in `/packages/core/src/tests/createProps.test.ts`
  - Implemented multiple signature patterns (simple, middleware, dependencies)
  - Included partName in state for future extensions
  - Integrated with withStoreSync for store dependency cases
- Implemented mergeProps utility in `/packages/core/src/mergeProps.ts`
  - Wrote and passed tests in `/packages/core/src/tests/mergeProps.test.ts`
  - Created a function to merge multiple props objects
  - Ensured proper precedence (later props override earlier ones)
- Implemented withLattice middleware in `/packages/core/src/withLattice.ts`
  - Wrote and passed tests in `/packages/core/src/tests/withLattice.test.ts`
  - Created a middleware for merging lattice configurations
  - Properly merged API objects, hooks, and props
  - Used the mergeProps utility for special props merging
- Implemented createLattice utility in `/packages/core/src/createLattice.ts`
  - Wrote and passed tests in `/packages/core/src/tests/createLattice.test.ts`
  - Created proper interfaces for Lattice and LatticeConfig
  - Added default implementations for all config options
  - Ensured proper type safety for the use method
- Fully implemented the hooks system in `/packages/core/src/createHooks.ts`
  - Wrote comprehensive tests in `/packages/core/src/tests/createHooks.test.ts`
  - Added support for hook registration, execution, and removal
  - Implemented argument and return value modification capabilities
  - Added proper error handling and propagation
  - Ensured hooks execute in registration order
- Integrated hooks system with createAPI in `/packages/core/src/createAPI.ts`
  - Extended API method calls to automatically execute hooks
  - Added tests for hook execution and modification capabilities
  - Ensured hooks can intercept and modify both arguments and results
  - Created a clean, declarative interface for registering hooks
- Implemented lattice composition in
  `/packages/core/src/tests/composition.test.ts`
  - Demonstrated feature pattern as described in spec
  - Verified chaining multiple features through the use() method
  - Tested order dependency of feature application
  - Ensured base functionality is preserved when features are applied
- Tests for the createProps utility:
  - Added tests for store dependencies and reactive prop updates
  - Clarified that ARIA attributes must be explicitly added by developers
  - Fixed type definitions to properly represent component interfaces
  - Tested complex selectors with multiple store dependencies
  - Verified props reactively update when source stores change
  - Confirmed props factory pattern works with various parameters
- mergeProps utility with props store organization:
  - Rewritten to accept variadic arguments instead of an array
  - Added detection for props stores with getState method and partName property
  - Implemented automatic organization by partName for props stores
  - Applied last-wins strategy for multiple stores with the same partName
  - Implemented warning and error for props stores missing partName metadata
  - Added test coverage for all enhancements
- Enhanced `createProps` implementation for the new props system:
  - Rewritten implementation with first-class support for partName metadata
  - Designed with TypeScript generics for type-safe props access
  - Created comprehensive test suite for the core props functionality
  - Ensured compatibility with the existing mergeProps utility
- Implemented the `withProps` middleware:
  - Created and passed comprehensive test for component prop composition
  - Designed middleware that provides access to base lattice props
  - Implemented support for manual merging of nested objects and event handlers
  - Added proper TypeScript interfaces for improved type safety
  - Ensured data flow is predictable during composition
  - Handled edge cases like missing props in base lattice

### Next Steps

1. ✅ Implement and test withStoreSync middleware
2. ✅ Modularize the codebase and improve type organization
3. ✅ Implement createProps utility and test basic functionality
4. ✅ Implement mergeProps utility and tests
5. ✅ Implement withLattice middleware and tests
6. ✅ Implement createLattice core function and tests
7. ✅ Upagrade hooks system with execution and removal capabilities
8. ✅ Implement lattice composition pattern
9. Implement the props architecture:
   - ✅ Upgrade `mergeProps` for props store organization with variadic
     arguments
   - ✅ Implement `createProps` to store partName as metadata
   - ✅ Create and implement the `withProps` middleware
   - ✅ Test props reactivity and factory function behavior
   - ✅ Update `withLattice` to use the new props utilities
     - Enhanced to detect new props system automatically
     - Maintains backward compatibility with legacy key-based props
     - Uses partName metadata to merge props when available
10. Create practical feature examples using the new pattern:
    - Refactor the selection feature to use `withProps`
    - Test merging of props from multiple features
    - Create test cases for realistic usage scenarios
11. Test integration with React components using the pattern
