import * as esbuild from 'esbuild-wasm';

let initialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize esbuild-wasm. Must be called before transpiling.
 * Safe to call multiple times - will only initialize once.
 */
export async function initTranspiler(): Promise<void> {
  if (initialized) return;

  if (initPromise) return initPromise;

  initPromise = esbuild
    .initialize({
      wasmURL: 'https://unpkg.com/esbuild-wasm@0.27.2/esbuild.wasm',
    })
    .then(() => {
      initialized = true;
    });

  return initPromise;
}

/**
 * Transpile TypeScript to JavaScript.
 * Strips types, transforms JSX if present.
 */
export async function transpile(
  code: string,
  filename: string = 'input.ts'
): Promise<string> {
  await initTranspiler();

  const loader = filename.endsWith('.tsx')
    ? 'tsx'
    : filename.endsWith('.ts')
      ? 'ts'
      : 'js';

  const result = await esbuild.transform(code, {
    loader,
    target: 'es2022',
    format: 'esm',
  });

  return result.code;
}

/**
 * Transpile multiple files, preserving their structure.
 */
export async function transpileFiles(
  files: Array<{ name: string; code: string }>
): Promise<Array<{ name: string; code: string }>> {
  await initTranspiler();

  return Promise.all(
    files.map(async (file) => {
      // Only transpile TS/TSX files
      if (file.name.endsWith('.ts') || file.name.endsWith('.tsx')) {
        const transpiledCode = await transpile(file.code, file.name);
        // Change extension to .js for the output
        const jsName = file.name.replace(/\.tsx?$/, '.js');
        return { name: jsName, code: transpiledCode };
      }
      return file;
    })
  );
}
