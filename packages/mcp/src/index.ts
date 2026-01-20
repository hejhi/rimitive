import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { rawDocs } from './data/docs.js';
import { parseDocs } from './parser/parse-docs.js';
import { search, extractExamples } from './search/index.js';

// Parse documentation on startup
const sections = parseDocs(rawDocs);

// Create MCP server
const server = new McpServer({
  name: 'rimitive',
  version: '0.1.0',
});

// search_api tool - search documentation
server.registerTool(
  'search_api',
  {
    title: 'Search Rimitive API',
    description:
      'Search Rimitive documentation for guides, API references, and examples. ' +
      'Use this to find information about signals, computed values, effects, views, ' +
      'routing, resources, SSR, and more.',
    inputSchema: {
      query: z.string().describe('Search query for finding relevant documentation'),
      limit: z.number().optional().default(5).describe('Maximum number of results (default: 5)'),
    },
  },
  async ({ query, limit }) => {
    const results = search(query, sections, limit);

    if (results.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `No results found for "${query}". Try different keywords or search terms.`,
          },
        ],
      };
    }

    const formatted = results
      .map((r, i) => {
        const packageInfo = r.section.package ? ` (${r.section.package})` : '';
        return [
          `## ${i + 1}. ${r.section.title}${packageInfo}`,
          `Type: ${r.section.type}`,
          `ID: ${r.section.id}`,
          '',
          r.excerpt,
        ].join('\n');
      })
      .join('\n\n---\n\n');

    return {
      content: [
        {
          type: 'text' as const,
          text: `Found ${results.length} results for "${query}":\n\n${formatted}`,
        },
      ],
    };
  }
);

// get_module tool - get full documentation for a module
server.registerTool(
  'get_module',
  {
    title: 'Get Module Documentation',
    description:
      'Get full documentation for a specific Rimitive module or function. ' +
      'Supports modules like SignalModule, ComputedModule, EffectModule, ' +
      'and functions like signal(), computed(), effect(), el(), map(), match(), portal(). ' +
      'Returns multiple related sections for comprehensive coverage.',
    inputSchema: {
      name: z.string().describe(
        'Module or function name (e.g., "SignalModule", "computed", "effect", "el", "map", "match")'
      ),
    },
  },
  async ({ name }) => {
    // Search for all related sections (higher limit to get comprehensive docs)
    const results = search(name, sections, 8);

    if (results.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text:
              `No documentation found for "${name}". ` +
              'Try searching with different terms using the search_api tool.',
          },
        ],
      };
    }

    // Combine all relevant sections into one response
    const combined = results
      .map((r) => {
        const packageInfo = r.section.package ? ` (${r.section.package})` : '';
        return [
          `## ${r.section.title}${packageInfo}`,
          '',
          r.section.content,
        ].join('\n');
      })
      .join('\n\n---\n\n');

    return {
      content: [
        {
          type: 'text' as const,
          text: `# Documentation for "${name}"\n\nFound ${results.length} related sections:\n\n${combined}`,
        },
      ],
    };
  }
);

// get_example tool - get code examples
server.registerTool(
  'get_example',
  {
    title: 'Get Code Examples',
    description:
      'Get code examples matching a pattern from Rimitive documentation. ' +
      'Use this to find examples of specific patterns like form handling, ' +
      'list rendering, routing, data fetching, etc.',
    inputSchema: {
      pattern: z.string().describe(
        'Pattern to search for (e.g., "form validation", "todo app", "counter", "routing")'
      ),
      limit: z.number().optional().default(3).describe('Maximum number of sections to search (default: 3)'),
    },
  },
  async ({ pattern, limit }) => {
    const results = search(pattern, sections, limit);

    if (results.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `No examples found for "${pattern}". Try different search terms.`,
          },
        ],
      };
    }

    const allExamples: Array<{ title: string; code: string }> = [];

    for (const result of results) {
      const examples = extractExamples(result.section.content);
      for (const code of examples) {
        allExamples.push({
          title: result.section.title,
          code,
        });
      }
    }

    if (allExamples.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text:
              `Found sections matching "${pattern}" but no code examples. ` +
              'Try using get_module for the full documentation.',
          },
        ],
      };
    }

    const formatted = allExamples
      .slice(0, 10) // Limit total examples
      .map((ex, i) => {
        return [`## Example ${i + 1}: ${ex.title}`, '', '```typescript', ex.code, '```'].join('\n');
      })
      .join('\n\n');

    return {
      content: [
        {
          type: 'text' as const,
          text: `Found ${allExamples.length} code examples for "${pattern}":\n\n${formatted}`,
        },
      ],
    };
  }
);

// get_patterns tool - get idiomatic patterns for a topic
server.registerTool(
  'get_patterns',
  {
    title: 'Get Idiomatic Patterns',
    description:
      'Get recommended patterns and idioms for common Rimitive tasks. ' +
      'Use this BEFORE writing code to learn the idiomatic approach. ' +
      'Topics: behaviors, forms, validation, signals, components, composition, testing.',
    inputSchema: {
      topic: z.string().describe(
        'Topic to get patterns for (e.g., "behavior", "form", "validation", "signal", "component", "testing")'
      ),
    },
  },
  async ({ topic }) => {
    // Search for pattern-related content
    const patternQueries = [
      `${topic} pattern`,
      `${topic} idiom`,
      `portable ${topic}`,
      `composing ${topic}`,
    ];

    const allResults = new Map<string, (typeof sections)[number]>();

    for (const query of patternQueries) {
      const results = search(query, sections, 4);
      for (const r of results) {
        if (!allResults.has(r.section.id)) {
          allResults.set(r.section.id, r.section);
        }
      }
    }

    const uniqueSections = Array.from(allResults.values()).slice(0, 6);

    if (uniqueSections.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text:
              `No patterns found for "${topic}". ` +
              'Try topics like: behavior, form, validation, signal, component, testing.',
          },
        ],
      };
    }

    const combined = uniqueSections
      .map((section) => {
        const packageInfo = section.package ? ` (${section.package})` : '';
        return [`## ${section.title}${packageInfo}`, '', section.content].join('\n');
      })
      .join('\n\n---\n\n');

    return {
      content: [
        {
          type: 'text' as const,
          text: `# Idiomatic Patterns for "${topic}"\n\n${combined}`,
        },
      ],
    };
  }
);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
