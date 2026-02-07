/**
 * Tests for SSR streaming logger
 *
 * Covers log levels, event formatting, custom formatters, custom output,
 * and request-scoped loggers with timing.
 */

import { describe, it, expect, vi } from 'vitest';
import { createLogger, type SSRLogEntry } from './logging';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectEntries(
  options?: Parameters<typeof createLogger>[0],
): { entries: SSRLogEntry[]; logger: ReturnType<typeof createLogger> } {
  const entries: SSRLogEntry[] = [];
  const logger = createLogger({
    ...options,
    output: (entry) => entries.push(entry),
  });
  return { entries, logger };
}

// ---------------------------------------------------------------------------
// createLogger – basic event logging
// ---------------------------------------------------------------------------

describe('createLogger', () => {
  it('should log render-start at info level', () => {
    const { entries, logger } = collectEntries();
    logger.log({ type: 'render-start', pathname: '/home' });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.level).toBe('info');
    expect(entries[0]!.message).toContain('/home');
    expect(entries[0]!.event.type).toBe('render-start');
  });

  it('should log render-complete with pending count', () => {
    const { entries, logger } = collectEntries();
    logger.log({
      type: 'render-complete',
      pathname: '/about',
      pendingCount: 3,
      durationMs: 12,
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.message).toContain('3 pending boundaries');
    expect(entries[0]!.message).toContain('12ms');
  });

  it('should log render-complete with zero pending boundaries', () => {
    const { entries, logger } = collectEntries();
    logger.log({
      type: 'render-complete',
      pathname: '/',
      pendingCount: 0,
      durationMs: 5,
    });

    expect(entries[0]!.message).toContain('no pending boundaries');
  });

  it('should log chunk-sent at debug level', () => {
    const { entries, logger } = collectEntries({ level: 'debug' });
    logger.log({ type: 'chunk-sent', boundaryId: 'user-data', pathname: '/' });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.level).toBe('debug');
    expect(entries[0]!.message).toContain('user-data');
  });

  it('should log stream-complete at info level', () => {
    const { entries, logger } = collectEntries();
    logger.log({ type: 'stream-complete', pathname: '/', durationMs: 250 });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.level).toBe('info');
    expect(entries[0]!.message).toContain('All boundaries resolved');
    expect(entries[0]!.message).toContain('250ms');
  });

  it('should log stream-error at error level', () => {
    const { entries, logger } = collectEntries();
    logger.log({
      type: 'stream-error',
      pathname: '/',
      error: new Error('fetch failed'),
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.level).toBe('error');
    expect(entries[0]!.message).toContain('fetch failed');
  });

  it('should log stream-error with non-Error values', () => {
    const { entries, logger } = collectEntries();
    logger.log({ type: 'stream-error', pathname: '/', error: 'string error' });

    expect(entries[0]!.message).toContain('string error');
  });

  it('should log service-created at debug level', () => {
    const { entries, logger } = collectEntries({ level: 'debug' });
    logger.log({ type: 'service-created', pathname: '/dashboard' });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.level).toBe('debug');
    expect(entries[0]!.message).toContain('/dashboard');
  });

  it('should log service-disposed at debug level', () => {
    const { entries, logger } = collectEntries({ level: 'debug' });
    logger.log({ type: 'service-disposed', pathname: '/dashboard' });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.level).toBe('debug');
    expect(entries[0]!.message).toContain('/dashboard');
  });

  it('should include timestamp in entries', () => {
    const { entries, logger } = collectEntries();
    const before = Date.now();
    logger.log({ type: 'render-start', pathname: '/' });
    const after = Date.now();

    expect(entries[0]!.timestamp).toBeGreaterThanOrEqual(before);
    expect(entries[0]!.timestamp).toBeLessThanOrEqual(after);
  });
});

// ---------------------------------------------------------------------------
// Log level filtering
// ---------------------------------------------------------------------------

