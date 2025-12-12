---
name: verify-fix
description: Delegate fix verification to a QA agent. Use after implementing a fix when you want end-to-end verification without cluttering your context with build/test output.
---

# Verifying Fixes with the QA Agent

After implementing a fix, delegate verification to the QA agent to confirm everything works without verbose output in your context.

## When to Use

- After fixing a bug and want to confirm it's resolved
- After adding a script/command and want to verify it works
- After fixing a type error and want to confirm typecheck passes
- After fixing a test and want to confirm it passes
- Before telling the user a fix is complete

## How to Delegate

Use the Task tool with `subagent_type: qa` (or `verifier` if qa isn't available):

```
<Task tool call>
subagent_type: qa
prompt: |
  I fixed [description of what was broken].

  Changes made:
  - [File and change 1]
  - [File and change 2]

  Verify by:
  1. [Command to run]
  2. [Expected result]

  [Any additional context]
</Task>
```

## Prompt Template

```markdown
I fixed [WHAT WAS BROKEN].

Changes made:

- [FILE]: [CHANGE DESCRIPTION]

Verify by running:
```

[COMMAND]

```

Expected result: [WHAT SUCCESS LOOKS LIKE]

[Optional: Skip build if already verified, specific files to check, etc.]
```

## Examples

### Script Fix

```markdown
I added a `bench` script to root package.json that delegates to @rimitive/benchmarks:
"bench": "pnpm --filter @rimitive/benchmarks bench"

Verify by running:
```

timeout 30 pnpm bench --skip-build diamond-simple

```

Expected: Command executes successfully with benchmark output (not "Command bench not found").
```

### Type Fix

```markdown
I fixed a type error in computed.ts where `ComputedNode` was missing the `status` property.

Changes made:

- `packages/signals/src/computed.ts`: Added `status: number` to ComputedNode type

Verify by running:
```

pnpm --filter @rimitive/signals typecheck

```

Expected: No type errors.
```

### Test Fix

```markdown
I fixed the failing test "should handle diamond dependencies" by correcting the expected value from 4 to 5.

Changes made:

- `packages/signals/src/computed.test.ts`: Line 142, changed `expect(result()).toBe(4)` to `expect(result()).toBe(5)`

Verify by running:
```

pnpm --filter @rimitive/signals test -- "should handle diamond"

```

Expected: Test passes.
```

### Build Fix

```markdown
I fixed the build error by adding the missing export in index.ts.

Changes made:

- `packages/signals/src/index.ts`: Added `export type { ComputedNode } from './computed'`

Verify by running:
```

pnpm --filter @rimitive/signals build

```

Expected: Build completes without errors, dist/ files generated.
```

## What the QA Agent Does

1. Runs `pnpm build` first (unless told to skip)
2. Executes the verification command you specified
3. Checks for expected results
4. Reports VERIFIED / NOT VERIFIED / PARTIAL with details

## Response Interpretation

### VERIFIED

Fix confirmed working. Safe to tell user it's done.

### NOT VERIFIED

Something's still broken. Agent will report:

- What was checked
- What failed
- Specific error output
- Suggestions if obvious

### PARTIAL

Some things work, some don't. Review the details before proceeding.

## Tips

1. **Be specific about expected results** - "exits 0" vs "shows benchmark output"
2. **Include relevant commands** - Don't make the agent guess what to run
3. **Skip build when appropriate** - If you just ran build, say "Skip build"
4. **Mention affected files** - Helps agent know where to look for issues
