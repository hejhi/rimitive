/**
 * SSR Streaming Logger
 *
 * Structured logging for streaming SSR lifecycle events: initial render,
 * boundary resolution, stream completion, and errors. Supports log levels
 * and custom formatters.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Log level for filtering messages.
 * Levels are ordered: debug < info < warn < error.
 */
export type SSRLogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * A streaming lifecycle event emitted by the logger.
 */
export type SSRLogEvent =
  | { type: 'render-start'; pathname: string }
  | { type: 'render-complete'; pathname: string; pendingCount: number; durationMs: number }
  | { type: 'chunk-sent'; boundaryId: string; pathname: string }
  | { type: 'stream-complete'; pathname: string; durationMs: number }
  | { type: 'stream-error'; pathname: string; error: unknown }
  | { type: 'service-created'; pathname: string }
  | { type: 'service-disposed'; pathname: string };

/**
 * A log entry combining level, event, and formatted message.
 */
export type SSRLogEntry = {
  /** The log level for this entry */
  level: SSRLogLevel;
  /** The structured event data */
  event: SSRLogEvent;
  /** Pre-formatted message string */
  message: string;
  /** Timestamp (ms since epoch) */
  timestamp: number;
};

/**
 * Custom formatter that converts an event into a log message string.
 * Return `undefined` to use the default formatting.
 */
export type SSRLogFormatter = (event: SSRLogEvent) => string | undefined;

/**
 * Options for createLogger.
 */
export type SSRLoggerOptions = {
  /** Minimum log level to emit (defaults to 'info') */
  level?: SSRLogLevel;
  /** Custom output function (defaults to console.log/warn/error) */
  output?: (entry: SSRLogEntry) => void;
  /** Custom message formatter (overrides default formatting) */
  formatter?: SSRLogFormatter;
};

/**
 * A logger instance for streaming SSR lifecycle events.
 */
export type SSRLogger = {
  /** Log a streaming lifecycle event */
  log: (event: SSRLogEvent) => void;
  /** Create a request-scoped logger that tracks timing for a pathname */
  request: (pathname: string) => SSRRequestLogger;
};

/**
 * A request-scoped logger that tracks timing for a single request.
 */
