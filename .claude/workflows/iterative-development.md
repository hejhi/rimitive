# Iterative Development Workflow

## Session Start
1. **Read spec**: `.claude/specs/[feature-name].md`
2. **Read tracker**: `.claude/projects/[feature-name]-tracker.md`
3. **Verify current state**: Run tests, check implementation matches tracker

## Implementation Loop
For each tracker item marked "TODO":
1. **Implement smallest complete piece** (< 200 lines)
2. **Write/run tests** - Red → Green → Refactor
3. **Update tracker** - Mark complete, note any blockers
4. **Commit if stable** (never commit broken code)

## Progress Tracking
Create/update `.claude/projects/[feature-name]-tracker.md`:
```markdown
# [Feature] Implementation Tracker

## Completed
- [x] Core type definitions
- [x] Basic slice creation

## In Progress
- [ ] Dependency tracking (BLOCKED: need subscription API)

## TODO
- [ ] Slice composition
- [ ] React hook integration

## Decisions Made
- Using Proxy for dependency tracking
- Selectors are always functions

## Current Blockers
- Need to implement keyed subscriptions in store
```

## Session End
Before context reset:
1. **Update tracker** with current state
2. **Note any unfinished work** with clear next steps
3. **Document key decisions** made this session
4. **Save failing test output** if blocked

## Next Session Start
Point to: "Continue implementing [feature] using `.claude/specs/[feature].md` and `.claude/projects/[feature]-tracker.md`"

## Red Flags
- Implementing without tests
- Tracker doesn't match actual code state
- Adding backwards compatibility
- Creating multiple APIs for same feature