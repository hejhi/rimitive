# View Composition Task Checklist

This document breaks down the implementation of the view composition system into
atomic tasks, following TDD methodology. Each task maps directly to a test case.

> **IMPORTANT**: The entire view system deals with **UI prop projections**, not
> actual UI components. Like the model and state systems, we're creating
> composable blueprints that will later be used with UI components to create
> actual interactive interfaces. No UI components are created during the
> composition phase.

## View-Specific Implementation Deltas

Based on the comparison between the current implementation (copied from state)
and the design in view.notes.md, the following tasks need to be addressed:

- [ ] **Add dispatch() Helper**
  - [ ] Test:
        `should add dispatch() helper to ViewFactory tools for connecting events to actions`
  - [ ] Design the dispatch() API for connecting UI events to actions
  - [ ] Implement dispatch() helper that creates event handlers
  - [ ] Add proper type constraints for dispatch() to ensure type safety

- [ ] **Update Method Signatures**
  - [ ] Test: `should restrict derive() to only accept finalized states`
  - [ ] Update ViewFactory type to include derive() that accepts FinalizedState
  - [ ] Add runtime validation to enforce that only finalized states can be used
        with derive()
  - [ ] Ensure TypeScript enforces this constraint at compile time

- [ ] **Implement State-Only Derivation**
  - [ ] Test:
        `should reject derivation from non-finalized states and other sources`
  - [ ] Add validation to check that derive() sources are finalized states
  - [ ] Implement helpful error messages for invalid derivation attempts
  - [ ] Create test cases that verify invalid derivations are caught

- [ ] **Add View-State Integration Test**
  - [ ] Test: `should properly derive values from multiple finalized states`
  - [ ] Create test cases with multiple finalized states as sources
  - [ ] Verify view can correctly reference properties from different state
        sources
  - [ ] Test that property changes in states are reflected in derived view props

- [ ] **Document View-Specific Usage Patterns**
  - [ ] Create examples of proper view blueprint usage patterns
  - [ ] Document the difference between view and state composition patterns
  - [ ] Provide clear examples of how to use derive() with finalized states
  - [ ] Update docstrings to emphasize view-specific constraints and patterns

## Core Implementation Tasks

These tasks represent the core functionality needed for the view system:

- [ ] **Basic View Blueprint Creation**
  - [ ] Test:
        `should create a basic view blueprint referencing a finalized state blueprint`
  - [ ] Implement `createView` to return a composable view blueprint
  - [ ] Verify view blueprint contains expected UI prop definitions

- [ ] **View Prop Derivation**
  - [ ] Test: `should support derived props from state`
  - [ ] Add support for derive() function that can reference state properties
  - [ ] Ensure derived props update when state properties change

- [ ] **Action Dispatching**
  - [ ] Test: `should support connecting events to actions with dispatch()`
  - [ ] Implement ability for view props to dispatch actions
  - [ ] Verify events correctly trigger actions when handled

## View Blueprint Composition

- [ ] **Basic Blueprint Composition**
  - [ ] Test: `should compose two view blueprints`
  - [ ] Implement the `.with()` functionality for view blueprint composition
  - [ ] Verify composed view blueprint contains props from both blueprints

- [ ] **Prop Definition Override**
  - [ ] Test:
        `should allow extension blueprint to override base view prop definitions`
  - [ ] Ensure prop definitions from extension take precedence over base
        blueprint
  - [ ] Verify correct prop definitions are used when names overlap

- [ ] **Event Handler Composition**
  - [ ] Test:
        `should properly compose event handlers from multiple view blueprints`
  - [ ] Ensure event handlers can be overridden or extended in compositions
  - [ ] Verify composed event handlers work correctly

## Type System Improvements for Views

- [ ] **Improve Finalized State Type Constraints**
  - [ ] Test:
        `should enforce at type level that derive() only accepts finalized states`
  - [ ] Update the TypeScript types to better constrain derive() parameters
  - [ ] Ensure TypeScript errors on attempts to use non-finalized states

- [ ] **Action Dispatching Type Safety**
  - [ ] Test: `should provide type safety for action dispatching`
  - [ ] Enhance type definitions for the dispatch helper
  - [ ] Verify TypeScript correctly infers parameter types for event handlers

## End-to-End Example Development

- [ ] **Create Complete View Usage Example**
  - [ ] Develop an end-to-end example showing view deriving from finalized
        states and dispatching actions
  - [ ] Include multiple composition layers and state sources
  - [ ] Document best practices for working with views, states, and actions
  - [ ] Add as an example in the documentation
