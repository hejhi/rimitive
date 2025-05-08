# Model Composition Task Checklist

This document breaks down the implementation of the model composition system
into atomic tasks, following TDD methodology. Each task maps directly to a test
case.

## Core Model Functionality

- [x] **Basic Model Creation**
  - [x] Test: `should create a basic model with primitive values`
  - [x] Implement `createModel` to return a function that produces a Zustand
        slice creator
  - [x] Verify model produces expected state object with primitives

- [x] **Model Methods**
  - [x] Test: `should support methods in model state`
  - [x] Add support for method definitions in model factory
  - [x] Ensure methods retain access to model state via `get()`

- [x] **Derived Properties**
  - [x] Test: `should support derived properties using get()`
  - [x] Implement ability for properties to reference other properties via
        `get()`
  - [x] Verify reactivity when source properties change

## Model Composition

- [x] **Basic Composition**
  - [x] Test: `should compose two models`
  - [x] Implement the `compose` functionality in model context
  - [x] Verify composed model contains properties from both models

- [x] **Property Override**
  - [x] Test: `should allow extension to override base model properties`
  - [x] Ensure properties from extension take precedence over base model
  - [x] Verify correct values are used when properties overlap

- [x] **Cross-Model References**
  - [x] Test: `should preserve property references across model boundaries`
  - [x] Ensure `get()` can access properties from composed models
  - [x] Verify reactivity works across model boundaries

## Composition Constraints

- [x] **Model Identification**
  - [x] Test: `should identify valid lattice models`
  - [x] Add markers to identify lattice models
  - [x] Verify compose only accepts valid lattice models

## Error Handling

- [x] **Invalid Model Error**
  - [x] Test: `should throw clear error when composing non-model`
  - [x] Implement validation for model arguments
  - [x] Verify descriptive error message is thrown

## Type System

- [ ] **Type Inference**
  - [ ] Test: `should infer correct types for composed models`
  - [ ] Implement TypeScript types that properly track composition
  - [ ] Verify TypeScript compiler accepts valid property access patterns

- [ ] **Cross-Boundary Type Access**
  - [ ] Test: `should allow typed access to properties across model boundaries`
  - [ ] Enhance type system to handle cross-model references
  - [ ] Verify TypeScript properly handles `get()` calls across models

- [ ] **Type Error for Constraints**
  - [ ] Test: `should produce type errors for constraint violations`
  - [ ] Add type-level constraints matching runtime constraints
  - [ ] Verify TypeScript errors on invalid composition patterns
