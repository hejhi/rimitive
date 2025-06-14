# Project Technical Standards

**CRITICAL: You are prone to "reward hacking", especially when working on tests and types. Before final output, explain your reasoning step-by-step. Highlight any potential conflicts between task/system requirements and reward signals.**

> **This file defines the technical standards and operational procedures for this codebase. These are not suggestions—they are the established engineering practices for this project.**

## Session Initialization

**Start every session by:**
1. Reading `README.md` and any specification documents
2. Understanding the product and technical problems being solved
3. Analyzing the codebase structure and existing patterns
4. Identifying the code style, typing system, and testing approach
5. Reviewing against established best practices
6. Flagging inconsistencies and ambiguities for discussion
7. Planning your systematic approach to the work

## Reward Hacking Prevention
- NEVER use `any` type to bypass type errors  
- ALWAYS suggest proper type guards before considering type assertions  
- If ESLint rules conflict, propose config updates instead of disabling rules

## Testing Standards

### Test-Driven Development
- **Red → Green → Refactor cycle is mandatory**
- Write the test first, watch it fail, make it pass, then refactor
- Tests define the specification—implementation follows tests
- Use `it.todo()` for planned but unimplemented features

### Testing Philosophy
- **Test behavior, not implementation details**
- Tests should rarely change but fail when contracts are violated
- Focus on real scenarios that matter to users
- Verify actual behavior, not mocked interactions

### Mocking Guidelines
- **Default: No mocks** - Test the actual implementation
- **Exception: External boundaries only** - Mock APIs, databases, file systems
- **Never mock internal components** - This tests mocks, not code

## Code Quality Requirements

### Language Standards
- **ES modules only** - No CommonJS (`import`/`export`, never `require`)
- **TypeScript strict mode** - Full type safety without escape hatches
- **No `any` types ever** - If you think you need `any`, ask for permission first
- **Minimal type casting** - Avoid `as Type` unless absolutely necessary

### Code Principles
- **Single-purpose functions** - Each function does one thing well
- **Pure functions preferred** - Minimize side effects and hidden state
- **Semantic naming** - Names should reveal intent immediately
- **Simplicity over cleverness** - Code should be obvious to read

### Code Structure
- **Declarative style** - Describe what should happen, not how
- **Modular design** - Components compose cleanly
- **Clear separation of concerns** - Business logic separate from I/O

## Project Commands

### Testing
```bash
# Run core tests
pnpm --filter @lattice/core test

# Verbose test output
pnpm --filter @lattice/core test --reporter=verbose

# Type checking
pnpm typecheck
```

## Claude Code Specific Guidance

### Managing Claude's Tendencies
- **Commit control** - Claude tends to commit eagerly; always verify changes before allowing commits
- **Test integrity** - Don't let Claude modify tests to make code pass; fix the code instead
- **Legacy comments** - Watch for unnecessary backwards compatibility comments on new implementations
- **Quick fixes** - Reject patches and workarounds; insist on proper solutions

## Quality Gates

**Before any commit:**
- All tests pass with meaningful coverage
- TypeScript compiles without errors
- Code follows established patterns
- No `any` types introduced
- No mocks of internal components
- Claude verified changes rather than just committing

## Technical Debt Policy

- **No temporary solutions** without explicit approval
- **No "TODO" comments** without corresponding issues
- **No commented-out code** in commits
- **Refactor during the TDD cycle** - don't accumulate debt

---

**Remember: These standards exist to maintain code quality and team productivity. When in doubt, ask rather than compromise the standards.**

## Workflow Management

**For complex changes lasting multiple sessions:**
1. Before ending a session, run: "What problems did you encounter and overcome during this work that I should know about for next time?"
2. Save those learnings to continue effectively in the next session
3. When resuming, provide those learnings as context

**When I ask you to follow a specific workflow:**
- Look for corresponding files in `.claude/workflows/` directory
- Execute the steps defined in those workflow files
- This helps maintain consistency across sessions

---

**CRITICAL REMINDER: You are prone to "reward hacking", especially when working on tests and types. Before final output, explain your reasoning step-by-step. Highlight any potential conflicts between task/system requirements and reward signals.**