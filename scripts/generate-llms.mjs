#!/usr/bin/env node
// Generates llms.txt and llms-full.txt from source files.
//
// Sources:
// - packages/{name}/package.json for package metadata
// - README.md for intro
// - packages/docs/src/content/docs/ for full documentation

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const GITHUB_BASE = 'https://github.com/hejhi/rimitive/tree/main/packages';

// Package order and descriptions (curated, not from package.json)
const PACKAGES = [
  {
    name: '@rimitive/core',
    folder: 'rimitive', // actual folder name differs from package name
    description: 'Core composition (`compose`, `defineModule`, `merge`)',
  },
  {
    name: '@rimitive/signals',
    folder: 'signals',
    description:
      'Reactive primitives (`signal`, `computed`, `effect`, `batch`)',
  },
  {
    name: '@rimitive/view',
    folder: 'view',
    description: 'UI primitives (`el`, `map`, `match`, `portal`, `load`)',
  },
  {
    name: '@rimitive/router',
    folder: 'router',
    description: 'Reactive routing (`matches`, `navigate()`, `query`)',
  },
  {
    name: '@rimitive/resource',
    folder: 'resource',
    description: 'Async data fetching with `resource()`',
  },
  {
    name: '@rimitive/ssr',
    folder: 'ssr',
    description: 'Server-side rendering and streaming',
  },
  {
    name: '@rimitive/react',
    folder: 'react',
    description: 'React bindings',
  },
];

// Docs to include in llms-full.txt, in order
const DOCS_ORDER = [
  // Guides - core concepts first
  'guides/getting-started.mdx',
  'guides/creating-a-service.mdx',
  'guides/using-a-service.mdx',
  'guides/adding-a-ui.mdx',
  'guides/conditional-rendering.mdx',
  'guides/rendering-lists.mdx',
  'guides/portals.mdx',
  'guides/event-handling.mdx',
  'guides/creating-a-behavior.mdx',
  'guides/adding-routing.mdx',
  'guides/loading-data.mdx',
  'guides/server-rendering.mdx',
  'guides/streaming-ssr.mdx',
  'guides/custom-modules.mdx',
  // Patterns
  'patterns/signal-patterns.mdx',
  'patterns/behaviors.mdx',
  'patterns/portability.mdx',
  'patterns/shared-state.mdx',
  'patterns/error-handling.mdx',
  'patterns/forms.mdx',
  'patterns/refs.mdx',
  'patterns/composition-over-stores.mdx',
  'patterns/async-loading.mdx',
];

/**
 * Extract the intro paragraph from README.md
 */
async function extractReadmeIntro() {
  const readme = await readFile('README.md', 'utf-8');

  // Find the first paragraph after the title that describes Rimitive
  const lines = readme.split('\n');
  let intro = '';

  // Look for "Rimitive provides:" or similar intro section
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('Rimitive is') || line.startsWith('Rimitive provides')) {
      // Take this line as the intro
      intro = line;
      break;
    }
  }

  return (
    intro ||
    'A set of composable libraries for TypeScript. Compose signals, views, and behaviors into applications with fine-grained reactivity.'
  );
}

/**
 * Generate the packages list section
 */
function generatePackagesList() {
  return PACKAGES.map(
    (pkg) => `- [${pkg.name}](${GITHUB_BASE}/${pkg.folder}): ${pkg.description}`
  ).join('\n');
}

/**
 * Generate llms.txt content
 */