describe('log level filtering', () => {
  it('should filter out debug events at info level (default)', () => {
    const { entries, logger } = collectEntries();

    logger.log({ type: 'service-created', pathname: '/' }); // debug
    logger.log({ type: 'chunk-sent', boundaryId: 'x', pathname: '/' }); // debug
    logger.log({ type: 'render-start', pathname: '/' }); // info

    expect(entries).toHaveLength(1);
    expect(entries[0]!.event.type).toBe('render-start');
  });

  it('should show debug events when level is debug', () => {
    const { entries, logger } = collectEntries({ level: 'debug' });

    logger.log({ type: 'service-created', pathname: '/' });
    logger.log({ type: 'chunk-sent', boundaryId: 'x', pathname: '/' });
    logger.log({ type: 'render-start', pathname: '/' });

    expect(entries).toHaveLength(3);
  });

  it('should only show warn and error at warn level', () => {
    const { entries, logger } = collectEntries({ level: 'warn' });

    logger.log({ type: 'render-start', pathname: '/' }); // info – filtered
    logger.log({ type: 'render-complete', pathname: '/', pendingCount: 0, durationMs: 1 }); // info – filtered
    logger.log({ type: 'stream-error', pathname: '/', error: 'err' }); // error – shown

    expect(entries).toHaveLength(1);
    expect(entries[0]!.level).toBe('error');
  });

  it('should only show errors at error level', () => {
    const { entries, logger } = collectEntries({ level: 'error' });

    logger.log({ type: 'render-start', pathname: '/' });
    logger.log({ type: 'stream-complete', pathname: '/', durationMs: 10 });
    logger.log({ type: 'stream-error', pathname: '/', error: 'boom' });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.level).toBe('error');
  });
});

// ---------------------------------------------------------------------------
// Custom formatter
// ---------------------------------------------------------------------------

describe('custom formatter', () => {
  it('should use custom formatter when it returns a string', () => {
    const { entries, logger } = collectEntries({
      formatter: (event) => {
        if (event.type === 'render-start') {
          return `CUSTOM: rendering ${event.pathname}`;
        }
        return undefined;
      },
    });

    logger.log({ type: 'render-start', pathname: '/test' });

    expect(entries[0]!.message).toBe('CUSTOM: rendering /test');
  });

  it('should fall back to default format when formatter returns undefined', () => {
    const { entries, logger } = collectEntries({
      formatter: () => undefined,
    });

    logger.log({ type: 'render-start', pathname: '/test' });

    expect(entries[0]!.message).toContain('[ssr]');
    expect(entries[0]!.message).toContain('/test');
  });

  it('should apply formatter to all event types', () => {
    const formatted: string[] = [];
    const { logger } = collectEntries({
      level: 'debug',
      formatter: (event) => {
        const msg = `type=${event.type}`;
        formatted.push(msg);
        return msg;
      },
    });

    logger.log({ type: 'render-start', pathname: '/' });
    logger.log({ type: 'render-complete', pathname: '/', pendingCount: 1, durationMs: 5 });
    logger.log({ type: 'chunk-sent', boundaryId: 'b1', pathname: '/' });
    logger.log({ type: 'stream-complete', pathname: '/', durationMs: 100 });
    logger.log({ type: 'stream-error', pathname: '/', error: 'e' });
    logger.log({ type: 'service-created', pathname: '/' });
    logger.log({ type: 'service-disposed', pathname: '/' });

    expect(formatted).toHaveLength(7);
  });
});

// ---------------------------------------------------------------------------
// Custom output
// ---------------------------------------------------------------------------

describe('custom output', () => {
  it('should call custom output function', () => {
    const outputFn = vi.fn();
    const logger = createLogger({ output: outputFn });

    logger.log({ type: 'render-start', pathname: '/' });

    expect(outputFn).toHaveBeenCalledTimes(1);
    expect(outputFn.mock.calls[0]![0].level).toBe('info');
    expect(outputFn.mock.calls[0]![0].event.type).toBe('render-start');
  });

  it('should receive the full entry structure', () => {
    const outputFn = vi.fn();
    const logger = createLogger({ output: outputFn });

    logger.log({
      type: 'render-complete',
      pathname: '/page',
      pendingCount: 2,
      durationMs: 15,
    });

    const entry: SSRLogEntry = outputFn.mock.calls[0]![0];
    expect(entry.level).toBe('info');
    expect(entry.message).toBeTruthy();
    expect(entry.timestamp).toBeGreaterThan(0);
    expect(entry.event).toEqual({
      type: 'render-complete',
      pathname: '/page',
      pendingCount: 2,
      durationMs: 15,
    });
  });
});

