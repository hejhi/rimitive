/**
 * HTML Template - Document shell for edge SSR
 *
 * Utilities for generating HTML document structure.
 * Copy this file into your project and modify as needed.
 */

import { createStreamWriter, type StreamWriter } from '@rimitive/ssr/server';

export type HtmlTemplateOptions = {
  /** Document title */
  title?: string;
  /** CSS styles (string or array of strings) */
  styles?: string | string[];
  /** Stream key for streaming SSR (omit for basic SSR) */
  streamKey?: string;
  /** Additional head content */
  head?: string;
};

export type HtmlTemplate = {
  /** Opening HTML up to and including <div id="app"> */
  start: string;
  /** Closing </div> for the app container */
  appClose: string;
  /** Closing tags including client script */
  end: (clientSrc: string) => string;
  /** Stream writer (only if streamKey provided) */
  stream?: StreamWriter;
};

/**
 * Create HTML template parts for SSR.
 *
 * @example Basic SSR
 * ```ts
 * const tpl = createHtmlTemplate({ title: 'My App' });
 * const html = tpl.start + body + tpl.appClose + tpl.end('/client.js');
 * ```
 *
 * @example Streaming SSR
 * ```ts
 * const tpl = createHtmlTemplate({
 *   title: 'My App',
 *   streamKey: '__APP_STREAM__'
 * });
 *
 * writer.write(tpl.start);
 * writer.write(initialHtml);
 * writer.write(tpl.appClose);
 * // ... streaming chunks written via onResolve
 * writer.write(tpl.end('/client.js'));
 * ```
 */
export function createHtmlTemplate(options: HtmlTemplateOptions = {}): HtmlTemplate {
  const {
    title = 'Rimitive App',
    styles = '',
    streamKey,
    head = '',
  } = options;

  const stream = streamKey ? createStreamWriter(streamKey) : undefined;
  const styleContent = Array.isArray(styles) ? styles.join('\n') : styles;

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
<body>
  <div id="app">`;

  const appClose = `</div>`;

  const end = (clientSrc: string) => `
  <script type="module" src="${escapeHtml(clientSrc)}"></script>
</body>
</html>`;

  return { start, appClose, end, stream };
}

/**
 * Escape HTML special characters to prevent XSS.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
