---
description: Start and manage multi-step workflows with intelligent progress tracking
argument-hint: [workflow-name] [workflow-step] [dir (forward/back)]
---

Start and manage multi-step workflows by running sequences of slash commands with intelligent progress tracking and guidance.

- Open the workflow **$1.md** (in @.claude/workflows/)
- The current workflow step: **$2** (ignore if not provided)
- Direction from the current step to navigate the user next: **$3** (ignore if not provided)

If the current workflow step or next direction is not provided, use the workflow guidance to determine which step the user may be on. If not possible to determine, then assume they're starting from the first step.

**Workflow Process:**

1. **Load Workflow Definition**: Look for `.claude/workflows/$ARGUMENTS.md` file

2. **Parse Workflow**: Extract YAML frontmatter containing:
   - Workflow name and description
   - Slash command for you to run in order to enter the step

3. **Check Progress**: Examine project files to determine which workflow steps have been completed based on typical outputs from each slash command

4. **Present Status**: Show progress with indicators:
   - ✅ Completed steps
   - ⏳ Current/ready step
   - ⏭️ Future steps
   - ❌ Blocked steps (missing prerequisites)
   - ❓ Uncertain

5. **Guide User**:
   - Explain what the workflow does
   - Determine and show current position, and explain what's next
   - Provide instructions to the user on how to run the next applicable step
   - Provide context about each step

6. **Interactive Orchestration**:
   - Ask permission before running each slash command
   - After each command, check progress and continue
   - Allow user to pause, skip, or exit workflow

Act as an intelligent workflow orchestrator that keeps users informed and asks permission before executing commands.