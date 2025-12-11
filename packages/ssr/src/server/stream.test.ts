/**
 * Tests for streaming SSR functionality
 */

import { describe, it, expect } from 'vitest';
import { createStreamWriter } from '../server/stream';

describe('createStreamWriter', () => {
  it('should format chunk as script tag that pushes to proxy', () => {
    const stream = createStreamWriter('__APP__');
    const chunk = stream.chunk('user-123', {
      name: 'Alice',
      age: 30,
    });

    expect(chunk).toBe(
      '<script>__APP__.push("user-123",{"name":"Alice","age":30})</script>'
    );
  });

  it('should escape quotes in JSON strings', () => {
    const stream = createStreamWriter('__APP__');
    const chunk = stream.chunk('quote-test', {
      message: 'Hello "world"',
    });

    expect(chunk).toContain('Hello \\"world\\"');
  });

  it('should expose the stream key', () => {
    const stream = createStreamWriter('__MY_STREAM__');
    expect(stream.key).toBe('__MY_STREAM__');
  });

  it('should generate bootstrap script', () => {
    const stream = createStreamWriter('__BOOT__');
    const bootstrap = stream.bootstrap();

    expect(bootstrap).toContain('<script>');
    expect(bootstrap).toContain('window.__BOOT__');
    expect(bootstrap).toContain('push');
    expect(bootstrap).toContain('connect');
  });
});
