# Incremental Refactoring Workflow

## Purpose
This workflow ensures systematic, verifiable refactoring with minimal risk and maximum clarity.

## Pre-requisites
- [ ] Identify target scope (maximum 1 file or model)
- [ ] Ensure all existing tests pass
- [ ] Create backup branch if changes are significant

## Workflow Steps

### 1. Characterization Phase
- [ ] Write tests that capture current behavior
- [ ] Document any undocumented behavior discovered
- [ ] Verify tests pass with current implementation

### 2. Planning Phase
- [ ] List all refactoring goals
- [ ] Break down into atomic changes (< 50 lines each)
- [ ] Order changes from least to most risky
- [ ] Create checklist in session state

### 3. Execution Phase
For each atomic change:
- [ ] Make ONE small change
- [ ] Run relevant tests
- [ ] Verify no regression
- [ ] Update any affected documentation
- [ ] Mark task complete in checklist

### 4. Verification Phase
- [ ] Run full test suite
- [ ] Check complexity metrics
- [ ] Verify no new TODOs introduced
- [ ] Review against CLAUDE.md standards

### 5. Completion Phase
- [ ] Document any insights for future refactoring
- [ ] Update session state with completion status
- [ ] Consider follow-up refactoring opportunities

## Key Principles
- **Never refactor and add features simultaneously**
- **Each change must leave code in working state**
- **Tests should not change unless behavior changes**
- **Complexity should decrease or remain stable**

## Red Flags (Stop and Reassess)
- Tests start failing unexpectedly
- Need to modify tests to make code pass
- Complexity metrics increase
- Changes exceed 200 lines
- Tempted to use Proxy or dynamic patterns

## Example Checklist
```markdown
## Refactoring UserService Class
- [x] Write characterization tests
- [x] Extract validation logic to separate method
- [x] Simplify error handling pattern
- [ ] Remove duplicate code in update/create
- [ ] Extract common interface
```