# AGENT.md - Guidelines for coding agents

## Commands
- Build: `pnpm run build`
- Dev: `pnpm run dev`
- Lint: `pnpm run lint`
- Format: `pnpm run format`
- Typecheck: `pnpm run typecheck`
- Test: `pnpm run test`
- Test single file: `vitest run path/to/test.ts`

## Code Style Guidelines
- **TDD Required**: Write tests first, then implementation. Use vitest in-source testing with `import.meta.vitest`
- **No Mocks**: Test actual behavior, mock only at boundaries
- **Functional First**: Use pure functions, minimize side-effects, isolate effects
- **Code Quality**: Modular (small, single-purpose), declarative (describe what, not how), clear (reveal intent), deterministic
- **Formatting**: Single quotes, trailing commas, 2-space tabs, semi-colons required
- **Imports**: Group by source (external first, then internal), alphabetize
- **Strict TypeScript**: Strong typing, avoid non-null assertions
- **Verified APIs**: Never invent APIs - verify in spec/source first

## Project Structure
- `packages/core/src/model`: Model creation and composition
- `packages/core/src/actions`: Action creation and delegation
- `packages/core/src/state`: State selectors and derivation
- `packages/core/src/view`: View representation and UI attributes
- `packages/core/src/shared`: Common utilities, types, and composition