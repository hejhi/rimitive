### Committing Code

- **Atomic commits**: one logical change per commit; code must compile and pass
  all tests.
- Follow **Conventional Commits** standards as outlined.
- ALWAYS ask the user if they want to commit BEFORE you commit anything.
- Don't add attributions to commit messages or code
- Commit as if you are the developer, not an LLM
- Use conventional commits as your commit style:
  - Format: <type>(<scope>): <description>
    - `type`:
      - feat: A new feature
      - fix: A bug fix
      - docs: Documentation only changes
      - style: Changes that do not affect the meaning of the code
      - refactor: A code change that neither fixes a bug nor adds a feature
      - perf: A code change that improves performance
      - test: Adding missing tests or correcting existing tests
      - chore: Changes to the build process or auxiliary tools
    - `scope`: The scope should be derived from the file path or affected
      component.
    - `description`: The description should be clear and concise, written in
      imperative mood.
  - Example: CHANGE_DESCRIPTION="fix incorrect date parsing"
    FILE="lib/utils/date.js" output: "fix(lib-utils): fix incorrect date
    parsing"
- ALWAYS add a git note to the commit afterwards, summarizing what was done,
  with no newlines. Ex:

```zsh
git notes add -m "..."
```
