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
      'Reactive core (`signal`, `computed`, `effect`, `batch`)',
  },
  {
    name: '@rimitive/view',
    folder: 'view',
    description: 'View layer (`el`, `map`, `match`, `portal`, `load`)',
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

// Package READMEs to include in llms-full.txt (API reference style)
const PACKAGE_READMES = [
  { folder: 'core', name: '@rimitive/core' },
  { folder: 'signals', name: '@rimitive/signals' },
  { folder: 'view', name: '@rimitive/view' },
  { folder: 'router', name: '@rimitive/router' },
  { folder: 'resource', name: '@rimitive/resource' },
  { folder: 'ssr', name: '@rimitive/ssr' },
];

// Doc sections in priority order (auto-discovers files within each)
const DOC_SECTIONS = [
  'guides',
  'signals',
  'view',
  'patterns',
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
 * Convert SearchTags JSX to HTML comments
 * <SearchTags tags={["a", "b"]} /> -> <!-- @tags: a, b -->
 */
function convertSearchTags(content) {
  // Match <SearchTags tags={["tag1", "tag2", ...]} />
  return content.replace(
    /<SearchTags\s+tags=\{?\[([^\]]+)\]\}?\s*\/>/g,
    (_, tagList) => {
      // Extract tag strings from the array notation
      const tags = tagList
        .split(',')
        .map((t) => t.trim().replace(/^["']|["']$/g, ''))
        .join(', ');
      return `<!-- @tags: ${tags} -->`;
    }
  );
}

/**
 * Convert MDX to plain markdown (basic conversion)
 */
function mdxToMarkdown(content) {
  let result = content;

  // Convert SearchTags to HTML comments BEFORE removing other JSX
  result = convertSearchTags(result);

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

  // Add README as project overview
  try {
    const readme = await readFile('README.md', 'utf-8');
    // Strip the logo/title header, keep the content
    const readmeContent = readme
      .replace(/^<p align="center">[\s\S]*?<\/p>\s*# Rimitive\s*/m, '')
      .replace(/^_"Primitive".*_\s*/m, ''); // Remove the naming joke
    sections.push(`## Project Overview (README)\n\n${readmeContent}\n\n---\n`);
  } catch {
    console.warn('Skipping README');
  }

  // Auto-discover docs from each section
  for (const section of DOC_SECTIONS) {
    const sectionDir = join(docsDir, section);
    let files;
    try {
      files = await readdir(sectionDir);
    } catch {
      console.warn(`Skipping missing section: ${section}`);
      continue;
    }

    const mdxFiles = files.filter(f => f.endsWith('.mdx') && f !== 'index.mdx').sort();

    for (const file of mdxFiles) {
      try {
        const fullPath = join(sectionDir, file);
        const content = await readFile(fullPath, 'utf-8');
        const title = extractTitle(content);
        const body = stripFrontmatter(content);
        const markdown = mdxToMarkdown(body);

        if (markdown.length > 0) {
          sections.push(`## ${title}\n\n${markdown}\n\n---\n`);
        }
      } catch (err) {
        console.warn(`Skipping doc: ${section}/${file}: ${err.message}`);
      }
    }
  }

  // Add package READMEs as API reference
  sections.push(`## Package API Reference

The following sections contain API documentation from each package's README.

---
`);

  for (const pkg of PACKAGE_READMES) {
    try {
      const readmePath = join('packages', pkg.folder, 'README.md');
      const content = await readFile(readmePath, 'utf-8');
      // Strip the # title line, we'll use our own heading
      const body = content.replace(/^#\s+.*\n+/, '').trim();
      if (body.length > 0) {
        sections.push(`### ${pkg.name}\n\n${body}\n\n---\n`);
      }
    } catch {
      console.warn(`Skipping missing package README: ${pkg.folder}`);
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
