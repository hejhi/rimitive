/**
 * Bundle @rimitive package types for Monaco editor
 *
 * This script reads .d.ts files from @rimitive packages and creates
 * a bundled type definition that Monaco can use without external fetching.
 *
 * Run with: npx tsx scripts/bundle-types.ts
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname, relative } from 'path';

const packagesDir = resolve(import.meta.dirname, '../../');

interface PackageConfig {
  name: string;
  basePath: string;
  entryPoints: Record<string, string>; // subpath -> file relative to dist/
}

const packages: PackageConfig[] = [
  {
    name: '@rimitive/core',
    basePath: resolve(packagesDir, 'core/dist'),
    entryPoints: {
      '.': 'index.d.ts',
    },
  },
  {
    name: '@rimitive/signals',
    basePath: resolve(packagesDir, 'signals/dist'),
    entryPoints: {
      '.': 'index.d.ts',
      './extend': 'extend.d.ts',
      './types': 'types.d.ts',
    },
  },
  {
    name: '@rimitive/view',
    basePath: resolve(packagesDir, 'view/dist'),
    entryPoints: {
      '.': 'index.d.ts',
      './extend': 'extend.d.ts',
      './types': 'types.d.ts',
      './el': 'el.d.ts',
      './map': 'map.d.ts',
      './match': 'match.d.ts',
      './portal': 'portal.d.ts',
      './shadow': 'shadow.d.ts',
      './adapters/dom': 'adapters/dom.d.ts',
      './deps/mount': 'deps/mount.d.ts',
    },
  },
  {
    name: '@rimitive/router',
    basePath: resolve(packagesDir, 'router/dist'),
    entryPoints: {
      '.': 'index.d.ts',
      './types': 'types.d.ts',
    },
  },
  {
    name: '@rimitive/resource',
    basePath: resolve(packagesDir, 'resource/dist'),
    entryPoints: {
      '.': 'index.d.ts',
      './extend': 'extend.d.ts',
      './types': 'types.d.ts',
    },
  },
];

// Track which files have been processed to avoid duplicates
const processedFiles = new Set<string>();
const moduleContents = new Map<string, string>();

function readDtsFile(filePath: string): string {
  if (!existsSync(filePath)) {
    console.warn(`Warning: ${filePath} does not exist`);
    return '';
  }
  return readFileSync(filePath, 'utf-8');
}

function resolveImportPath(
  importPath: string,
  currentFile: string,
  pkg: PackageConfig
): { resolvedPath: string; moduleName: string } | null {
  // Handle relative imports
  if (importPath.startsWith('./') || importPath.startsWith('../')) {
    const currentDir = dirname(currentFile);
    let resolvedPath = resolve(currentDir, importPath);

    // Add .d.ts extension if missing
    if (!resolvedPath.endsWith('.d.ts')) {
      resolvedPath += '.d.ts';
    }

    // Calculate the module name for this resolved file
    const relativeToBase = relative(pkg.basePath, resolvedPath).replace(
      /\.d\.ts$/,
      ''
    );
    const moduleName = `${pkg.name}/${relativeToBase}`;

    return { resolvedPath, moduleName };
  }

  // External package import - skip
  return null;
}

function processFile(
  filePath: string,
  moduleName: string,
  pkg: PackageConfig
): void {
  if (processedFiles.has(filePath)) {
    return;
  }
  processedFiles.add(filePath);

  let content = readDtsFile(filePath);
  if (!content) return;

  // Remove sourcemap comments
  content = content.replace(/\/\/# sourceMappingURL=.*$/gm, '');

  // Find and process imports
  const importRegex =
    /(?:import|export)\s+(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  const imports: { original: string; moduleName: string }[] = [];

  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (!importPath) continue;
    const resolved = resolveImportPath(importPath, filePath, pkg);
    if (resolved) {
      imports.push({ original: importPath, moduleName: resolved.moduleName });
      // Recursively process the imported file
      processFile(resolved.resolvedPath, resolved.moduleName, pkg);
    }
  }

  // Replace relative imports with absolute module names
  for (const imp of imports) {
    content = content.replace(
      new RegExp(`from ['"]${escapeRegex(imp.original)}['"]`, 'g'),
      `from '${imp.moduleName}'`
    );
  }

  moduleContents.set(moduleName, content.trim());
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function generateBundledTypes(): string {
  // Process all packages
  for (const pkg of packages) {
    for (const [subpath, file] of Object.entries(pkg.entryPoints)) {
      const filePath = resolve(pkg.basePath, file);
      const moduleName = subpath === '.' ? pkg.name : `${pkg.name}/${subpath.slice(2)}`;
      processFile(filePath, moduleName, pkg);
    }
  }

  // Generate output
  const lines: string[] = [
    '// Auto-generated @rimitive type definitions for Monaco editor',
    '// Do not edit manually - run `pnpm bundle-types` to regenerate',
    '',
  ];

  for (const [moduleName, content] of moduleContents) {
    lines.push(`declare module '${moduleName}' {`);
    // Indent content
    const indented = content
      .split('\n')
      .map((line) => (line ? '  ' + line : line))
      .join('\n');
    lines.push(indented);
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
}

// Main
const bundled = generateBundledTypes();
const outputPath = resolve(import.meta.dirname, '../src/ui/bundled-types.ts');

const output = `// Auto-generated - do not edit manually
// Run \`pnpm bundle-types\` to regenerate

export const bundledTypes = ${JSON.stringify(bundled)};
`;

writeFileSync(outputPath, output);
console.log(`Generated ${outputPath}`);
console.log(`Bundled ${moduleContents.size} modules`);
