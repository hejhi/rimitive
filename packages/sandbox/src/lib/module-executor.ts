import type { FileEntry, ExecutionResult } from '../types';
import { transpileFiles, initTranspiler } from './transpiler';

/**
 * Execute multi-file code using real ES modules via blob URLs.
 *
 * Each file becomes a real ES module with proper import/export semantics:
 * - Files are topologically sorted so dependencies are created first
 * - Imports are rewritten to point to blob URLs of dependencies
 * - Each module has its own scope with `svc` context injected
 *
 * **Supported syntax:**
 * - All standard ES module import/export syntax
 * - `import { x } from './file.ts'` - resolved to blob URLs
 * - `export const/let/var/function/class` - standard exports
 * - `export default` - default exports
 *
 * **Limitations:**
 * - Circular imports are not supported (will throw an error)
 * - Only relative imports (`./file.ts`) are supported for local files
 */
export async function executeModules(
  files: FileEntry[],
  entryFile: string
): Promise<ExecutionResult> {
  const blobUrls: string[] = [];

  const cleanup = () => {
    blobUrls.forEach((url) => URL.revokeObjectURL(url));
  };

  try {
    // Initialize transpiler
    await initTranspiler();

    // Transpile TypeScript files to JavaScript
    const transpiledFiles = await transpileFiles(files);

    // Adjust entry file name if it was a TS file
    const jsEntryFile = entryFile.replace(/\.tsx?$/, '.js');
    const entryFileObj = transpiledFiles.find((f) => f.name === jsEntryFile);

    if (!entryFileObj) {
      throw new Error(`Entry file "${entryFile}" not found`);
    }

    // Build dependency graph and sort topologically
    const sortedFiles = topologicalSort(transpiledFiles);

    // Map from filename to blob URL
    const fileUrlMap = new Map<string, string>();

    // Create blob URLs in dependency order (dependencies first)
    for (const file of sortedFiles) {
      let code = file.code;
      // Rewrite imports to blob URLs (local) or unpkg URLs (packages)
      code = rewriteImports(code, fileUrlMap);

      // Use application/javascript for ES modules
      const blob = new Blob([code], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      blobUrls.push(url);
      fileUrlMap.set(file.name, url);
    }

    // Get the entry file's blob URL (use transpiled name)
    const entryUrl = fileUrlMap.get(jsEntryFile);
    if (!entryUrl) {
      throw new Error(`Entry file "${jsEntryFile}" was not processed`);
    }

    // Dynamically import the entry module
    const module = await import(/* @vite-ignore */ entryUrl);

    // Get the result (default export or explicit 'result' export)
    const result = module.default ?? module.result ?? null;

    // Handle the result
    if (result === undefined || result === null) {
      return { success: true, element: null, dispose: cleanup };
    }

    // Check if result is a RefSpec (has .create method)
    if (
      typeof result === 'object' &&
      'create' in result &&
      typeof result.create === 'function'
    ) {
      const ref = result.create();
      if (ref && 'element' in ref) {
        const element = ref.element as HTMLElement;
        return {
          success: true,
          element,
          dispose: () => {
            element.parentNode?.removeChild(element);
            cleanup();
          },
        };
      }
      return { success: true, element: null, dispose: cleanup };
    }

    // Check if result is already an HTMLElement
    if (result instanceof HTMLElement) {
      return {
        success: true,
        element: result,
        dispose: () => {
          result.parentNode?.removeChild(result);
          cleanup();
        },
      };
    }

    // Unknown return type
    throw new Error(
      'Entry file must export default an element (el(...)) or null. ' +
        `Got: ${typeof result}`
    );
  } catch (error) {
    cleanup();
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Package to esm.sh URL mapping
 * esm.sh is a CDN specifically designed for ES module imports
 */
const ESM_CDN_MAP: Record<string, string> = {
  '@rimitive/core': 'https://esm.sh/@rimitive/core',
  '@rimitive/signals': 'https://esm.sh/@rimitive/signals',
  '@rimitive/signals/extend': 'https://esm.sh/@rimitive/signals/extend',
  '@rimitive/view': 'https://esm.sh/@rimitive/view',
  '@rimitive/view/el': 'https://esm.sh/@rimitive/view/el',
  '@rimitive/view/adapters/dom': 'https://esm.sh/@rimitive/view/adapters/dom',
  '@rimitive/router': 'https://esm.sh/@rimitive/router',
  '@rimitive/resource': 'https://esm.sh/@rimitive/resource',
};

/**
 * Rewrite imports to use blob URLs (local files) or esm.sh URLs (packages)
 */
function rewriteImports(code: string, fileUrlMap: Map<string, string>): string {
  // First, rewrite @rimitive/* imports to esm.sh URLs
  let result = code.replace(
    /from\s+(['"])(@rimitive\/[^'"]+)\1/g,
    (_match, quote, pkg) => {
      const url = ESM_CDN_MAP[pkg];
      if (url) {
        return `from ${quote}${url}${quote}`;
      }
      // Try base package if subpath not found - construct full esm.sh URL
      const basePkg = pkg.split('/').slice(0, 2).join('/');
      if (ESM_CDN_MAP[basePkg]) {
        return `from ${quote}https://esm.sh/${pkg}${quote}`;
      }
      console.warn(`Package "${pkg}" not in esm.sh map`);
      return `from ${quote}${pkg}${quote}`;
    }
  );

  // Then, rewrite relative imports to blob URLs
  // Handle .ts/.tsx imports that have been transpiled to .js
  result = result.replace(
    /from\s+(['"])\.\/([^'"]+)\1/g,
    (_match, quote, filename) => {
      // Try exact match first
      let url = fileUrlMap.get(filename);
      if (url) {
        return `from ${quote}${url}${quote}`;
      }

      // If importing a .ts/.tsx file, try the .js version (transpiled)
      if (filename.endsWith('.ts') || filename.endsWith('.tsx')) {
        const jsFilename = filename.replace(/\.tsx?$/, '.js');
        url = fileUrlMap.get(jsFilename);
        if (url) {
          return `from ${quote}${url}${quote}`;
        }
      }

      console.warn(`Import "${filename}" not found in sandbox files`);
      return `from ${quote}./${filename}${quote}`;
    }
  );

  return result;
}

/**
 * Parse import statements to extract local file dependencies
 */
function parseImports(code: string): string[] {
  const imports: string[] = [];
  const regex = /from\s+['"]\.\/([^'"]+)['"]/g;
  let match;
  while ((match = regex.exec(code)) !== null) {
    const filename = match[1];
    if (filename) {
      imports.push(filename);
    }
  }
  return imports;
}

/**
 * Normalize import path to match transpiled file names.
 * Converts .ts/.tsx extensions to .js
 */
function normalizeImportPath(importPath: string): string {
  return importPath.replace(/\.tsx?$/, '.js');
}

/**
 * Topologically sort files so dependencies come before dependents.
 * Uses Kahn's algorithm.
 */
function topologicalSort(files: FileEntry[]): FileEntry[] {
  const fileMap = new Map<string, FileEntry>();
  const deps = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>(); // reverse graph

  // Initialize
  for (const file of files) {
    fileMap.set(file.name, file);
    inDegree.set(file.name, 0);
    dependents.set(file.name, []);
  }

  // Build dependency graph
  for (const file of files) {
    // Parse imports and normalize .ts/.tsx to .js to match transpiled names
    const rawImports = parseImports(file.code);
    const fileDeps = rawImports
      .map(normalizeImportPath)
      .filter((dep) => fileMap.has(dep));
    deps.set(file.name, fileDeps);

    for (const dep of fileDeps) {
      // file depends on dep, so dep has file as a dependent
      dependents.get(dep)?.push(file.name);
      inDegree.set(file.name, (inDegree.get(file.name) ?? 0) + 1);
    }
  }

  // Start with files that have no dependencies
  const queue: string[] = [];
  for (const [name, degree] of inDegree) {
    if (degree === 0) {
      queue.push(name);
    }
  }

  // Process in order
  const sorted: string[] = [];
  while (queue.length > 0) {
    const name = queue.shift()!;
    sorted.push(name);

    // Reduce in-degree of dependents
    for (const dependent of dependents.get(name) ?? []) {
      const newDegree = (inDegree.get(dependent) ?? 1) - 1;
      inDegree.set(dependent, newDegree);
      if (newDegree === 0) {
        queue.push(dependent);
      }
    }
  }

  // Check for cycles
  if (sorted.length !== files.length) {
    const unsorted = files
      .filter((f) => !sorted.includes(f.name))
      .map((f) => f.name);
    throw new Error(
      `Circular dependency detected involving: ${unsorted.join(', ')}`
    );
  }

  // Return files in sorted order
  return sorted.map((name) => fileMap.get(name)!);
}
