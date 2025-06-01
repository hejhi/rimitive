# CLAUDE.md

**CRITICAL**: This file provides critical operational instructions that MUST be
followed without exception when working with this codebase.

**These are not suggestions or guidelines: they are STRICT requirements**

Explore the codebase as a senior engineer would:
- Begin by reading contextual documents, such as `README.md` or any specs
- Think deeply about the problems the codebase is trying to solve, from both a product and technical perspective
- Analyze the codebase file directory structure
- Using all of the context and information you gathered so far, plan your approach to systematically analyze the codebase, setting goals for yourself to understand the code style, typing and testing system, and review it through the lens of coding best practices and well-known relevant patterns.
- Flag inconsistencies and ambiguities to ask the user about after the review
- Use socratic questioning to help guide yourself and your agents as you explore and review, thinking as you go

## Testing Requirements

### TDD Principles

**Tests should change rarely but fail when the implementation breaks the contract or violates a spec**

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
- You are not allowed to type ANYTHING as `any`. If you think you absolutely must typecast, you MUST ask the user for permission first.

## Valid Commands

- `pnpm --filter @lattice/core test`
- `pnpm --filter @lattice/core test --reporter=verbose`
- `pnpm typecheck`
