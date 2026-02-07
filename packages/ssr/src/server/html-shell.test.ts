/**
 * Tests for HTML Shell generation with hydration data support
 */

import { describe, it, expect } from 'vitest';
import { createHtmlShell } from './html-shell';

describe('createHtmlShell', () => {
  describe('basic structure', () => {
    it('should generate valid HTML document structure', () => {
      const shell = createHtmlShell();
      const html = shell.start + 'content' + shell.appClose + shell.end('/client.js');

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<head>');
      expect(html).toContain('</head>');
      expect(html).toContain('<body>');
      expect(html).toContain('</body>');
      expect(html).toContain('</html>');
    });

    it('should use default title', () => {
      const shell = createHtmlShell();
      expect(shell.start).toContain('<title>Rimitive App</title>');
    });

    it('should use custom title', () => {
      const shell = createHtmlShell({ title: 'My Custom App' });
      expect(shell.start).toContain('<title>My Custom App</title>');
    });

    it('should escape HTML in title', () => {
      const shell = createHtmlShell({ title: '<script>alert("xss")</script>' });
      expect(shell.start).not.toContain('<script>alert');
      expect(shell.start).toContain('&lt;script&gt;');
    });

    it('should use default root id "app"', () => {
      const shell = createHtmlShell();
      expect(shell.start).toContain('<div id="app">');
    });

    it('should support custom root id', () => {
      const shell = createHtmlShell({ rootId: 'root' });
      expect(shell.start).toContain('<div id="root">');
    });

    it('should skip root wrapper when rootId is false', () => {
      const shell = createHtmlShell({ rootId: false });
      expect(shell.start).not.toContain('<div id=');
      expect(shell.start).toContain('<body>');
      expect(shell.appClose).toBe('');
    });

    it('should include meta charset and viewport', () => {
      const shell = createHtmlShell();
      expect(shell.start).toContain('<meta charset="UTF-8">');
      expect(shell.start).toContain('viewport');
    });

    it('should include client script in end', () => {
      const shell = createHtmlShell();
      const end = shell.end('/client.js');
      expect(end).toContain('<script type="module" src="/client.js"></script>');
    });

    it('should escape client script src', () => {
      const shell = createHtmlShell();
      const end = shell.end('"><script>alert(1)</script>');
      // The literal <script> tag must be escaped so it cannot execute
      expect(end).not.toContain('<script>alert');
      expect(end).toContain('&quot;');
      expect(end).toContain('&lt;script&gt;');
    });
  });

  describe('styles', () => {
    it('should include string styles', () => {
      const shell = createHtmlShell({ styles: 'body { margin: 0; }' });
      expect(shell.start).toContain('<style>body { margin: 0; }</style>');
    });

    it('should join array styles', () => {
      const shell = createHtmlShell({
        styles: ['body { margin: 0; }', '.app { color: red; }'],
      });
      expect(shell.start).toContain('<style>body { margin: 0; }\n.app { color: red; }</style>');
    });

    it('should omit style tag when no styles provided', () => {
      const shell = createHtmlShell();
      expect(shell.start).not.toContain('<style>');
    });
  });

  describe('head content', () => {
    it('should include additional head content', () => {
      const shell = createHtmlShell({ head: '<link rel="icon" href="/favicon.ico">' });
      expect(shell.start).toContain('<link rel="icon" href="/favicon.ico">');
    });
  });

  describe('hydration data', () => {
    it('should inject hydration data before client script', () => {
      const shell = createHtmlShell({
        hydrationData: { user: { name: 'Alice', age: 30 } },
      });
      const end = shell.end('/client.js');

      // Hydration script should appear before client script
      const hydrationIdx = end.indexOf('__RIMITIVE_DATA__');
      const clientIdx = end.indexOf('/client.js');
      expect(hydrationIdx).toBeGreaterThan(-1);
      expect(clientIdx).toBeGreaterThan(hydrationIdx);
    });

    it('should use default hydration key __RIMITIVE_DATA__', () => {
      const shell = createHtmlShell({
        hydrationData: { key: 'value' },
      });
      const end = shell.end('/client.js');
      expect(end).toContain('window.__RIMITIVE_DATA__=');
    });

    it('should support custom hydration key', () => {
      const shell = createHtmlShell({
        hydrationData: { key: 'value' },
        hydrationKey: '__MY_APP_DATA__',
      });
      const end = shell.end('/client.js');
      expect(end).toContain('window.__MY_APP_DATA__=');
      expect(end).not.toContain('__RIMITIVE_DATA__');
    });

    it('should serialize data correctly', () => {
      const shell = createHtmlShell({
        hydrationData: { count: 42, items: ['a', 'b'] },
      });
      const end = shell.end('/client.js');
      // The data should be JSON serialized (with safe escaping)
      expect(end).toContain('"count":42');
      expect(end).toContain('"items"');
    });

    it('should safely escape XSS in hydration data', () => {
      const shell = createHtmlShell({
        hydrationData: { payload: '</script><script>alert("xss")</script>' },
      });
      const end = shell.end('/client.js');

      // Must not contain literal </script> within the data script
      // Count script tags - should only be the two expected ones (hydration + client)
      expect(end).not.toContain('</script><script>alert');
      expect(end).toContain('\\u003c');
    });

    it('should escape < and > in hydration data', () => {
      const shell = createHtmlShell({
        hydrationData: { html: '<div>test</div>' },
      });
      const end = shell.end('/client.js');
      expect(end).toContain('\\u003c');
      expect(end).toContain('\\u003e');
    });

    it('should escape & in hydration data', () => {
      const shell = createHtmlShell({
        hydrationData: { text: 'foo & bar' },
      });
      const end = shell.end('/client.js');
      expect(end).toContain('\\u0026');
    });

    it('should handle null hydration data gracefully', () => {
      const shell = createHtmlShell({
        hydrationData: null,
      });
      const end = shell.end('/client.js');
      expect(end).not.toContain('__RIMITIVE_DATA__');
    });

    it('should handle undefined hydration data gracefully', () => {
      const shell = createHtmlShell({
        hydrationData: undefined,
      });
      const end = shell.end('/client.js');
      expect(end).not.toContain('__RIMITIVE_DATA__');
    });

    it('should handle empty object hydration data gracefully', () => {
      const shell = createHtmlShell({
        hydrationData: {},
      });
      const end = shell.end('/client.js');
      expect(end).not.toContain('__RIMITIVE_DATA__');
    });

    it('should omit hydration script when no hydrationData option is provided', () => {
      const shell = createHtmlShell();
      const end = shell.end('/client.js');
      expect(end).not.toContain('__RIMITIVE_DATA__');
      expect(end).toContain('/client.js');
    });
  });

  describe('streaming support', () => {
    it('should create stream writer when streamKey is provided', () => {
      const shell = createHtmlShell({ streamKey: '__APP_STREAM__' });
      expect(shell.stream).toBeDefined();
      expect(shell.stream!.key).toBe('__APP_STREAM__');
    });

    it('should not create stream writer when streamKey is omitted', () => {
      const shell = createHtmlShell();
      expect(shell.stream).toBeUndefined();
    });

    it('should include bootstrap script in head when streaming', () => {
      const shell = createHtmlShell({ streamKey: '__APP_STREAM__' });
      expect(shell.start).toContain('<script>');
      expect(shell.start).toContain('window.__APP_STREAM__');
    });

    it('should not include bootstrap script when not streaming', () => {
      const shell = createHtmlShell();
      expect(shell.start).not.toContain('<script>');
    });
  });

  describe('combined features', () => {
    it('should support streaming with hydration data', () => {
      const shell = createHtmlShell({
        title: 'Streaming App',
        streamKey: '__STREAM__',
        hydrationData: { initial: true },
      });

      // Bootstrap in head
      expect(shell.start).toContain('window.__STREAM__');
      // Hydration data in end
      const end = shell.end('/client.js');
      expect(end).toContain('__RIMITIVE_DATA__');
      expect(end).toContain('/client.js');
    });

    it('should produce correct full document', () => {
      const shell = createHtmlShell({
        title: 'Test',
        styles: 'body { color: black; }',
        hydrationData: { loaded: true },
      });

      const html = shell.start + '<h1>Hello</h1>' + shell.appClose + shell.end('/app.js');

      // Verify ordering
      const doctypeIdx = html.indexOf('<!DOCTYPE html>');
      const titleIdx = html.indexOf('<title>Test</title>');
      const styleIdx = html.indexOf('<style>');
      const contentIdx = html.indexOf('<h1>Hello</h1>');
      const hydrationIdx = html.indexOf('__RIMITIVE_DATA__');
      const scriptIdx = html.indexOf('/app.js');

      expect(doctypeIdx).toBe(0);
      expect(titleIdx).toBeGreaterThan(doctypeIdx);
      expect(styleIdx).toBeGreaterThan(titleIdx);
      expect(contentIdx).toBeGreaterThan(styleIdx);
      expect(hydrationIdx).toBeGreaterThan(contentIdx);
      expect(scriptIdx).toBeGreaterThan(hydrationIdx);
    });
  });
});
