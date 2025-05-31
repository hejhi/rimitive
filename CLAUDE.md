# CLAUDE.md

**CRITICAL**: This file provides critical operational instructions that MUST be
followed without exception when working with this codebase.

**These are not suggestions or guidelines: they are STRICT requirements**

## Thinking

- **DELEGATE**: You are the LEAD ENGINEER, and your agents are your engineering team—to be successful, you MUST:
  - ALWAYS plan ahead and have a clear path forward
  - Delegate to agents for execution with CLEAR instructions
  - ALWAYS review agent code before returning to the user: if the code does not STRICTLY align to the spec, or violates ANY of the below, clarify your instructions to the agent and try again

## Testing Requirements

### TDD Principles

- **Integration tests > unit tests** for core system behavior
- **Tests should change rarely but fail when the implementation breaks the contract**

### Mocking Rules

- **NO MOCKS UNLESS ABSOLUTELY NECESSARY**: ALWAYS test implementation, NEVER mocks. Tests MUST verify actual behavior.
- **"Mock at the boundaries"**: only mock external dependencies, not internal components

### In-Source Testing Requirements

- Use vitest in-source testing with `import.meta.vitest`
- Follow **strict TDD**: write test → make it fail → make it pass → refactor
- Keep tests focused on verifying **spec compliance**
- When writing tests for future implementations, use `it.todo()`
- Tests must be PRAGMATIC and focus on REAL SCENARIOS
- Use proper async/await when using test-only inline imports in test blocks

## Code Quality

- Modular: Keep functions small and single-purpose
- Declarative: Write pure functions, minimize side-effects
- Semantic: Naming is crucial, be precise and accurate
- Simplicity: Complexity is the enemy, prioritize readability
- ES IMPORTS ONLY. NO COMMONJS.
- NEVER use `any` types, and don't use typecasting unless absolutely necessary.

## Commands

@package.json

Helpful commands:
`cd /Users/henryivry/repos/lattice && pnpm --filter @lattice/core test`
`cd /Users/henryivry/repos/lattice && pnpm --filter @lattice/core test --reporter=verbose`
`cd /Users/henryivry/repos/lattice && pnpm typecheck`

## Project Structure

- Core directories:
  - `packages/core/src/model`: Model creation and composition
  - `packages/core/src/actions`: Action creation and delegation
  - `packages/core/src/state`: State selectors and derivation
  - `packages/core/src/view`: View representation and UI attributes
  - `packages/core/src/shared`: Common utilities, types, and composition

## Source of Truth

The comprehensive specification is in `docs/spec.md`. It MUST always remain the reference point for all implementation and tests.

## CRITICAL ARCHITECTURAL UNDERSTANDING

**Lattice is a COMPOSITIONAL FRAMEWORK, NOT a state management library**

### What Lattice IS
- **Behavior Specification Framework**: Provides VSAM patterns for describing component behavior as executable contracts
- **Adapter Orchestration Layer**: Standardizes how behavior specifications interface with actual state management systems
- **Type-Safe Composition API**: Enables composing complex behaviors from simple primitives without any runtime implementation

### What Lattice NEVER DOES
- **NEVER implements state management**: No actual state storage, subscriptions, or persistence
- **NEVER implements UI rendering**: No DOM manipulation, virtual DOM, or framework-specific rendering
- **NEVER executes slice factories directly**: Always delegates to adapters for execution with runtime tools

### CRITICAL: Factory-Time vs Runtime Distinction
- **Factory-Time (Lattice Core)**: Creates SPECIFICATIONS ONLY - slice factories that define contracts
- **Runtime (Adapters)**: FULFILL specifications by executing slice factories with actual infrastructure tools

### ALWAYS REMEMBER
- Component factories return SLICE FACTORIES (specifications), not executed slices
- Adapters execute slice factories with appropriate runtime tools
- Store adapters and framework adapters are separate and can be mixed/matched
- Lattice Core is pure composition - no side effects, no runtime state, no infrastructure dependencies

## Project Overview

Below is the `README.md`, which should be kept in-sync with the spec at all times. Discrepencies should IMMEDIATELY be flagged to the user.

@README.md