#!/usr/bin/env node

/**
 * Generates and embeds full documentation into src/data/docs.ts at build time.
 *
 * This script generates the full docs content
 * and embeds it directly. The parsing happens at runtime when the server starts.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '../../..');
const outputPath = resolve(__dirname, '../src/data/docs.ts');

// Doc sections in priority order
const DOC_SECTIONS = ['guides', 'signals', 'view', 'patterns'];

// Package READMEs to include
const PACKAGE_READMES = [
  { folder: 'core', name: '@rimitive/core' },
  { folder: 'signals', name: '@rimitive/signals' },
  { folder: 'view', name: '@rimitive/view' },
  { folder: 'router', name: '@rimitive/router' },
  { folder: 'resource', name: '@rimitive/resource' },
  { folder: 'ssr', name: '@rimitive/ssr' },
];

const PACKAGES = [
  {
    name: '@rimitive/core',
    folder: 'rimitive',
    description: 'Core composition (`compose`, `defineModule`, `merge`)',
  },
  {
    name: '@rimitive/signals',
    folder: 'signals',
    description: 'Reactive core (`signal`, `computed`, `effect`, `batch`)',
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
  { name: '@rimitive/react', folder: 'react', description: 'React bindings' },
];

const GITHUB_BASE = 'https://github.com/hejhi/rimitive/tree/main/packages';

function generatePackagesList() {
  return PACKAGES.map(
    (pkg) => `- [${pkg.name}](${GITHUB_BASE}/${pkg.folder}): ${pkg.description}`
  ).join('\n');
}

function stripFrontmatter(content) {
  const match = content.match(/^---\n[\s\S]*?\n---\n/);
  if (match) {
    return content.slice(match[0].length).trim();
  }
  return content.trim();
}

function extractTitle(content) {
  const match = content.match(/^---\n[\s\S]*?title:\s*["']?([^"'\n]+)["']?/);
  return match ? match[1].trim() : 'Untitled';
}

function convertSearchTags(content) {
  return content.replace(
    /<SearchTags\s+tags=\{?\[([^\]]+)\]\}?\s*\/>/g,
    (_, tagList) => {
      const tags = tagList
        .split(',')
        .map((t) => t.trim().replace(/^["']|["']$/g, ''))
        .join(', ');
      return `<!-- @tags: ${tags} -->`;
    }
  );
}

function mdxToMarkdown(content) {
  let result = content;
  result = convertSearchTags(result);

  const parts = result.split(/(```[\s\S]*?```)/g);
  result = parts
    .map((part, i) => {
      if (i % 2 === 1) return part;
      return part.replace(/^import\s+.*$/gm, '');
    })
    .join('');

  const parts2 = result.split(/(```[\s\S]*?```)/g);
  result = parts2
    .map((part, i) => {
      if (i % 2 === 1) return part;
      let cleaned = part.replace(/<[A-Z][a-zA-Z]*[^>]*\/>\s*/g, '');
      cleaned = cleaned.replace(
        /<([A-Z][a-zA-Z]*)[^>]*>[\s\S]*?<\/\1>\s*/g,
        ''
      );
      return cleaned;
    })
    .join('');

  result = result.replace(/\n{3,}/g, '\n\n');
  return result.trim();
}

function generateFullDocs() {
  const docsDir = join(rootDir, 'packages/docs/src/content/docs');
  const sections = [];

  sections.push(`# Rimitive - Complete Documentation

> A set of composable libraries for TypeScript. Compose signals, views, and behaviors into applications with fine-grained reactivity.

This document contains the complete Rimitive documentation for LLM consumption.

---
`);

  // Add README as project overview
  try {
    const readme = readFileSync(join(rootDir, 'README.md'), 'utf-8');
    const readmeContent = readme
      .replace(/^<p align="center">[\s\S]*?<\/p>\s*# Rimitive\s*/m, '')
      .replace(/^_"Primitive".*_\s*/m, '');
    sections.push(`## Project Overview (README)\n\n${readmeContent}\n\n---\n`);
  } catch {
    console.warn('Skipping README');
  }

  // Auto-discover docs from each section
  for (const section of DOC_SECTIONS) {
    const sectionDir = join(docsDir, section);
    let files;
    try {
      files = readdirSync(sectionDir);
    } catch {
      console.warn(`Skipping missing section: ${section}`);
      continue;
    }

    const mdxFiles = files
      .filter((f) => f.endsWith('.mdx') && f !== 'index.mdx')
      .sort();

    for (const file of mdxFiles) {
      try {
        const fullPath = join(sectionDir, file);
        const content = readFileSync(fullPath, 'utf-8');
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
      const readmePath = join(rootDir, 'packages', pkg.folder, 'README.md');
      const content = readFileSync(readmePath, 'utf-8');
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

// Ensure the data directory exists
mkdirSync(dirname(outputPath), { recursive: true });

// Generate the full docs
const docsContent = generateFullDocs();

// Escape backticks and backslashes for template literal
const escaped = docsContent
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$\{/g, '\\${');

// Generate the TypeScript file
const output = `// AUTO-GENERATED FILE - DO NOT EDIT
// Generated by scripts/embed-docs.js during prebuild

/**
 * Raw documentation content generated from source docs
 * Parsed into sections at runtime by the parser
 */
export const rawDocs = \`${escaped}\`;
`;

writeFileSync(outputPath, output, 'utf-8');

console.log('Embedded docs into src/data/docs.ts');
