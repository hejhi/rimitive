/**
 * Server Stream Writer
 *
 * Higher-level wrapper around createStreamWriter that provides
 * ready-to-use script tag helpers for streaming SSR responses.
 */

import { createStreamWriter, type StreamWriter } from './stream';

/** Default stream key used when none is specified. */
const DEFAULT_STREAM_KEY = '__RIMITIVE_STREAM__';

/**
 * A server stream writer that wraps StreamWriter with script tag helpers.
 */
export type ServerStreamWriter = StreamWriter & {
  /** Generate a `<script>` tag that initializes the streaming receiver */
  bootstrapScript: () => string;
  /** Generate a `<script>` tag that pushes data to the receiver */
  chunkScript: (id: string, data: unknown) => string;
};

/**
 * Create a server stream writer for streaming SSR.
 *
 * Wraps `createStreamWriter` with helpers that generate complete
 * `<script>` tags, eliminating the repetitive wrapping needed
 * when using the low-level `bootstrapCode()` and `chunkCode()`.
 *
 * @param streamKey - Window property name (defaults to '__RIMITIVE_STREAM__')
 * @returns ServerStreamWriter with bootstrapScript() and chunkScript() methods
 *
 * @example
 * ```ts
 * const stream = createServerStreamWriter();
 *
 * // In <head>:
 * res.write(stream.bootstrapScript());
 *
 * // As async boundaries resolve:
 * res.write(stream.chunkScript('stats', { users: 100 }));
 * ```
 */
export function createServerStreamWriter(
  streamKey: string = DEFAULT_STREAM_KEY,
): ServerStreamWriter {
  const writer = createStreamWriter(streamKey);

  return {
    ...writer,
    bootstrapScript: () => `<script>${writer.bootstrapCode()}</script>`,
    chunkScript: (id, data) =>
      `<script>${writer.chunkCode(id, data)}</script>`,
  };
}

/**
 * Generate a `<script>` tag that pushes streaming data to the receiver.
 *
 * Standalone helper for use with any StreamWriter instance. Useful when
 * working with a StreamWriter obtained from `createHtmlShell().stream`.
 *
 * @param stream - A StreamWriter instance
 * @param id - The load boundary ID
 * @param data - The resolved data
 * @returns A complete `<script>` tag string
 *
 * @example
 * ```ts
 * const shell = createHtmlShell({ streamKey: '__APP__' });
 *
 * onResolve: (id, data) => {
 *   if (shell.stream) {
 *     res.write(generateChunkScript(shell.stream, id, data));
 *   }
 * }
 * ```
 */
export function generateChunkScript(
  stream: StreamWriter,
  id: string,
  data: unknown,
): string {
  return `<script>${stream.chunkCode(id, data)}</script>`;
}

/**
 * Generate a `<script>` tag that initializes the streaming receiver.
 *
 * Standalone helper for use with any StreamWriter instance.
 *
 * @param stream - A StreamWriter instance
 * @returns A complete `<script>` tag string
 *
 * @example
 * ```ts
 * const stream = createStreamWriter('__APP__');
 * res.write(generateBootstrapScript(stream));
 * ```
 */
export function generateBootstrapScript(stream: StreamWriter): string {
  return `<script>${stream.bootstrapCode()}</script>`;
}