export type SSRRequestLogger = {
  /** Log that the service was created */
  serviceCreated: () => void;
  /** Log that initial rendering started */
  renderStart: () => void;
  /** Log that initial rendering completed with N pending boundaries */
  renderComplete: (pendingCount: number) => void;
  /** Log that a streaming chunk was sent for a boundary */
  chunkSent: (boundaryId: string) => void;
  /** Log that all boundaries resolved and the stream is complete */
  streamComplete: () => void;
  /** Log that the service was disposed */
  serviceDisposed: () => void;
  /** Log a streaming error */
  streamError: (error: unknown) => void;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOG_LEVEL_ORDER: Record<SSRLogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ---------------------------------------------------------------------------
// Default formatter
// ---------------------------------------------------------------------------

function defaultFormat(event: SSRLogEvent): string {
  switch (event.type) {
    case 'render-start':
      return `[ssr] Rendering ${event.pathname}`;
    case 'render-complete':
      return event.pendingCount > 0
        ? `[ssr] Initial render complete, ${event.pendingCount} pending boundaries (${event.durationMs}ms)`
        : `[ssr] Render complete, no pending boundaries (${event.durationMs}ms)`;
    case 'chunk-sent':
      return `[ssr] Streaming chunk: ${event.boundaryId}`;
    case 'stream-complete':
      return `[ssr] All boundaries resolved, closing response (${event.durationMs}ms total)`;
    case 'stream-error':
      return `[ssr] Stream error: ${event.error instanceof Error ? event.error.message : String(event.error)}`;
    case 'service-created':
      return `[ssr] Service created for ${event.pathname}`;
    case 'service-disposed':
      return `[ssr] Service disposed for ${event.pathname}`;
  }
}

function getLevelForEvent(event: SSRLogEvent): SSRLogLevel {
  switch (event.type) {
    case 'service-created':
    case 'service-disposed':
    case 'chunk-sent':
      return 'debug';
    case 'render-start':
    case 'render-complete':
    case 'stream-complete':
      return 'info';
    case 'stream-error':
      return 'error';
  }
}

function defaultOutput(entry: SSRLogEntry): void {
  switch (entry.level) {
    case 'error':
      console.error(entry.message);
      break;
    case 'warn':
      console.warn(entry.message);
      break;
    default:
      console.log(entry.message);
  }
}

// ---------------------------------------------------------------------------
// createLogger
// ---------------------------------------------------------------------------

/**
 * Create a structured logger for streaming SSR lifecycle events.
 *
 * The logger emits events at appropriate log levels and supports custom
 * formatters and output functions. Use `logger.request(pathname)` to create
 * a request-scoped logger that tracks timing automatically.
 *
 * @example Basic usage
 * ```ts
 * const logger = createLogger();
 *
 * // Manual event logging
 * logger.log({ type: 'render-start', pathname: '/about' });
 * logger.log({ type: 'render-complete', pathname: '/about', pendingCount: 3, durationMs: 12 });
 * ```
 *
 * @example Request-scoped logger
 * ```ts
 * const logger = createLogger({ level: 'debug' });
 * const reqLog = logger.request('/dashboard');
 *
 * reqLog.serviceCreated();
 * reqLog.renderStart();
 * // ... render ...
 * reqLog.renderComplete(2);
 * reqLog.chunkSent('user-data');
 * reqLog.chunkSent('stats');
 * reqLog.streamComplete();
 * reqLog.serviceDisposed();
 * ```
 *
 * @example Custom formatter
 * ```ts
 * const logger = createLogger({
 *   formatter: (event) => {
 *     if (event.type === 'chunk-sent') {
 *       return `Boundary resolved: ${event.boundaryId}`;
 *     }
 *     return undefined; // fall back to default
 *   },
 * });
 * ```
 *
 * @example Custom output (e.g., file logging, external service)
 * ```ts
 * const logger = createLogger({
 *   output: (entry) => {
 *     myExternalLogger.send({
 *       level: entry.level,
 *       msg: entry.message,
 *       event: entry.event.type,
 *       ts: entry.timestamp,
 *     });
 *   },
 * });
 * ```
 */
export function createLogger(options: SSRLoggerOptions = {}): SSRLogger {
  const minLevel = options.level ?? 'info';
  const minLevelOrder = LOG_LEVEL_ORDER[minLevel];
  const output = options.output ?? defaultOutput;
  const formatter = options.formatter;

  function log(event: SSRLogEvent): void {
    const level = getLevelForEvent(event);
    if (LOG_LEVEL_ORDER[level] < minLevelOrder) return;

    const customMessage = formatter?.(event);
    const message = customMessage ?? defaultFormat(event);

    output({
      level,
      event,
      message,
      timestamp: Date.now(),
    });
  }

  function request(pathname: string): SSRRequestLogger {
    let renderStart = 0;

    return {
      serviceCreated() {
        log({ type: 'service-created', pathname });
      },
      renderStart() {
        renderStart = performance.now();
        log({ type: 'render-start', pathname });
      },
      renderComplete(pendingCount: number) {
        const durationMs = Math.round(performance.now() - renderStart);
        log({ type: 'render-complete', pathname, pendingCount, durationMs });
      },
      chunkSent(boundaryId: string) {
        log({ type: 'chunk-sent', boundaryId, pathname });
      },
      streamComplete() {
        const durationMs = Math.round(performance.now() - renderStart);
        log({ type: 'stream-complete', pathname, durationMs });
      },
      serviceDisposed() {
        log({ type: 'service-disposed', pathname });
      },
      streamError(error: unknown) {
        log({ type: 'stream-error', pathname, error });
      },
    };
  }

  return { log, request };
}
