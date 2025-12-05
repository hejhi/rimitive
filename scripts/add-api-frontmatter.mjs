#!/usr/bin/env node
/**
 * Post-processes API Documenter output to:
 * 1. Organize files into package subfolders
 * 2. Add Starlight-compatible frontmatter with badges for API kind
 * 3. Fix internal links to work with new structure
 */

import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const API_DIR = 'packages/docs/src/content/docs/api';

// Map of package prefixes to folder names
const PACKAGE_MAP = {
  signals: 'signals',
  view: 'view',
  lattice: 'lattice',
  router: 'router',
  islands: 'islands',
  react: 'react',
};

// Friendly names for sidebar ordering
const PACKAGE_LABELS = {
  signals: '@lattice/signals',
  view: '@lattice/view',
  lattice: '@lattice/lattice',
  router: '@lattice/router',
  islands: '@lattice/islands',
  react: '@lattice/react',
};

// Sidebar order (lower = higher in sidebar)
const PACKAGE_ORDER = {
  signals: 1,
  view: 2,
  lattice: 3,
  router: 4,
  islands: 5,
  react: 6,
};

// Badge variants for different API kinds
const KIND_BADGES = {
  function: { text: 'fn', variant: 'tip' },
  type: { text: 'type', variant: 'note' },
  class: { text: 'class', variant: 'caution' },
  interface: { text: 'interface', variant: 'note' },
  variable: { text: 'var', variant: 'default' },
  enum: { text: 'enum', variant: 'caution' },
  namespace: { text: 'ns', variant: 'default' },
  property: { text: 'prop', variant: 'default' },
  method: { text: 'method', variant: 'tip' },
  constructor: { text: 'new', variant: 'caution' },
  package: { text: 'pkg', variant: 'success' },
};

// Sort order for kinds within a package (lower = higher)
const KIND_ORDER = {
  function: 1,
  class: 2,
  interface: 3,
  type: 4,
  variable: 5,
  enum: 6,
  namespace: 7,
};

function getPackageFromFilename(filename) {
  const match = filename.match(/^([a-z]+)\./);
  if (match && PACKAGE_MAP[match[1]]) {
    return match[1];
  }
  return null;
}

function extractTitleAndKind(content) {
  const h2Match = content.match(/^## (.+)$/m);
  if (!h2Match) {
    return { title: 'API Reference', kind: null, cleanTitle: 'API Reference' };
  }

  const fullTitle = h2Match[1].trim();

  // Parse titles like "Computed() function" or "Signal type" or "HydrationMismatch class"
  const kindMatch = fullTitle.match(/^(.+?)\s+(function|type|class|interface|variable|enum|namespace|property|method|package)$/i);

  if (kindMatch) {
    const cleanTitle = kindMatch[1].trim();
    const kind = kindMatch[2].toLowerCase();
    return { title: fullTitle, kind, cleanTitle };
  }

  // Handle constructor pattern "(constructor)"
  if (fullTitle.includes('(constructor)')) {
    return { title: fullTitle, kind: 'constructor', cleanTitle: fullTitle.replace('.(constructor)', '') };
  }

  return { title: fullTitle, kind: null, cleanTitle: fullTitle };
}

function fixLinks(content, currentPackage, currentFilename) {
  let result = content;

  // Fix Home link: ./index.md -> ../
  result = result.replace(/\(\.\/index\.md\)/g, '(../)');

  // Fix package index links: ./lattice.md -> ./  (when in that package)
  // or ./signals.md -> ../signals/ (when in different package)
  result = result.replace(/\(\.\/([a-z]+)\.md\)/g, (match, pkg) => {
    if (pkg === currentPackage) {
      return '(./)';
    } else {
      return `(../${pkg}/)`;
    }
  });

  // Fix item links: ./signals.computed.md -> ./computed/ (same package)
  // or ./view.el.md -> ../view/el/ (different package)
  // If it's a self-link (same file), remove the link entirely
  result = result.replace(/\[([^\]]+)\]\(\.\/([a-z]+)\.([^)]+)\.md\)/g, (match, text, pkg, rest) => {
    const targetFile = `${rest}.md`;
    if (targetFile === currentFilename) {
      // Self-link: just return the text without a link
      return text;
    } else if (pkg === currentPackage) {
      return `[${text}](./${rest}/)`;
    } else {
      return `[${text}](../${pkg}/${rest}/)`;
    }
  });

  return result;
}