// ---------------------------------------------------------------------------
// Default output (console)
// ---------------------------------------------------------------------------

describe('default output', () => {
  it('should use console.log for info events', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger();

    logger.log({ type: 'render-start', pathname: '/' });

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('should use console.error for error events', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = createLogger();

    logger.log({ type: 'stream-error', pathname: '/', error: 'err' });

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('should use console.log for debug events', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger({ level: 'debug' });

    logger.log({ type: 'service-created', pathname: '/' });

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Request-scoped logger
// ---------------------------------------------------------------------------

describe('request-scoped logger', () => {
  it('should log service lifecycle events', () => {
    const { entries, logger } = collectEntries({ level: 'debug' });
    const req = logger.request('/dashboard');

    req.serviceCreated();
    req.serviceDisposed();

    expect(entries).toHaveLength(2);
    expect(entries[0]!.event.type).toBe('service-created');
    expect(entries[1]!.event.type).toBe('service-disposed');
    expect((entries[0]!.event as { pathname: string }).pathname).toBe('/dashboard');
  });

  it('should track render timing', async () => {
    const { entries, logger } = collectEntries();
    const req = logger.request('/slow');

    req.renderStart();
    await new Promise((r) => setTimeout(r, 10));
    req.renderComplete(2);

    expect(entries).toHaveLength(2);
    const complete = entries[1]!.event;
    expect(complete.type).toBe('render-complete');
    if (complete.type === 'render-complete') {
      expect(complete.durationMs).toBeGreaterThanOrEqual(5);
      expect(complete.pendingCount).toBe(2);
    }
  });

  it('should track total stream timing', async () => {
    const { entries, logger } = collectEntries({ level: 'debug' });
    const req = logger.request('/page');

    req.renderStart();
    await new Promise((r) => setTimeout(r, 10));
    req.chunkSent('b1');
    req.streamComplete();

    const complete = entries.find((e) => e.event.type === 'stream-complete');
    expect(complete).toBeDefined();
    if (complete && complete.event.type === 'stream-complete') {
      expect(complete.event.durationMs).toBeGreaterThanOrEqual(5);
    }
  });

  it('should log chunk-sent events', () => {
    const { entries, logger } = collectEntries({ level: 'debug' });
    const req = logger.request('/');

    req.chunkSent('user-data');
    req.chunkSent('stats');

    expect(entries).toHaveLength(2);
    expect(entries[0]!.event.type).toBe('chunk-sent');
    if (entries[0]!.event.type === 'chunk-sent') {
      expect(entries[0]!.event.boundaryId).toBe('user-data');
    }
    if (entries[1]!.event.type === 'chunk-sent') {
      expect(entries[1]!.event.boundaryId).toBe('stats');
    }
  });

  it('should log stream errors', () => {
    const { entries, logger } = collectEntries();
    const req = logger.request('/broken');
    const err = new Error('boundary failed');

    req.streamError(err);

    expect(entries).toHaveLength(1);
    expect(entries[0]!.level).toBe('error');
    expect(entries[0]!.message).toContain('boundary failed');
  });

  it('should use the correct pathname for all events', () => {
    const { entries, logger } = collectEntries({ level: 'debug' });
    const req = logger.request('/specific-path');

    req.serviceCreated();
    req.renderStart();
    req.renderComplete(0);
    req.chunkSent('x');
    req.streamComplete();
    req.serviceDisposed();

    for (const entry of entries) {
      expect((entry.event as { pathname: string }).pathname).toBe('/specific-path');
    }
  });

  it('should support full lifecycle flow', () => {
    const { entries, logger } = collectEntries({ level: 'debug' });
    const req = logger.request('/full');

    req.serviceCreated();
    req.renderStart();
    req.renderComplete(2);
    req.chunkSent('header');
    req.chunkSent('sidebar');
    req.streamComplete();
    req.serviceDisposed();

    const types = entries.map((e) => e.event.type);
    expect(types).toEqual([
      'service-created',
      'render-start',
      'render-complete',
      'chunk-sent',
      'chunk-sent',
      'stream-complete',
      'service-disposed',
    ]);
  });
});
