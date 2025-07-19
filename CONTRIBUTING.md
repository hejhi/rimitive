# Contributing to Lattice

## Development Setup

1. Clone the repository
2. Install dependencies: `pnpm install`
3. Build all packages: `pnpm build`
4. Run tests: `pnpm test`

## Making Changes

### Creating a Changeset

When you make changes that should be included in the changelog, you need to create a changeset:

```bash
pnpm changeset
```

This will prompt you to:
1. Select which packages have changed
2. Choose the type of change (major, minor, patch)
3. Write a summary of your changes

The changeset will be created in the `.changeset` directory.

### Changeset Guidelines

- **patch**: Bug fixes, documentation updates, internal changes
- **minor**: New features, non-breaking changes
- **major**: Breaking changes

### Example Changeset

```bash
# Run the command
pnpm changeset

# Select packages that changed
# Choose version bump type
# Write a summary like:
# "Fixed memory leak in signal disposal"
# or
# "Added support for async computed values"
```

## Release Process

Releases are automated through GitHub Actions:

1. Create changesets for your changes during development
2. When PRs with changesets are merged to main, a "Version Packages" PR is automatically created
3. This PR updates package versions and changelogs
4. Merging the "Version Packages" PR triggers automatic publishing to npm

## Scripts

- `pnpm changeset` - Create a new changeset
- `pnpm version` - Update versions based on changesets (used in CI)
- `pnpm release` - Build and publish packages (used in CI)

## Pull Request Process

1. Create your feature branch
2. Make your changes
3. Add tests for new functionality
4. Run `pnpm changeset` to document your changes
5. Ensure all tests pass: `pnpm test`
6. Ensure TypeScript compiles: `pnpm typecheck`
7. Ensure linting passes: `pnpm lint`
8. Submit your PR

## Commit Messages

We follow conventional commits. PR titles should use the format:
- `fix: description` - Bug fixes
- `feat: description` - New features
- `docs: description` - Documentation changes
- `chore: description` - Maintenance tasks
- `test: description` - Test additions/changes