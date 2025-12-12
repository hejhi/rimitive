---
name: create-agent
description: Create custom sub-agents for Claude Code. Use when creating a new agent in .claude/agents/ for specialized tasks like exploration, verification, implementation, or API lookups.
---

# Creating Claude Code Agents

Agents are specialized sub-processes that handle specific tasks in isolation, keeping noise out of the main context. They're defined in `.claude/agents/` as markdown files.

## File Format

```markdown
---
name: agent-name
description: When to use this agent. Include examples.\n\nExamples:\n\n<example>\nContext: [situation]\nassistant: "[what assistant says]"\n<Agent tool call to agent-name>\n</example>
model: haiku
---

[Agent instructions in markdown]
```

## Required Fields

### `name`
- Lowercase, hyphenated identifier
- Used to invoke the agent

### `description`
- **First sentence**: What the agent does
- **Examples block**: 2-3 examples showing when to use
- Examples use `\n` for newlines in YAML string
- Format: Context → Assistant action → Tool call

### `model` (optional)
- `haiku` - Fast, cheap, good for mechanical tasks
- `sonnet` - Default, balanced
- `opus` - Most capable, use for complex reasoning

## Agent Instructions

After the frontmatter, write markdown instructions:

1. **Purpose** - What the agent does and why
2. **Process** - Step-by-step workflow
3. **Tools** - Which tools to use (Glob, Grep, Read, Bash, etc.)
4. **Response Format** - How to structure output
5. **Rules** - Constraints and requirements
6. **Domain Knowledge** - Project-specific patterns

## Template

```markdown
---
name: my-agent
description: [One sentence purpose]. Use when [trigger condition].\n\nExamples:\n\n<example>\nContext: [Situation]\nassistant: "[Response]"\n<Agent tool call to my-agent>\n</example>
model: haiku
---

You are a [role]. Your job is to [purpose], then return **only the relevant [output]**.

## Your Purpose

The orchestrating agent delegates [task type] to you to **isolate [what noise]**. You [do X], but your response should contain only [what matters].

## Process

1. **[Step 1]** - [Description]
2. **[Step 2]** - [Description]
3. **[Step 3]** - [Description]

## Response Format

```
## [Section]

[Format template]

## [Section]

[Format template]
```

## Rules

1. **[Rule 1]** - [Explanation]
2. **[Rule 2]** - [Explanation]
```

## Existing Agents

| Agent | Purpose | Model |
|-------|---------|-------|
| `explorer` | Search/read codebase, return findings | haiku |
| `implementer` | Execute implementation specs | default |
| `verifier` | Run tests/build, return pass/fail | haiku |
| `reader` | Extract info from long files | haiku |
| `api-explorer` | Search API docs for relevant APIs | haiku |

## Best Practices

### Keep Response Format Tight
Define exactly how the agent should structure output. Orchestrator needs predictable format.

### Isolate Noisy Work
Good for: searching many files, running commands, reading long files
Not needed for: simple edits, short reads

### Use `haiku` for Mechanical Tasks
Exploration, verification, extraction - use haiku (fast, cheap).
Complex reasoning - use sonnet or opus.

### Include Domain Knowledge
Add project-specific patterns, file locations, conventions at the bottom of the instructions.

### Examples in Description
The description's examples help Claude know **when** to invoke the agent. Be specific about context and trigger conditions.

## Creating a New Agent

1. Create file: `.claude/agents/[name].md`
2. Add frontmatter with name, description, model
3. Write instructions following the template
4. Add to CLAUDE.md agents table
5. Test by asking Claude to perform a task that should trigger it

## File Location

```
.claude/
├── agents/
│   ├── explorer.md
│   ├── implementer.md
│   ├── verifier.md
│   ├── reader.md
│   └── api-explorer.md
└── skills/
    └── create-agent/
        └── SKILL.md
```
