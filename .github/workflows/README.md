# GitHub Actions Workflows

## Active Workflows

- **CI** (`ci.yml`) - Main CI pipeline with linting, type checking, testing, and building
- **Release** (`release.yml`) - Automated release workflow using changesets

## Disabled Workflows

- **CodeQL** (`codeql.yml.disabled`) - Security scanning workflow disabled until repository is public
  - CodeQL requires either a public repository or GitHub Advanced Security (paid feature)
  - To re-enable: rename `codeql.yml.disabled` back to `codeql.yml` when repo goes public
