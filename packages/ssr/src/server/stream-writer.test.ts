/**
 * Tests for server stream writer
 */

import { describe, it, expect } from 'vitest';
import {
  createServerStreamWriter,
  generateChunkScript,
  generateBootstrapScript,
} from './stream-writer';
import { createStreamWriter } from './stream';

describe('createServerStreamWriter', () => {
  it('should use default stream key when none provided', () => {
    const stream = createServerStreamWriter();
    expect(stream.key).toBe('__RIMITIVE_STREAM__');
  });

  it('should accept a custom stream key', () => {
    const stream = createServerStreamWriter('__MY_APP__');
    expect(stream.key).toBe('__MY_APP__');
  });

  it('should expose underlying StreamWriter methods', () => {
    const stream = createServerStreamWriter('__APP__');
    expect(typeof stream.bootstrapCode).toBe('function');
    expect(typeof stream.chunkCode).toBe('function');
  });

  describe('bootstrapScript', () => {
    it('should wrap bootstrapCode in script tags', () => {
      const stream = createServerStreamWriter('__APP__');
      const script = stream.bootstrapScript();

      expect(script.startsWith('<script>')).toBe(true);
      expect(script.endsWith('</script>')).toBe(true);
      expect(script).toContain('window.__APP__');
      expect(script).toContain('push');
      expect(script).toContain('connect');
    });
  });

  describe('chunkScript', () => {
    it('should wrap chunkCode in script tags', () => {
      const stream = createServerStreamWriter('__APP__');
      const script = stream.chunkScript('user-1', { name: 'Alice' });

      expect(script).toMatch(/^<script>.*<\/script>$/);
      expect(script).toContain('__APP__.push');
      expect(script).toContain('"user-1"');
    });

    it('should escape HTML in data to prevent XSS', () => {
      const stream = createServerStreamWriter('__APP__');
      const script = stream.chunkScript('xss', {
        payload: '</script><img onerror=alert(1)>',
      });

      // The inner content must not contain literal </script>
      const inner = script.slice('<script>'.length, -'</script>'.length);
      expect(inner).not.toContain('</script>');
      expect(inner).toContain('\\u003c');
    });
  });
});

describe('generateChunkScript', () => {
  it('should generate a script tag from a StreamWriter', () => {
    const writer = createStreamWriter('__APP__');
    const script = generateChunkScript(writer, 'stats', { users: 42 });

    expect(script).toMatch(/^<script>.*<\/script>$/);
    expect(script).toContain('__APP__.push');
    expect(script).toContain('"stats"');
    expect(script).toContain('42');
  });

  it('should escape dangerous content', () => {
    const writer = createStreamWriter('__APP__');
    const script = generateChunkScript(writer, 'test', {
      html: '<script>alert(1)</script>',
    });

    const inner = script.slice('<script>'.length, -'</script>'.length);
    expect(inner).not.toContain('<script>');
    expect(inner).toContain('\\u003c');
  });
});

describe('generateBootstrapScript', () => {
  it('should generate a script tag from a StreamWriter', () => {
    const writer = createStreamWriter('__BOOT__');
    const script = generateBootstrapScript(writer);

    expect(script.startsWith('<script>')).toBe(true);
    expect(script.endsWith('</script>')).toBe(true);
    expect(script).toContain('window.__BOOT__');
    expect(script).toContain('push');
    expect(script).toContain('connect');
  });
});
