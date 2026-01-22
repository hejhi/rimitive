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

  it('should escape </script> to prevent XSS', () => {
    const stream = createStreamWriter('__APP__');
    const code = stream.chunkCode('xss-test', {
      payload: '</script><img src=x onerror=alert("xss")>',
    });

    // Must not contain literal </script> which would break out of script tag
    expect(code).not.toContain('</script>');
    // Should use unicode escape for <
    expect(code).toContain('\\u003c');
  });

  it('should escape < and > in all contexts', () => {
    const stream = createStreamWriter('__APP__');
    const code = stream.chunkCode('html-test', {
      html: '<div>test</div>',
      nested: { value: '<script>alert(1)</script>' },
    });

    expect(code).not.toContain('<div>');
    expect(code).not.toContain('<script>');
    expect(code).toContain('\\u003c');
    expect(code).toContain('\\u003e');
  });

  it('should escape line separators for JS compatibility', () => {
    const stream = createStreamWriter('__APP__');
    const code = stream.chunkCode('line-sep-test', {
      // U+2028 Line Separator and U+2029 Paragraph Separator
      text: 'line\u2028separator\u2029here',
    });

    // These should be escaped as unicode sequences
    expect(code).not.toContain('\u2028');
    expect(code).not.toContain('\u2029');
  });

  it('should escape ampersands to prevent HTML entity interpretation', () => {
    const stream = createStreamWriter('__APP__');
    const code = stream.chunkCode('amp-test', {
      text: 'foo & bar &amp; baz',
    });

    expect(code).not.toContain('&');
    expect(code).toContain('\\u0026');
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
