# Lattice Implementation Approach

This document outlines our iterative TDD-driven approach to implementing the updated Lattice architecture. Each task follows the pattern:

1. Update/create types to match the spec
2. Update/create tests that use those types (which will intentionally fail)
3. Implement the functionality to make tests pass

## Core Types and Constants

- [ ] Rename STATE_* symbols to SELECTORS_* constants in shared/types.ts
- [ ] Update core type definitions (Lattice ’ Component, State ’ Selectors)
- [ ] Create type helpers for model inference (InferModelType)
- [ ] Add slice-related type definitions and interfaces
- [ ] Update Branded type utilities to support new component types

## Model Creation and Composition

- [ ] Update ModelFactory type to include slice parameter
- [ ] Create tests for model composition with slice
- [ ] Update model in-source tests to use slice parameter
- [ ] Modify createModel implementation to pass slice to with() callback
- [ ] Ensure proper type inference for slice parameter

## Selectors (Renamed from State)

- [ ] Create SELECTORS_* constants replacing STATE_* 
- [ ] Create SelectorsFactory type with model parameter
- [ ] Write tests for createSelectors with model parameter
- [ ] Create tests for selectors composition with slice
- [ ] Implement createSelectors function
- [ ] Update type identification functions (isSelectorsInstance, etc.)

## Actions Updates

- [ ] Update ActionsFactory type to accept model parameter
- [ ] Create tests for actions with getModel instead of mutate
- [ ] Update action in-source tests to use new pattern
- [ ] Implement updated createActions with model parameter
- [ ] Create getModel functionality replacing mutate

## View Updates

- [ ] Update ViewFactory type to accept selectors and actions
- [ ] Create tests for view with getSelectors and getActions
- [ ] Update view in-source tests to use new parameters
- [ ] Implement enhanced createView with selectors/actions parameters
- [ ] Add proper parameter validation and error messages

## Composition Pattern Enhancement

- [ ] Update compose/fluent.ts to support slice parameter
- [ ] Add tests for cherry-picking from slice
- [ ] Add tests for type safety during incompatible composition
- [ ] Update compose/core.ts with slice-aware implementation
- [ ] Implement proper slice handling in composition

## Component Creation and Composition

- [ ] Create ComponentConfig type
- [ ] Create withComponent utility for composition
- [ ] Write tests for createComponent usage
- [ ] Write tests for component composition with withComponent
- [ ] Implement createComponent function
- [ ] Implement withComponent helper

## Store Integration and Slices

- [ ] Create slices-based store types
- [ ] Create tests for component store creation
- [ ] Implement createComponentStore with slice model
- [ ] Add property prefixing to prevent collisions
- [ ] Implement subscription support

## Type Safety Testing

- [ ] Create tests for model property type mismatches
- [ ] Create tests for missing property detection
- [ ] Create tests for incompatible types during composition
- [ ] Verify runtime type checking matches static analysis
- [ ] Test complex nested composition scenarios

## Full-System Integration

- [ ] Create end-to-end sample component with all features
- [ ] Create tests for complex component composition
- [ ] Create tests for view namespacing and access
- [ ] Verify type safety across the complete composition chain
- [ ] Ensure all spec examples pass as tests

## Final Cleanup and Documentation

- [ ] Update README.md examples to match new patterns
- [ ] Clean up any deprecated code or comments
- [ ] Add JSDoc comments to public APIs
- [ ] Create additional examples showcasing key features
- [ ] Verify all tests pass with full type safety

## Implementation Notes

### Core Principles

- Always update types and tests before implementation
- Use test failures to guide implementation
- Focus on type safety throughout the process
- Keep each task focused and atomic

### Iteration Strategy

For each functional area:
1. Start with types and interfaces
2. Create tests expected to fail
3. Implement the feature to make tests pass
4. Refactor if needed while maintaining passing tests

### Branching Strategy

- Create feature branches for each major section
- Use atomic commits with precise descriptions
- Merge only when tests pass and code is reviewed