async function generateLlmsTxt() {
  const intro = await extractReadmeIntro();

  return `# Rimitive

> A set of composable libraries for TypeScript. Compose signals, views, and behaviors into applications with fine-grained reactivity.

Rimitive uses \`compose()\` to wire modules together. Modules declare dependencies; compose resolves them automatically. The result is a service with reactive primitives.

## Core Concepts

- [llms-full.txt](llms-full.txt): Complete LLM documentation (recommended for full context)

## Quick Reference

Signal primitives: \`signal(value)\` creates state; \`sig()\` reads; \`sig(newValue)\` writes; \`sig.peek()\` reads without tracking.

Effects are synchronous - they run immediately when dependencies change.

View elements: \`el(tag).props({...})(...children)\` - curried pattern. Specs are inert; call \`.create(svc)\` or \`mount()\` to instantiate.

Behaviors: \`(svc) => (options) => { return api }\` - portable reactive logic.

## Import Patterns

\`\`\`typescript
// Modules for composition
import { SignalModule, ComputedModule, EffectModule } from '@rimitive/signals/extend';

// Types only
import type { Readable, Writable, SignalFunction } from '@rimitive/signals';

// View factories
import { createElModule } from '@rimitive/view/el';
import { createDOMAdapter } from '@rimitive/view/adapters/dom';

// Compose into a service
import { compose } from '@rimitive/core';
const svc = compose(SignalModule, ComputedModule, EffectModule);
\`\`\`

## Packages

${generatePackagesList()}
`;
}

/**
 * Strip MDX frontmatter from content
 */
function stripFrontmatter(content) {
  const match = content.match(/^---\n[\s\S]*?\n---\n/);
  if (match) {
    return content.slice(match[0].length).trim();
  }
  return content.trim();
}

/**
 * Extract title from frontmatter
 */
function extractTitle(content) {
  const match = content.match(/^---\n[\s\S]*?title:\s*["']?([^"'\n]+)["']?/);
  return match ? match[1].trim() : 'Untitled';
}

/**
 * Convert MDX to plain markdown (basic conversion)
 */
function mdxToMarkdown(content) {
  let result = content;

  // Remove import statements that are NOT inside code blocks
  // Split by code blocks, process non-code sections, rejoin
  const parts = result.split(/(```[\s\S]*?```)/g);
  result = parts
    .map((part, i) => {
      // Odd indices are code blocks, leave them alone
      if (i % 2 === 1) return part;
      // Even indices are regular content, remove imports
      return part.replace(/^import\s+.*$/gm, '');
    })
    .join('');

  // Remove JSX components (basic - just remove self-closing and paired components)
  // Only outside code blocks
  const parts2 = result.split(/(```[\s\S]*?```)/g);
  result = parts2
    .map((part, i) => {
      if (i % 2 === 1) return part;
      // Remove self-closing JSX like <Aside ... />
      let cleaned = part.replace(/<[A-Z][a-zA-Z]*[^>]*\/>\s*/g, '');
      // Remove paired JSX components (simple cases)
      cleaned = cleaned.replace(/<([A-Z][a-zA-Z]*)[^>]*>[\s\S]*?<\/\1>\s*/g, '');
      return cleaned;
    })
    .join('');

  // Clean up multiple blank lines
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}

/**
 * Generate llms-full.txt by concatenating docs
 */
async function generateLlmsFullTxt() {
  const docsDir = 'packages/docs/src/content/docs';
  const sections = [];

  sections.push(`# Rimitive - Complete Documentation

> A set of composable libraries for TypeScript. Compose signals, views, and behaviors into applications with fine-grained reactivity.

This document contains the complete Rimitive documentation for LLM consumption.

---
`);

  for (const docPath of DOCS_ORDER) {
    try {
      const fullPath = join(docsDir, docPath);
      const content = await readFile(fullPath, 'utf-8');
      const title = extractTitle(content);
      const body = stripFrontmatter(content);
      const markdown = mdxToMarkdown(body);

      if (markdown.length > 0) {
        sections.push(`## ${title}\n\n${markdown}\n\n---\n`);
      }
    } catch (err) {
      // File doesn't exist, skip it
      console.warn(`Skipping missing doc: ${docPath}`);
    }
  }

  // Add packages reference at the end
  sections.push(`## Package Reference

${generatePackagesList()}
`);

  return sections.join('\n');
}

async function main() {
  console.log('Generating llms.txt...');
  const llmsTxt = await generateLlmsTxt();
  await writeFile('llms.txt', llmsTxt);
  console.log('  -> llms.txt generated');

  console.log('Generating llms-full.txt...');
  const llmsFullTxt = await generateLlmsFullTxt();
  await writeFile('llms-full.txt', llmsFullTxt);
  console.log('  -> llms-full.txt generated');

  console.log('Done!');
}

main().catch(console.error);
