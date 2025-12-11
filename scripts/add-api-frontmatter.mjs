#!/usr/bin/env node
/**
 * Post-processes API Documenter output to:
 * 1. Organize files into package subfolders
 * 2. Add Starlight-compatible frontmatter with badges for API kind
 * 3. Fix internal links to work with new structure
 * 4. Group overloads into sub-accordions
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
  react: 'react',
  ssr: 'ssr',
  resource: 'resource',
};

// Friendly names for sidebar ordering
const PACKAGE_LABELS = {
  signals: '@lattice/signals',
  view: '@lattice/view',
  lattice: '@lattice/lattice',
  router: '@lattice/router',
  react: '@lattice/react',
  ssr: '@lattice/ssr',
  resource: '@lattice/resource',
};

// Sidebar order (lower = higher in sidebar)
const PACKAGE_ORDER = {
  signals: 1,
  view: 2,
  lattice: 3,
  router: 4,
  react: 5,
  ssr: 6,
  resource: 7,
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
  overloads: { text: 'fn', variant: 'tip' },
};

function getPackageFromFilename(filename) {
  const match = filename.match(/^([a-z]+)\./);
  if (match && PACKAGE_MAP[match[1]]) {
    return match[1];
  }
  return null;
}

/**
 * Parse overload info from filename
 * e.g., "compose_1.md" -> { baseName: "compose", overloadNum: 1 }
 * e.g., "compose.md" -> { baseName: "compose", overloadNum: 0 }
 */
function parseOverloadInfo(filename) {
  // Match patterns like "name_1.md", "name_2.md"
  const overloadMatch = filename.match(/^(.+)_(\d+)\.md$/);
  if (overloadMatch) {
    return {
      baseName: overloadMatch[1],
      overloadNum: parseInt(overloadMatch[2], 10),
    };
  }
  // Regular file without overload suffix
  const baseMatch = filename.match(/^(.+)\.md$/);
  if (baseMatch) {
    return { baseName: baseMatch[1], overloadNum: 0 };
  }
  return { baseName: filename, overloadNum: 0 };
}

/**
 * Detect which files have overloads by scanning all files
 */
function detectOverloads(files) {
  const overloadGroups = new Map();

  for (const file of files) {
    const pkg = getPackageFromFilename(file);
    if (!pkg) continue;

    const nameWithoutPkg = file.replace(`${pkg}.`, '');
    const { baseName } = parseOverloadInfo(nameWithoutPkg);
    const key = `${pkg}.${baseName}`;

    if (!overloadGroups.has(key)) {
      overloadGroups.set(key, []);
    }
    overloadGroups.get(key).push(file);
  }

  // Return set of base names that have multiple overloads
  const hasOverloads = new Set();
  for (const [key, files] of overloadGroups) {
    if (files.length > 1) {
      hasOverloads.add(key);
    }
  }
  return hasOverloads;
}

function extractTitleAndKind(content) {
  const h2Match = content.match(/^## (.+)$/m);
  if (!h2Match) {
    return { title: 'API Reference', kind: null, cleanTitle: 'API Reference' };
  }

  const fullTitle = h2Match[1].trim();

  // Parse titles like "Computed() function" or "Signal type" or "HydrationMismatch class"
  const kindMatch = fullTitle.match(
    /^(.+?)\s+(function|type|class|interface|variable|enum|namespace|property|method|package)$/i
  );

  if (kindMatch) {
    const cleanTitle = kindMatch[1].trim();
    const kind = kindMatch[2].toLowerCase();
    return { title: fullTitle, kind, cleanTitle };
  }

  // Handle constructor pattern "(constructor)"
  if (fullTitle.includes('(constructor)')) {
    return {
      title: fullTitle,
      kind: 'constructor',
      cleanTitle: fullTitle.replace('.(constructor)', ''),
    };
  }

  return { title: fullTitle, kind: null, cleanTitle: fullTitle };
}

function fixLinks(content, currentPackage, currentFilename, overloadGroups) {
  let result = content;

  // Fix Home link: ./index.md -> ../../ (up from package/item to api root)
  result = result.replace(/\(\.\/index\.md\)/g, '(../../)');

  // Fix package index links: ./lattice.md -> ../  (when in that package)
  // or ./signals.md -> ../../signals/ (when in different package)
  result = result.replace(/\(\.\/([a-z]+)\.md\)/g, (match, pkg) => {
    if (pkg === currentPackage) {
      return '(../)';
    } else {
      return `(../../${pkg}/)`;
    }
  });

  // Fix item links: ./signals.computed.md -> ../computed/ (same package)
  // or ./view.el.md -> ../../view/el/ (different package)
  // If it's a self-link (same file), remove the link entirely
  result = result.replace(
    /\[([^\]]+)\]\(\.\/([a-z]+)\.([^)]+)\.md\)/g,
    (match, text, pkg, rest) => {
      const targetFile = `${rest}.md`;
      if (targetFile === currentFilename) {
        // Self-link: just return the text without a link
        return text;
      }

      // Check if target has overloads - if so, link to the folder
      const { baseName } = parseOverloadInfo(targetFile);
      const targetKey = `${pkg}.${baseName}`;
      const targetHasOverloads = overloadGroups.has(targetKey);

      if (pkg === currentPackage) {
        if (targetHasOverloads) {
          return `[${text}](../${baseName}/)`;
        }
        return `[${text}](../${rest}/)`;
      } else {
        if (targetHasOverloads) {
          return `[${text}](../../${pkg}/${baseName}/)`;
        }
        return `[${text}](../../${pkg}/${rest}/)`;
      }
    }
  );

  return result;
}

