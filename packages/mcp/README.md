# @rimitive/mcp

MCP (Model Context Protocol) server that exposes Rimitive documentation to coding LLMs like Claude.

## Installation

Add to your Claude Code or Claude Desktop configuration (`~/.claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "rimitive": {
      "command": "npx",
      "args": ["@rimitive/mcp"]
    }
  }
}
```

## Available Tools

### `search_api`

Search Rimitive documentation for guides, API references, and examples.

```
Input:
  - query: string (required) - Search query
  - limit: number (optional, default: 5) - Maximum results

Output: Matching sections with titles, types, and excerpts
```

### `get_module`

Get full documentation for a specific Rimitive module or function.

```
Input:
  - name: string (required) - Module or function name
    Examples: "SignalModule", "computed", "effect", "el", "map", "match"

Output: Complete documentation including code examples
```

### `get_example`

Get code examples matching a pattern from Rimitive documentation.

```
Input:
  - pattern: string (required) - Pattern to search for
    Examples: "form validation", "todo app", "counter", "routing"
  - limit: number (optional, default: 3) - Maximum sections to search

Output: Code examples with context
```

### `get_patterns`

Get idiomatic patterns and best practices for common tasks. **Use this before writing code** to learn the recommended approach.

```
Input:
  - topic: string (required) - Topic to get patterns for
    Examples: "behavior", "form", "validation", "signal", "component", "testing"

Output: Comprehensive pattern documentation with examples
```

## Example Queries

Once configured, Claude can use these tools to help you write Rimitive code:

- "How do I create a reactive list?" → `search_api` finds relevant guides
- "Show me the signal API" → `get_module` returns full signal documentation
- "Give me a counter example" → `get_example` extracts counter code samples
- "What's the idiomatic way to build a form?" → `get_patterns` returns form patterns and best practices

## License

MIT
