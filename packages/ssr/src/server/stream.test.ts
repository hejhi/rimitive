/**
 * Tests for streaming SSR functionality
 */

import { describe, it, expect } from 'vitest';
import { createStreamWriter } from '../server/stream';

describe('createStreamWriter', () => {
  it('should format chunkCode as JS that pushes to receiver', () => {
    const stream = createStreamWriter('__APP__');
    const code = stream.chunkCode('user-123', {
      name: 'Alice',
      age: 30,
    });

    expect(code).toBe('__APP__.push("user-123",{"name":"Alice","age":30});');
  });

  it('should escape quotes in JSON strings', () => {
    const stream = createStreamWriter('__APP__');
    const code = stream.chunkCode('quote-test', {
      message: 'Hello "world"',
    });

    expect(code).toContain('Hello \\"world\\"');
  });

  it('should expose the stream key', () => {
    const stream = createStreamWriter('__MY_STREAM__');
    expect(stream.key).toBe('__MY_STREAM__');
  });

  it('should generate bootstrapCode as JS that creates receiver', () => {
    const stream = createStreamWriter('__BOOT__');
    const code = stream.bootstrapCode();

    expect(code).not.toContain('<script>');
    expect(code).toContain('window.__BOOT__');
    expect(code).toContain('push');
    expect(code).toContain('connect');
  });
});
