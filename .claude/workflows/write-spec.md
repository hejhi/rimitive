# Write Specification Workflow

This workflow guides the creation of technical specifications for new features or API changes.

## CRITICAL: ALL DEVELOPMENT IS GREENFIELD DEVELOPMENT

**EVERY spec is a greenfield spec. This means:**
1. We NEVER need migration plans or backwards compatibility support
2. We ALWAYS delete any legacy or unused code, NOT comment it out or mark it as "legacy"
3. We NEVER support "fallback" APIs or multiple ways to do the same thing

If replacing existing functionality, the old code is completely removed, not deprecated.

## Steps

1. **Create Spec File**
   - Location: `.claude/specs/[feature-name].md`
   - Use kebab-case for filename

2. **Spec Structure**
   ```markdown
   # [Feature Name] Specification
   
   ## Summary
   Brief 2-3 sentence overview
   
   ## Motivation
   - Why this change is needed
   - Problems it solves
   - Benefits it provides
   
   ## Design Overview
   High-level description of the solution
   
   ## Detailed Design
   
   ### Core Concepts
   - Key abstractions and their relationships
   - Mental model for users
   
   ### API Design
   - Function signatures
   - Type definitions
   - Usage examples
   
   ### Implementation Details
   - Data structures
   - Algorithms
   - Performance characteristics
   
   ## Examples
   Real-world usage examples with code
   
   ## Alternatives Considered
   Other approaches and why they were rejected
   
   ## Open Questions
   Unresolved design decisions
   ```

3. **Code Examples**
   - Show basic usage
   - Show advanced patterns
   - Include TypeScript types

4. **Review Checklist**
   - [ ] API is consistent with existing patterns
   - [ ] Performance implications documented
   - [ ] Examples are realistic
   - [ ] Types are sound
   - [ ] NO migration paths included
   - [ ] NO backwards compatibility considerations
   - [ ] NO support for multiple API patterns