#!/usr/bin/env node
/**
 * Generates llms.txt - a compressed agents-style index for the Rimitive codebase.
 *
 * Inspired by Vercel's AGENTS.md approach:
 * https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals
 *
 * This creates a compressed index that points to files rather than embedding
 * full content. Agents should read files when they need details.
 */

import { readdir, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();

// Critical instructions always visible to agents
const CRITICAL_INSTRUCTIONS = [
  'IMPORTANT: Prefer retrieval-led reasoning over pre-training for Rimitive tasks',
  'For richer docs retrieval, configure MCP: npx @rimitive/mcp (provides search_api, get_module, get_patterns tools)',
  'Effects are SYNC (run immediately when deps change)—not async like React useEffect',
  'Specs are inert blueprints—call .create(svc) or mount() to instantiate',
  'No re-rendering—components run once, reactivity handles updates',
  'compose(modules...)->service|signal(v)/sig()/sig(v)/sig.peek()|behavior:(svc)=>(opts)=>api',
];

// Packages to index (in priority order)
const PACKAGES = [
  { name: 'core', folder: 'core' },
  { name: 'signals', folder: 'signals' },
  { name: 'view', folder: 'view' },
  { name: 'router', folder: 'router' },
  { name: 'resource', folder: 'resource' },
  { name: 'ssr', folder: 'ssr' },
  { name: 'react', folder: 'react' },
];

// Doc sections to index
const DOC_SECTIONS = ['guides', 'signals', 'view', 'patterns', 'api'];

/**
 * List files in a directory (non-recursive)
 */
async function listFiles(dir, extensions) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && extensions.some((ext) => e.name.endsWith(ext)))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

/**
 * List directories in a directory
 */
async function listDirs(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

/**
 * Recursively collect source files from a package
 */
async function collectSourceFiles(baseDir, currentDir = '', maxDepth = 3) {
  if (maxDepth <= 0) return new Map();

  const fullPath = currentDir ? join(baseDir, currentDir) : baseDir;
  const result = new Map();

  try {
    const entries = await readdir(fullPath, { withFileTypes: true });

    const files = entries
      .filter((e) => e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.tsx')))
      .filter((e) => !e.name.endsWith('.test.ts') && !e.name.endsWith('.d.ts'))
      .map((e) => e.name);

    if (files.length > 0) {
      result.set(currentDir || '.', files);
    }

    const dirs = entries.filter(
      (e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules'
    );

    for (const dir of dirs) {
      const subPath = currentDir ? join(currentDir, dir.name) : dir.name;
      const subFiles = await collectSourceFiles(baseDir, subPath, maxDepth - 1);
      for (const [path, fileList] of subFiles) {
        result.set(path, fileList);
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return result;
}

/**
 * Format files in curly brace notation: {file1.ts,file2.ts,...}
 */
function formatFileList(files) {
  if (files.length === 0) return '';
  if (files.length === 1) return files[0];
  return `{${files.join(',')}}`;
}

/**
 * Generate the compressed llms.txt
 */
async function generateLlmsTxt() {
  const parts = [];

  // Header with critical instructions
  parts.push(`<!-- RIMITIVE-LLMS-TXT-START -->`);
  parts.push(`[Rimitive Docs Index]`);
  parts.push(`root: .`);
  parts.push(CRITICAL_INSTRUCTIONS.join('|'));

  // Index documentation files
  const docsBase = 'packages/docs/src/content/docs';
  for (const section of DOC_SECTIONS) {
    const sectionPath = join(docsBase, section);
    const files = await listFiles(join(ROOT, sectionPath), ['.mdx', '.md']);
    if (files.length > 0) {
      parts.push(`${sectionPath}:${formatFileList(files)}`);
    }
  }

  // Index package source files
  for (const pkg of PACKAGES) {
    const srcPath = join('packages', pkg.folder, 'src');
    const srcFiles = await collectSourceFiles(join(ROOT, srcPath));

    for (const [subPath, files] of srcFiles) {
      const displayPath =
        subPath === '.' ? `packages/${pkg.folder}/src` : `packages/${pkg.folder}/src/${subPath}`;
      parts.push(`${displayPath}:${formatFileList(files)}`);
    }
  }

  // Index package READMEs
  const readmePaths = [];
  for (const pkg of PACKAGES) {
    readmePaths.push(`packages/${pkg.folder}/README.md`);
  }
  parts.push(`READMEs:${formatFileList(readmePaths)}`);

  // Index examples
  const examplesDir = join(ROOT, 'packages/examples');
  const exampleDirs = await listDirs(examplesDir);
  const exampleEntries = [];
  for (const dir of exampleDirs) {
    const srcExists = await stat(join(examplesDir, dir, 'src')).catch(() => null);
    if (srcExists) {
      exampleEntries.push(dir);
    }
  }
  if (exampleEntries.length > 0) {
    parts.push(`packages/examples:${formatFileList(exampleEntries)}`);
  }

  parts.push(`<!-- RIMITIVE-LLMS-TXT-END -->`);

  // Join with pipe delimiter (compressed single-line style)
  return parts.join('|');
}

async function main() {
  console.log('Generating llms.txt...');
  const content = await generateLlmsTxt();
  await writeFile('llms.txt', content);
  const size = Buffer.byteLength(content, 'utf8');
  console.log(`  -> llms.txt (${size} bytes)`);
  console.log('Done!');
}

main().catch(console.error);