function generateFrontmatter(title, options = {}) {
  const { kind, order, label } = options;

  let frontmatter = `---\ntitle: "${title.replace(/"/g, '\\"')}"`;

  const sidebarOpts = [];

  if (label) {
    sidebarOpts.push(`  label: "${label}"`);
  }

  if (order !== undefined) {
    sidebarOpts.push(`  order: ${order}`);
  }

  if (kind && KIND_BADGES[kind]) {
    const badge = KIND_BADGES[kind];
    sidebarOpts.push(`  badge:`);
    sidebarOpts.push(`    text: "${badge.text}"`);
    sidebarOpts.push(`    variant: "${badge.variant}"`);
  }

  if (sidebarOpts.length > 0) {
    frontmatter += `\nsidebar:\n${sidebarOpts.join('\n')}`;
  }

  frontmatter += `\n---\n\n`;
  return frontmatter;
}

async function processFile(filePath, filename) {
  const content = await readFile(filePath, 'utf-8');
  const pkg = getPackageFromFilename(filename);

  if (!pkg) {
    // Root index.md
    if (filename === 'index.md') {
      const fixedContent = content.replace(/\(\.\/([a-z]+)\.md\)/g, '(./$1/)');
      const frontmatter = generateFrontmatter('API Reference');
      return { content: frontmatter + fixedContent, destDir: API_DIR, destName: 'index.md' };
    }

    // Package index files like "signals.md" -> signals/index.md
    const pkgMatch = filename.match(/^([a-z]+)\.md$/);
    if (pkgMatch && PACKAGE_MAP[pkgMatch[1]]) {
      const pkgName = pkgMatch[1];
      const fixedContent = fixLinks(content, pkgName, 'index.md');
      const frontmatter = generateFrontmatter(PACKAGE_LABELS[pkgName], {
        order: PACKAGE_ORDER[pkgName],
        kind: 'package',
      });
      return {
        content: frontmatter + fixedContent,
        destDir: join(API_DIR, pkgName),
        destName: 'index.md'
      };
    }

    return null;
  }

  // Regular API file like "signals.computed.md" -> signals/computed.md
  const { title, kind, cleanTitle } = extractTitleAndKind(content);
  const newFilename = filename.replace(`${pkg}.`, '');
  const fixedContent = fixLinks(content, pkg, newFilename);

  // Calculate sort order based on kind
  const kindOrder = kind && KIND_ORDER[kind] ? KIND_ORDER[kind] * 100 : 500;

  const frontmatter = generateFrontmatter(title, {
    kind,
    label: cleanTitle,
  });

  return {
    content: frontmatter + fixedContent,
    destDir: join(API_DIR, pkg),
    destName: newFilename,
  };
}

async function main() {
  const files = await readdir(API_DIR);
  const mdFiles = files.filter(f => f.endsWith('.md'));

  console.log(`Processing ${mdFiles.length} files...`);

  // Create package subdirectories
  for (const pkg of Object.values(PACKAGE_MAP)) {
    await mkdir(join(API_DIR, pkg), { recursive: true });
  }

  // Process and move each file
  const results = await Promise.all(
    mdFiles.map(async (file) => {
      const filePath = join(API_DIR, file);
      const result = await processFile(filePath, file);

      if (result) {
        await mkdir(result.destDir, { recursive: true });
        await writeFile(join(result.destDir, result.destName), result.content);

        // Remove original if it moved
        if (result.destDir !== API_DIR || result.destName !== file) {
          await rm(filePath);
        }
      }

      return result;
    })
  );

  const processed = results.filter(Boolean).length;
  console.log(`Organized ${processed} files into package subfolders with badges.`);
}

main().catch(console.error);
