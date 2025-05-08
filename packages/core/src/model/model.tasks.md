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

- [x] **Type Inference**
  - [x] Test: `should infer correct types for composed models`
  - [x] Implement TypeScript types that properly track composition
  - [x] Verify TypeScript compiler accepts valid property access patterns

- [x] **Cross-Boundary Type Access**
  - [x] Test: `should allow typed access to properties across model boundaries`
  - [x] Enhance type system to handle cross-model references
  - [x] Verify TypeScript properly handles `get()` calls across models

- [x] **Type Error for Constraints**
  - [x] Test: `should produce type errors for constraint violations`
  - [x] Add type-level constraints matching runtime constraints
  - [x] Verify TypeScript errors on invalid composition patterns

## Fluent Composition with .with()

- [x] **Basic Fluent Composition**
  - [x] Test: `should support fluent composition with .with() method`
  - [x] Extend the `ModelInstance` type to include a `.with()` method
  - [x] Implement `.with()` method on model instances
  - [x] Verify models can be composed using the fluent syntax

- [x] **Chainable Composition**
  - [x] Test: `should support chaining multiple .with() calls`
  - [x] Ensure `.with()` returns a model instance that also has a `.with()`
        method
  - [x] Verify chained composition produces a model with all properties

- [x] **Type Preservation in Fluent Composition**
  - [x] Test: `should preserve types through fluent composition chain`
  - [x] Enhance type system to track composed types through the fluent chain
  - [x] Verify TypeScript correctly infers the combined model type

- [ ] **Error Handling in Fluent Composition**
  - [ ] Test: `should throw clear error when .with() receives invalid input`
  - [ ] Implement validation for `.with()` method arguments
  - [ ] Verify descriptive error message is thrown for invalid inputs

## Model Finalization with .create()

- [x] **Basic Model Finalization**
  - [x] Test: `should finalize a model with .create() method`
  - [x] Extend `ModelInstance` type to include a `.create()` method
  - [x] Implement `.create()` method on model instances
  - [x] Verify finalized models contain all expected properties

- [x] **Finalized Model Type Safety**
  - [x] Test: `should return a distinct finalized model type`
  - [x] Create a dedicated type for finalized models
  - [x] Ensure finalized models have appropriate type constraints
  - [x] Verify type system distinguishes between composed and finalized models

- [x] **Composition Prevention After Finalization**
  - [x] Test: `should prevent further composition after finalization`
  - [x] Ensure finalized models cannot be further composed
  - [x] Verify attempts to compose a finalized model result in type errors or
        runtime errors

- [x] **Validation During Finalization**
  - [x] Test: `should validate model during finalization`
  - [x] Implement validation checks in the `.create()` method
  - [x] Verify validation catches issues before returning the finalized model
