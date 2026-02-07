/// <reference types="node" />
/**
 * Development Server Utilities
 *
 * Provides development-mode enhancements for SSR servers: pretty error pages,
 * request logging, source map support, and a dev server wrapper with hot reload.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { StreamingHandler } from './streaming-server';

// ---------------------------------------------------------------------------
// Pretty Error Pages
// ---------------------------------------------------------------------------

/**
 * Options for generating a development error page.
 */
export type DevErrorPageOptions = {
  /** Include the full stack trace (defaults to true) */
  showStack?: boolean;
  /** Application title shown in the error page (defaults to 'Server Error') */
  title?: string;
};

/**
 * Generate a styled HTML error page for development.
 *
 * Renders the error message and stack trace in a readable format with
 * syntax-highlighted stack frames. Only use in development — production
 * errors should return minimal information to avoid leaking internals.
 *
 * @example
 * ```ts
 * try {
 *   await renderApp(req, res);
 * } catch (error) {
 *   const html = createDevErrorPage(error);
 *   res.writeHead(500, { 'Content-Type': 'text/html' });
 *   res.end(html);
 * }
 * ```
 */
export function createDevErrorPage(
  error: unknown,
  options: DevErrorPageOptions = {},
): string {
  const { showStack = true, title = 'Server Error' } = options;

  const message =
    error instanceof Error ? error.message : String(error);
  const stack =
    showStack && error instanceof Error ? error.stack ?? '' : '';

  const escapedMessage = escapeHtml(message);
  const escapedStack = escapeHtml(stack);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
      background: #1a1a2e;
      color: #e0e0e0;
      padding: 2rem;
      line-height: 1.6;
    }
    .error-container {
      max-width: 960px;
      margin: 0 auto;
    }
    .error-badge {
      display: inline-block;
      background: #e74c3c;
      color: #fff;
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }
    h1 {
      font-size: 1.5rem;
      color: #ff6b6b;
      margin-bottom: 1.5rem;
      word-break: break-word;
    }
    .stack {
      background: #16213e;
      border: 1px solid #2a2a4a;
      border-radius: 8px;
      padding: 1.5rem;
      overflow-x: auto;
      font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, monospace;
      font-size: 0.8125rem;
      line-height: 1.8;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .stack-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #888;
      margin-bottom: 0.5rem;
    }
  </style>
</head>
<body>
  <div class="error-container">
    <div class="error-badge">500</div>
    <h1>${escapedMessage}</h1>${
      escapedStack
        ? `
    <div class="stack-label">Stack Trace</div>
    <pre class="stack">${escapedStack}</pre>`
        : ''
    }
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Request Logging
// ---------------------------------------------------------------------------

/**
 * Log level for request logging.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * A log entry produced by the request logger.
 */
export type RequestLogEntry = {
  /** HTTP method (GET, POST, etc.) */
  method: string;
  /** Request URL */
  url: string;
  /** HTTP status code */
  status: number;
  /** Response time in milliseconds */
  durationMs: number;
};

/**
 * Options for the request logging middleware.
 */
export type RequestLoggerOptions = {
  /** Custom log function (defaults to console.log with formatted output) */
  log?: (entry: RequestLogEntry) => void;
  /** URL patterns to exclude from logging (e.g., static assets) */
  exclude?: string[];
};

/**
 * A middleware that logs requests and passes through to the next handler.
 */
export type RequestLoggerMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void | Promise<void>,
) => void | Promise<void>;

/**
 * Create a request logging middleware for development.
 *
 * Logs request method, URL, status code, and response time. Excludes
 * URLs matching the provided patterns (useful for skipping noisy
 * static asset requests).
 *
 * @example
 * ```ts
 * const logRequest = createRequestLogger();
 *
 * const server = createServer(async (req, res) => {
 *   await logRequest(req, res, async () => {
 *     if (serveStatic(req, res)) return;
 *     await handleStreaming(req, res);
 *   });
 * });
 * ```
 *
 * @example Custom logger with exclusions
 * ```ts
 * const logRequest = createRequestLogger({
 *   exclude: ['/assets/', '/favicon.ico'],
 *   log: (entry) => {
 *     myLogger.info(`${entry.method} ${entry.url} ${entry.status} ${entry.durationMs}ms`);
 *   },
 * });
 * ```
 */
export function createRequestLogger(
  options: RequestLoggerOptions = {},
): RequestLoggerMiddleware {
  const { exclude = [] } = options;

  const log =
    options.log ??
    ((entry: RequestLogEntry) => {
      const statusColor =
        entry.status >= 500
          ? '\x1b[31m' // red
          : entry.status >= 400
            ? '\x1b[33m' // yellow
            : entry.status >= 300
              ? '\x1b[36m' // cyan
              : '\x1b[32m'; // green
      const reset = '\x1b[0m';
      console.log(
        `  ${statusColor}${entry.status}${reset} ${entry.method} ${entry.url} ${entry.durationMs}ms`,
      );
    });

  return async (req, res, next) => {
    const url = req.url ?? '/';

    const shouldExclude = exclude.some(
      (pattern) =>
        url === pattern ||
        (pattern.endsWith('/') && url.startsWith(pattern)),
    );

    if (shouldExclude) {
      await next();
      return;
    }

    const start = performance.now();
    const originalEnd = res.end;
    let status = 200;

    // Capture the status code from writeHead
    const originalWriteHead = res.writeHead;
    res.writeHead = function (
      this: ServerResponse,
      ...args: Parameters<ServerResponse['writeHead']>
    ) {
      status = args[0] as number;
      return originalWriteHead.apply(this, args);
    } as ServerResponse['writeHead'];

    // Capture when the response ends
    res.end = function (this: ServerResponse, ...args: unknown[]) {
      const durationMs = Math.round(performance.now() - start);
      log({
        method: req.method ?? 'GET',
        url,
        status,
        durationMs,
      });
      return (originalEnd as (...a: unknown[]) => ServerResponse).apply(
        this,
        args,
      );
    } as ServerResponse['end'];

    await next();
  };
}