function generateFrontmatter(title, options = {}) {
  const { kind, order, label, hidden } = options;

  let frontmatter = `---\ntitle: "${title.replace(/"/g, '\\"')}"`;

  const sidebarOpts = [];

  if (hidden) {
    sidebarOpts.push(`  hidden: true`);
  }

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

async function processFile(filePath, filename, overloadGroups) {
  const content = await readFile(filePath, 'utf-8');
  const pkg = getPackageFromFilename(filename);

  if (!pkg) {
    // Root index.md - hide from sidebar since it duplicates the section header
    if (filename === 'index.md') {
      const fixedContent = content.replace(/\(\.\/([a-z]+)\.md\)/g, '(./$1/)');
      const frontmatter = `---
title: "API Reference"
sidebar:
  hidden: true
---

`;
      return {
        content: frontmatter + fixedContent,
        destDir: API_DIR,
        destName: 'index.md',
      };
    }

    // Package index files like "signals.md" -> signals/index.md
    const pkgMatch = filename.match(/^([a-z]+)\.md$/);
    if (pkgMatch && PACKAGE_MAP[pkgMatch[1]]) {
      const pkgName = pkgMatch[1];
      const fixedContent = fixLinks(
        content,
        pkgName,
        'index.md',
        overloadGroups
      );
      const frontmatter = generateFrontmatter(PACKAGE_LABELS[pkgName], {
        order: PACKAGE_ORDER[pkgName],
        kind: 'package',
      });
      return {
        content: frontmatter + fixedContent,
        destDir: join(API_DIR, pkgName),
        destName: 'index.md',
      };
    }

    return null;
  }

  // Regular API file like "signals.computed.md" -> signals/computed.md
  const nameWithoutPkg = filename.replace(`${pkg}.`, '');
  const { baseName, overloadNum } = parseOverloadInfo(nameWithoutPkg);
  const overloadKey = `${pkg}.${baseName}`;
  const hasOverloads = overloadGroups.has(overloadKey);

  const { title, kind, cleanTitle } = extractTitleAndKind(content);
  const fixedContent = fixLinks(content, pkg, nameWithoutPkg, overloadGroups);

  if (hasOverloads) {
    // This file is part of an overload group - put it in a subfolder
    // First overload (overloadNum === 0) becomes the index page
    if (overloadNum === 0) {
      const frontmatter = generateFrontmatter(title, {
        kind,
        label: cleanTitle,
        order: 0,
      });

      return {
        content: frontmatter + fixedContent,
        destDir: join(API_DIR, pkg, baseName),
        destName: 'index.md',
        isOverload: true,
        overloadKey,
        overloadNum,
        baseName,
        cleanTitle,
        kind,
        isFirstOverload: true,
      };
    }

    // Subsequent overloads get numbered labels
    const overloadLabel = `Overload ${overloadNum + 1}`;
    const frontmatter = generateFrontmatter(title, {
      kind,
      label: overloadLabel,
      order: overloadNum,
    });

    return {
      content: frontmatter + fixedContent,
      destDir: join(API_DIR, pkg, baseName),
      destName: `${baseName}_${overloadNum}.md`,
      isOverload: true,
      overloadKey,
      overloadNum,
      baseName,
      cleanTitle,
      kind,
    };
  }

  // Regular file without overloads
  const frontmatter = generateFrontmatter(title, {
    kind,
    label: cleanTitle,
  });

  return {
    content: frontmatter + fixedContent,
    destDir: join(API_DIR, pkg),
    destName: nameWithoutPkg,
  };
}

async function main() {
  const files = await readdir(API_DIR);
  const mdFiles = files.filter((f) => f.endsWith('.md'));

  console.log(`Processing ${mdFiles.length} files...`);

  // Detect overloads first
  const overloadGroups = detectOverloads(mdFiles);
  console.log(`Found ${overloadGroups.size} functions with overloads`);

  // Create package subdirectories
  for (const pkg of Object.values(PACKAGE_MAP)) {
    await mkdir(join(API_DIR, pkg), { recursive: true });
  }

  // Process and move each file
  const results = await Promise.all(
    mdFiles.map(async (file) => {
      const filePath = join(API_DIR, file);
      const result = await processFile(filePath, file, overloadGroups);

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
  console.log(
    `Organized ${processed} files into package subfolders with badges.`
  );
}

main().catch(console.error);
