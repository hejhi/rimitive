# State Composition Task Checklist

This document breaks down the implementation of the state composition system
into atomic tasks, following TDD methodology. Each task maps directly to a test
case.

> **IMPORTANT**: The entire state system deals with **pre-Zustand instantiation
> blueprints**, not runtime state. Like the model system, we're creating
> composable blueprints that will later be used by Zustand to create actual
> reactive state. No Zustand store is created during the composition phase.

## State-Specific Implementation Deltas

Based on the comparison between the current implementation (copied from model)
and the design in state.notes.md, the following tasks need to be addressed:

- [ ] **Add derive() Helper**
  - [ ] Test:
        `should add derive() helper to StateFactory tools for finalized model references`
  - [ ] Design the derive() API for referencing finalized model properties
  - [ ] Implement derive() helper that accepts only finalized models
  - [ ] Add proper type constraints for derive() to ensure type safety

- [ ] **Update Method Signatures**
  - [ ] Test: `should restrict derive() to only accept finalized models`
  - [ ] Update StateFactory type to include derive() that accepts FinalizedModel
  - [ ] Add runtime validation to enforce that only finalized models can be used
        with derive()
  - [ ] Ensure TypeScript enforces this constraint at compile time

- [ ] **Implement Model-Only Derivation**
  - [ ] Test:
        `should reject derivation from non-finalized models and state objects`
  - [ ] Add validation to check that derive() sources are finalized models
  - [ ] Implement helpful error messages for invalid derivation attempts
  - [ ] Create test cases that verify invalid derivations are caught

- [ ] **Add State-Model Integration Test**
  - [ ] Test: `should properly derive values from multiple finalized models`
  - [ ] Create test cases with multiple finalized models as sources
  - [ ] Verify state can correctly reference properties from different model
        sources
  - [ ] Test that property changes in models are reflected in derived state
        values

- [ ] **Document State-Specific Usage Patterns**
  - [ ] Create examples of proper state blueprint usage patterns
  - [ ] Document the difference between state and model composition patterns
  - [ ] Provide clear examples of how to use derive() with finalized models
  - [ ] Update docstrings to emphasize state-specific constraints and patterns

## Current Implementation Tasks (Copied from Model)

These tasks represent the existing functionality that was copied from the model
system:

- [ ] **Basic State Blueprint Creation**
  - [x] Test:
        `should create a basic state blueprint referencing a finalized model blueprint`
  - [x] Implement `createState` to return a composable state blueprint
  - [x] Verify state blueprint contains expected property definitions

- [ ] **State Property Methods**
  - [x] Test: `should support methods in state state`
  - [x] Add support for method definitions in state factory
  - [x] Ensure methods retain access to state via `get()`

- [ ] **Direct State References**
  - [x] Test: `should support derived properties using get()`
  - [x] Implement ability for properties to reference other properties via
        `get()`
  - [x] Verify reactivity when source properties change

## State Blueprint Composition

- [ ] **Basic Blueprint Composition**
  - [x] Test: `should compose two state blueprints`
  - [x] Implement the `.with()` functionality for state blueprint composition
  - [x] Verify composed state blueprint contains properties from both blueprints

- [ ] **Property Definition Override**
  - [x] Test:
        `should allow extension blueprint to override base state property definitions`
  - [x] Ensure property definitions from extension take precedence over base
        blueprint
  - [x] Verify correct property definitions are used when names overlap

- [ ] **Composed Blueprint Reference Definitions**
  - [x] Test:
        `should define access to base state properties via get() in extensions`
  - [x] Ensure property definitions can reference other property definitions via
        get()
  - [x] Verify composed property definitions correctly reference other property
        definitions

## Type System Improvements for State

- [ ] **Improve Finalized Model Type Constraints**
  - [ ] Test:
        `should enforce at type level that derive() only accepts finalized models`
  - [ ] Update the TypeScript types to better constrain derive() parameters
  - [ ] Ensure TypeScript errors on attempts to use non-finalized models

- [ ] **Cross-Model-State Type Safety**
  - [ ] Test:
        `should maintain type safety when deriving from multiple model sources`
  - [ ] Enhance type definitions for multi-model integration
  - [ ] Verify TypeScript correctly infers combined types

## End-to-End Example Development

- [ ] **Create Complete State Usage Example**
  - [ ] Develop an end-to-end example showing state deriving from finalized
        models
  - [ ] Include multiple composition layers and model sources
  - [ ] Document best practices for working with state and models
  - [ ] Add as an example in the documentation