// ---------------------------------------------------------------------------
// Source Map Support
// ---------------------------------------------------------------------------

/**
 * Install source map support for readable stack traces in development.
 *
 * Enables Node.js's built-in `--enable-source-maps` behavior at runtime
 * via the `node:module` source map hooks (Node 20.19+). If the runtime
 * doesn't support it, this is a no-op.
 *
 * Call once at server startup before any errors are thrown.
 *
 * @example
 * ```ts
 * installSourceMapSupport();
 * const server = createServer(handler);
 * ```
 */
export function installSourceMapSupport(): void {
  try {
    process.setSourceMapsEnabled(true);
  } catch {
    // Runtime does not support setSourceMapsEnabled (pre-Node 16.6).
    // Silently ignore — stack traces will use compiled positions.
  }
}

// ---------------------------------------------------------------------------
// Dev Server Wrapper
// ---------------------------------------------------------------------------

/**
 * Configuration for the development server wrapper.
 */
export type DevServerConfig = {
  /** The streaming handler to wrap (from createStreamingServer) */
  handler: StreamingHandler;
  /** Port to listen on (defaults to 3000, respects PORT env var) */
  port?: number;
  /** Callback when the server starts listening */
  onReady?: (port: number) => void;
  /** Enable request logging (defaults to true) */
  logging?: boolean | RequestLoggerOptions;
  /** URL patterns to exclude from request logging */
  logExclude?: string[];
  /** Additional request handlers to run before the streaming handler */
  middleware?: Array<
    (req: IncomingMessage, res: ServerResponse) => boolean | Promise<boolean>
  >;
  /** Show pretty error pages for unhandled errors (defaults to true) */
  errorPages?: boolean;
};

/**
 * Result from creating a dev server.
 */
export type DevServerResult = {
  /** Start listening. Returns a cleanup function that closes the server. */
  listen: () => Promise<() => Promise<void>>;
  /** The port the server will listen on */
  port: number;
};

/**
 * Create a development server wrapper with logging, error pages, and
 * middleware support.
 *
 * Wraps a streaming handler with development conveniences:
 * - Request logging with color-coded status codes
 * - Pretty error pages with stack traces
 * - Middleware pipeline for static handlers, API routes, etc.
 * - Source map support for readable stack traces
 *
 * @example Minimal dev server
 * ```ts
 * const handleStreaming = createStreamingServer({ ... });
 * const dev = createDevServer({ handler: handleStreaming });
 * const close = await dev.listen();
 * ```
 *
 * @example With middleware and custom port
 * ```ts
 * const dev = createDevServer({
 *   handler: handleStreaming,
 *   port: 8080,
 *   middleware: [serveStatic, handlePrefetch],
 *   logging: { exclude: ['/assets/'] },
 *   onReady: (port) => console.log(`Dev server: http://localhost:${port}`),
 * });
 *
 * const close = await dev.listen();
 * // later: await close();
 * ```
 */
export function createDevServer(
  config: DevServerConfig,
): DevServerResult {
  const {
    handler,
    middleware = [],
    errorPages = true,
    onReady,
  } = config;

  const port =
    config.port ?? (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);

  // Configure request logging
  let logger: RequestLoggerMiddleware | undefined;
  if (config.logging !== false) {
    const loggerOptions: RequestLoggerOptions =
      typeof config.logging === 'object' ? config.logging : {};
    if (config.logExclude && !loggerOptions.exclude) {
      loggerOptions.exclude = config.logExclude;
    }
    logger = createRequestLogger(loggerOptions);
  }

  // Install source map support
  installSourceMapSupport();

  const requestHandler = async (req: IncomingMessage, res: ServerResponse) => {
    const handle = async () => {
      try {
        // Run middleware pipeline
        for (const mw of middleware) {
          const handled = await mw(req, res);
          if (handled) return;
        }

        // Fall through to streaming handler
        await handler(req, res);
      } catch (error) {
        if (errorPages && !res.headersSent) {
          const html = createDevErrorPage(error);
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(html);
        } else if (!res.headersSent) {
          res.writeHead(500);
          res.end('Internal Server Error');
        }
      }
    };

    if (logger) {
      await logger(req, res, handle);
    } else {
      await handle();
    }
  };

  return {
    port,
    async listen() {
      const { createServer } = await import('node:http');
      const server = createServer(requestHandler);

      await new Promise<void>((resolve) => {
        server.listen(port, () => {
          onReady?.(port);
          resolve();
        });
      });

      return () =>
        new Promise<void>((resolve, reject) => {
          server.close((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
