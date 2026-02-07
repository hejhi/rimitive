/**
 * Response Helpers - Create HTTP responses for edge SSR
 *
 * Utilities for generating Response objects with proper headers.
 * Copy this file into your project and modify as needed.
 */

import {
  createParse5Adapter,
  renderToString,
  renderToStream,
} from '@rimitive/ssr/server';
import type { RefSpec } from '@rimitive/view/types';
import { createHtmlTemplate, escapeHtml, type HtmlTemplateOptions } from './html.js';

export type RenderOptions<TService> = HtmlTemplateOptions & {
  /** Create the service (receives adapter and options) */
  createService: (
    adapter: ReturnType<typeof createParse5Adapter>['adapter'],
    options: { initialPath: string; onResolve?: (id: string, data: unknown) => void }
  ) => TService;
  /** Create the app spec from service */
  createApp: (service: TService) => () => RefSpec<unknown>;
  /** Path to client bundle */
  clientSrc?: string;
  /** Cache-Control header value */
  cacheControl?: string;
};

/**
 * Render a page to a Response (basic SSR, no streaming).
 *
 * Use this for pages without async data boundaries.
 * The entire page is rendered before sending the response.
 *
 * @example
 * ```ts
 * return renderToResponse('/about', {
 *   title: 'About Us',
 *   createService: (adapter, opts) => createService(adapter, opts),
 *   createApp: (svc) => App(svc),
 * });
 * ```
 */
export function renderToResponse<TService>(
  pathname: string,
  options: RenderOptions<TService>
): Response {
  const {
    createService,
    createApp,
    clientSrc = '/client.js',
    cacheControl = 'public, max-age=60',
    ...templateOptions
  } = options;

  const { adapter, serialize } = createParse5Adapter();
  const service = createService(adapter, { initialPath: pathname });
  const app = createApp(service)();
  const ref = app.create(service);
  const body = renderToString(ref, serialize);

  const tpl = createHtmlTemplate(templateOptions);
  const html = tpl.start + body + tpl.appClose + tpl.end(clientSrc);

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': cacheControl,
    },
  });
}

/**
 * Render a page to a streaming Response.
 *
 * Use this for pages with async data boundaries (load()).
 * The shell is sent immediately, data streams as it resolves.
 *
 * @example
 * ```ts
 * return renderToStreamingResponse('/dashboard', {
 *   title: 'Dashboard',
 *   streamKey: '__APP_STREAM__',
 *   createService: (adapter, opts) => createService(adapter, opts),
 *   createApp: (svc) => App(svc),
 * });
 * ```
 */
export function renderToStreamingResponse<TService>(
  pathname: string,
  options: RenderOptions<TService> & { streamKey: string }
): Response {
  const {
    createService,
    createApp,
    clientSrc = '/client.js',
    streamKey,
    ...templateOptions
  } = options;

  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const tpl = createHtmlTemplate({
    ...templateOptions,
    streamKey,
    // Preload client JS in <head> so the browser starts fetching immediately,
    // in parallel with the streaming data — not after the stream completes.
    head: `<link rel="modulepreload" href="${escapeHtml(clientSrc)}">`,
  });

  (async () => {
    try {
      const { adapter, serialize, insertFragmentMarkers } = createParse5Adapter();

      const service = createService(adapter, {
        initialPath: pathname,
        onResolve: (id, data) => {
          if (tpl.stream) {
            writer.write(
              encoder.encode(`<script>${tpl.stream.chunkCode(id, data)}</script>`)
            );
          }
        },
      });

      const app = createApp(service)();
      const { initialHtml, done } = renderToStream(app, {
        mount: (spec: RefSpec<unknown>) => spec.create(service),
        serialize,
        insertFragmentMarkers,
      });

      await writer.write(encoder.encode(tpl.start));
      await writer.write(encoder.encode(initialHtml));
      await writer.write(encoder.encode(tpl.appClose));
      // Write client script BEFORE awaiting async data so the browser
      // starts fetching JS in parallel with streaming data chunks.
      // Module scripts are deferred — they execute after parsing completes,
      // by which time all inline streaming chunks have already run.
      await writer.write(
        encoder.encode(
          `\n  <script type="module" src="${escapeHtml(clientSrc)}"></script>`
        )
      );

      await done;

      await writer.write(encoder.encode('\n</body>\n</html>'));
      await writer.close();
    } catch (error) {
      console.error('[stream] Error:', error);
      await writer.abort(error);
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}
