# Project Technical Standards

**CRITICAL: You are prone to "reward hacking", especially when working on tests and types. Before final output, explain your reasoning step-by-step. Highlight any potential conflicts between task/system requirements and reward signals.**

> **This file defines the technical standards and operational procedures for this codebase. These are not suggestions—they are the established engineering practices for this project.**

## CRITICAL: ALL DEVELOPMENT IS GREENFIELD DEVELOPMENT

**Assume that whatever existing code is code that you have JUST WRITTEN. This means:**
1. NEVER create migration plans or offer backwards compatibility 
2. ALWAYS delete any legacy or unused code, and NEVER comment it out or mark it as "legacy"
3. NEVER support "fallback" APIs or multiple ways to do the same thing

This codebase is unreleased and under development, and therefore has NO USERS TO SUPPORT.
Violating ANY of the above just creates confusion and code bloat.

## Session Initialization

**Start every session by:**
1. Reading `README.md` and any specification documents
2. Understanding the product and technical problems being solved
3. Analyzing the codebase structure and existing patterns
4. Identifying the code style, typing system, and testing approach
5. Reviewing against established best practices
6. Flagging inconsistencies and ambiguities for discussion
7. Planning your systematic approach to the work
8. Creating a task checklist for complex work (3+ steps)
9. Setting up session state tracking if needed

## Reward Hacking Prevention
- NEVER use `any` type to bypass type errors  
- ALWAYS suggest proper type guards before considering type assertions  
- If ESLint rules conflict, propose config updates instead of disabling rules
- NEVER use Proxy objects without explicit justification and user approval
- AVOID increasing complexity to solve problems - simplify first
- When feeling "pressure" to bypass quality gates, STOP and explain the conflict

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
- **Incremental changes** - Maximum 200 lines per edit operation
- **Verify between changes** - Test each change before proceeding to next

### Code Structure
- **Declarative style** - Describe what should happen, not how
- **Modular design** - Components compose cleanly
- **Clear separation of concerns** - Business logic separate from I/O

### Complexity Limits
- **Functions**: Maximum 20 lines, cyclomatic complexity < 5
- **Files**: Maximum 300 lines
- **Classes**: Maximum 7 public methods
- **Changes**: Maximum 200 lines per edit
- **Refactor first**: Simplify before adding features

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
- **Context management** - Use `/clear` every 3-4 interactions to prevent degradation
- **Proxy avoidance** - Claude defaults to Proxy patterns; require simpler alternatives
- **Incremental work** - Break large changes into small, verifiable steps

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

To find any workflow or project management documentation, look in the `.claude` directory (REMEMBER to use `ls -la` as it's a dotfile).

**For complex changes lasting multiple sessions:**
1. Before ending a session, run: "What problems did you encounter and overcome during this work that I should know about for next time?"
2. Save those learnings to continue effectively in the next session
3. When resuming, provide those learnings as context
4. Use `.claude/session-state.md` to track:
   - Current task and subtasks
   - Completed steps
   - Next actions
   - Key decisions and rationale

**When I ask you to follow a specific workflow:**
- Look for corresponding files in `.claude/workflows/` directory
- Execute the steps defined in those workflow files
- This helps maintain consistency across sessions

## Context Window Management

**Maintain quality throughout long sessions:**
- Check context usage with `/status` every 5 messages
- Use `/clear` proactively every 3-4 interactions
- Before clearing, save important state to `.claude/session-state.md`
- Use thinking modes progressively: `think` → `think hard` → `ultrathink`

### Context Management Signals
**When Claude exhibits these behaviors, use `/clear`:**
- Increasing verbosity in responses
- Referencing outdated information from earlier in conversation
- Making larger edits than requested (exceeding 200-line limit)
- Suggesting complex solutions to simple problems
- Mixing up different parts of the codebase
- Slower response times or apparent "confusion"

### Claude's Responsibilities
- Track interaction count since last clear
- After 3-4 interactions, explicitly request: "Context getting full. Please use `/clear` to maintain quality."
- Before requesting clear, offer to save state: "Should I save current progress to session state before you clear?"
- Include interaction count in complex tasks: "Interaction 3/4 since last clear"

## Data Analysis Protocol

**For reliable data analysis:**
1. **First pass**: Describe data structure and format only
2. **Second pass**: Calculate basic statistics and counts
3. **Third pass**: Extract specific insights requested
4. **Verification**: Cross-check key findings with different methods
5. **Document assumptions**: State any data quality issues found

---

**CRITICAL REMINDER: You are prone to "reward hacking", especially when working on tests and types. Before final output, explain your reasoning step-by-step. Highlight any potential conflicts between task/system requirements and reward signals.**