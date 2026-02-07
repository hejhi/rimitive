/**
 * HTML Shell
 *
 * Generate HTML document shells for SSR with optional hydration data
 * and streaming support.
 */

import { createStreamWriter, safeJsonStringify, type StreamWriter } from './stream';

/**
 * Options for creating an HTML shell.
 */
export type HtmlShellOptions = {
  /** Document title (defaults to 'Rimitive App') */
  title?: string;
  /** CSS styles (string or array of strings) */
  styles?: string | string[];
  /** Additional content for the <head> element */
  head?: string;
  /** Stream key for streaming SSR (omit for basic SSR) */
  streamKey?: string;
  /** Hydration data to embed in the HTML for client-side hydration */
  hydrationData?: Record<string, unknown> | null;
  /** Window property name for hydration data (defaults to '__RIMITIVE_DATA__') */
  hydrationKey?: string;
  /** ID for the root app container element (defaults to 'app', set to false to skip wrapper) */
  rootId?: string | false;
};

/**
 * An HTML shell split into composable parts for streaming.
 */
export type HtmlShell = {
  /** Opening HTML from doctype through <div id="app"> */
  start: string;
  /** Closing </div> for the app container */
  appClose: string;
  /** Closing tags including hydration data and client script */
  end: (clientSrc: string) => string;
  /** Stream writer instance (only present when streamKey is provided) */
  stream?: StreamWriter;
};

/**
 * Escape HTML special characters to prevent XSS in attribute/text contexts.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Check whether hydration data contains entries worth serializing.
 */
function hasHydrationData(
  data: Record<string, unknown> | null | undefined,
): data is Record<string, unknown> {
  return data != null && Object.keys(data).length > 0;
}

/**
 * Create an HTML document shell for SSR.
 *
 * The shell is split into three parts (start, appClose, end) so that
 * streaming responses can write the opening HTML immediately, then
 * stream async chunks, then close the document.
 *
 * Hydration data is serialized safely and injected as a script tag
 * before the client module script, making it available to the client
 * before the application boots.
 *
 * @example Basic SSR with hydration data
 * ```ts
 * const shell = createHtmlShell({
 *   title: 'My App',
 *   hydrationData: { user: { name: 'Alice' } },
 * });
 * const html = shell.start + body + shell.appClose + shell.end('/client.js');
 * ```
 *
 * @example Streaming SSR
 * ```ts
 * const shell = createHtmlShell({
 *   title: 'My App',
 *   streamKey: '__APP_STREAM__',
 * });
 *
 * writer.write(shell.start);
 * writer.write(initialHtml);
 * writer.write(shell.appClose);
 * // ... streaming chunks arrive via onResolve
 * writer.write(shell.end('/client.js'));
 * ```
 */
export function createHtmlShell(options: HtmlShellOptions = {}): HtmlShell {
  const {
    title = 'Rimitive App',
    styles = '',
    head = '',
    streamKey,
    hydrationData,
    hydrationKey = '__RIMITIVE_DATA__',
    rootId = 'app',
  } = options;

  const stream = streamKey ? createStreamWriter(streamKey) : undefined;
  const styleContent = Array.isArray(styles) ? styles.join('\n') : styles;

  const rootOpen = rootId !== false ? `\n  <div id="${escapeHtml(rootId)}">` : '';
  const start = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  ${stream ? `<script>${stream.bootstrapCode()}</script>` : ''}
  ${styleContent ? `<style>${styleContent}</style>` : ''}
  ${head}
</head>
<body>${rootOpen}`;

  const appClose = rootId !== false ? `</div>` : '';

  const end = (clientSrc: string) => {
    const hydrationScript = hasHydrationData(hydrationData)
      ? `\n  <script>window.${hydrationKey}=${safeJsonStringify(hydrationData)}</script>`
      : '';

    return `${hydrationScript}
  <script type="module" src="${escapeHtml(clientSrc)}"></script>
</body>
</html>`;
  };

  return { start, appClose, end, stream };
}
