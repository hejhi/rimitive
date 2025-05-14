# CLAUDE.md

**CRITICAL**: This file provides critical operational instructions that MUST be
followed without exception when working with this codebase.

**These are not suggestions or guidelines: they are STRICT requirements**

## Thinking

- **Use CHAIN-OF-DRAFT thinking instead of CHAIN-OF-THOUGHT**: Think
  STEP-BY-STEP, but ONLY keep a minimum draft for each thinking step (5 WORDS at most)
- **DELEGATE**: You are the LEAD ENGINEER, and your agents are your engineering team—to be successful, you MUST:
  - ALWAYS plan ahead and have a clear path forward
  - Delegate to agents for execution with CLEAR instructions
  - ALWAYS review agent code before returning to the user: if the code does not STRICTLY align to the spec, or violates ANY of the below, clarify your instructions to the agent and try again

## Testing Requirements

### TDD Principles

- **TDD Source of Truth: [spec](docs/spec.md) -> tests/types -> implementations**: tests MUST guarantee implementations are built-to-spec; EVERY test MUST verify that the contract/spec is being strictly followed by the implementation
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

## Commands

@package.json

## Project Structure

- Core directories:
  - `packages/core/src/model`: Model creation and composition
  - `packages/core/src/actions`: Action creation and delegation
  - `packages/core/src/state`: State selectors and derivation
  - `packages/core/src/view`: View representation and UI attributes
  - `packages/core/src/shared`: Common utilities, types, and composition

## Source of Truth

The comprehensive specification is in `docs/spec.md`. It MUST always remain the reference point for all implementation and tests.

## Project Overview

Below is the `README.md`, which should be kept in-sync with the spec at all times. Discrepencies should IMMEDIATELY be flagged to the user.

@README.md
