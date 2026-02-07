/**
 * Tests for configuration validation utilities.
 *
 * Verifies that each validator catches missing fields, wrong types,
 * and common user mistakes with helpful error messages.
 */

import { describe, it, expect } from 'vitest';
import {
  ConfigValidationError,
  validateStreamingServerConfig,
  validateStaticHandlerConfig,
  validateDataPrefetchHandlerConfig,
  validateDevServerConfig,
} from './validate';

// ============================================================================
// Helpers
// ============================================================================

const noop = () => {};

function validStreamingConfig() {
  return {
    shell: { streamKey: '__APP__', title: 'Test' },
    clientSrc: '/client.js',
    createService: noop,
    createApp: noop,
    mount: noop,
  };
}

function validDataPrefetchConfig() {
  return {
    createService: noop,
    createApp: noop,
    mount: noop,
    getData: noop,
  };
}

function validDevServerConfig() {
  return {
    handler: noop,
  };
}

// ============================================================================
// ConfigValidationError
// ============================================================================

describe('ConfigValidationError', () => {
  it('should include config name and issues in message', () => {
    const err = new ConfigValidationError('TestConfig', ['issue one', 'issue two']);
    expect(err.message).toContain('Invalid TestConfig configuration');
    expect(err.message).toContain('issue one');
    expect(err.message).toContain('issue two');
    expect(err.name).toBe('ConfigValidationError');
    expect(err.issues).toEqual(['issue one', 'issue two']);
  });

  it('should be an instance of Error', () => {
    const err = new ConfigValidationError('X', ['y']);
    expect(err).toBeInstanceOf(Error);
  });
});

// ============================================================================
// validateStreamingServerConfig
// ============================================================================

describe('validateStreamingServerConfig', () => {
  it('should accept a valid configuration', () => {
    const config = validStreamingConfig();
    expect(validateStreamingServerConfig(config)).toBe(config);
  });

  it('should reject non-object input', () => {
    expect(() => validateStreamingServerConfig(null)).toThrow(
      ConfigValidationError,
    );
    expect(() => validateStreamingServerConfig('string')).toThrow(
      'must be an object',
    );
    expect(() => validateStreamingServerConfig(42)).toThrow(
      'must be an object',
    );
  });

  // --- shell ---

  it('should require shell object', () => {
    const config = { ...validStreamingConfig(), shell: undefined };
    expect(() => validateStreamingServerConfig(config)).toThrow('shell');
  });

  it('should reject shell that is not an object', () => {
    const config = { ...validStreamingConfig(), shell: 'bad' };
    expect(() => validateStreamingServerConfig(config)).toThrow('shell');
  });

  it('should require shell.streamKey', () => {
    const config = {
      ...validStreamingConfig(),
      shell: { title: 'No key' },
    };
    expect(() => validateStreamingServerConfig(config)).toThrow('streamKey');
  });

  it('should reject empty shell.streamKey', () => {
    const config = {
      ...validStreamingConfig(),
      shell: { streamKey: '' },
    };
    expect(() => validateStreamingServerConfig(config)).toThrow('must not be empty');
  });

  it('should reject non-string shell.streamKey', () => {
    const config = {
      ...validStreamingConfig(),
      shell: { streamKey: 123 },
    };
    expect(() => validateStreamingServerConfig(config)).toThrow('streamKey');
  });

  it('should reject non-string shell.title', () => {
    const config = {
      ...validStreamingConfig(),
      shell: { streamKey: '__X__', title: 42 },
    };
    expect(() => validateStreamingServerConfig(config)).toThrow('shell.title');
  });

  it('should reject invalid shell.styles type', () => {
    const config = {
      ...validStreamingConfig(),
      shell: { streamKey: '__X__', styles: 42 },
    };
    expect(() => validateStreamingServerConfig(config)).toThrow('shell.styles');
  });

  it('should reject shell.styles array with non-strings', () => {
    const config = {
      ...validStreamingConfig(),
      shell: { streamKey: '__X__', styles: ['ok', 123] },
    };
    expect(() => validateStreamingServerConfig(config)).toThrow('shell.styles');
  });

  it('should accept shell.styles as string', () => {
    const config = {
      ...validStreamingConfig(),
      shell: { streamKey: '__X__', styles: 'body { color: red; }' },
    };
    expect(validateStreamingServerConfig(config)).toBe(config);
  });

  it('should accept shell.styles as string array', () => {
    const config = {
      ...validStreamingConfig(),
      shell: { streamKey: '__X__', styles: ['a', 'b'] },
    };
    expect(validateStreamingServerConfig(config)).toBe(config);
  });

  it('should reject non-string shell.head', () => {
    const config = {
      ...validStreamingConfig(),
      shell: { streamKey: '__X__', head: true },
    };
    expect(() => validateStreamingServerConfig(config)).toThrow('shell.head');
  });

  // --- clientSrc ---

  it('should require clientSrc', () => {
    const { clientSrc: _, ...config } = validStreamingConfig();
    expect(() => validateStreamingServerConfig(config)).toThrow('clientSrc');
  });

  it('should reject clientSrc not starting with /', () => {
    const config = { ...validStreamingConfig(), clientSrc: 'client.js' };
    expect(() => validateStreamingServerConfig(config)).toThrow(
      'should be an absolute URL path starting with "/"',
    );
  });

  it('should reject non-string clientSrc', () => {
    const config = { ...validStreamingConfig(), clientSrc: 42 };
    expect(() => validateStreamingServerConfig(config)).toThrow('string');
  });

  // --- callbacks ---

  it('should require createService', () => {
    const { createService: _, ...config } = validStreamingConfig();
    expect(() => validateStreamingServerConfig(config)).toThrow('createService');
  });

  it('should reject non-function createService', () => {
    const config = { ...validStreamingConfig(), createService: 'not-a-fn' };
    expect(() => validateStreamingServerConfig(config)).toThrow('function');
  });

  it('should require createApp', () => {
    const { createApp: _, ...config } = validStreamingConfig();
    expect(() => validateStreamingServerConfig(config)).toThrow('createApp');
  });

  it('should require mount', () => {
    const { mount: _, ...config } = validStreamingConfig();
    expect(() => validateStreamingServerConfig(config)).toThrow('mount');
  });

  // --- multiple issues ---

  it('should report multiple issues at once', () => {
    try {
      validateStreamingServerConfig({});
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigValidationError);
      const err = e as ConfigValidationError;
      expect(err.issues.length).toBeGreaterThan(1);
    }
  });
});

// ============================================================================
// validateStaticHandlerConfig
// ============================================================================

describe('validateStaticHandlerConfig', () => {
  it('should accept a valid configuration', () => {
    const config = {
      clientDir: __dirname,
      urlPatterns: ['/client.js', '/assets/'],
    };
    expect(validateStaticHandlerConfig(config)).toBe(config);
  });

  it('should reject non-object input', () => {
    expect(() => validateStaticHandlerConfig(null)).toThrow(
      'must be an object',
    );
  });

  // --- clientDir ---

  it('should require clientDir', () => {
    expect(() =>
      validateStaticHandlerConfig({ urlPatterns: ['/a'] }),
    ).toThrow('clientDir');
  });

  it('should reject non-string clientDir', () => {
    expect(() =>
      validateStaticHandlerConfig({ clientDir: 42, urlPatterns: ['/a'] }),
    ).toThrow('string');
  });

  it('should reject empty clientDir', () => {
    expect(() =>
      validateStaticHandlerConfig({ clientDir: '', urlPatterns: ['/a'] }),
    ).toThrow('must not be empty');
  });

  it('should warn when clientDir does not exist', () => {
    expect(() =>
      validateStaticHandlerConfig({
        clientDir: '/definitely/not/a/real/path',
        urlPatterns: ['/a'],
      }),
    ).toThrow('does not exist');
  });

  // --- urlPatterns ---

  it('should require urlPatterns', () => {
    expect(() =>
      validateStaticHandlerConfig({ clientDir: __dirname }),
    ).toThrow('urlPatterns');
  });

  it('should reject non-array urlPatterns', () => {
    expect(() =>
      validateStaticHandlerConfig({
        clientDir: __dirname,
        urlPatterns: '/client.js',
      }),
    ).toThrow('array');
  });

  it('should reject empty urlPatterns', () => {
    expect(() =>
      validateStaticHandlerConfig({ clientDir: __dirname, urlPatterns: [] }),
    ).toThrow('at least one');
  });

  it('should reject non-string pattern items', () => {
    expect(() =>
      validateStaticHandlerConfig({
        clientDir: __dirname,
        urlPatterns: [123],
      }),
    ).toThrow('must be a string');
  });

  it('should reject patterns not starting with /', () => {
    expect(() =>
      validateStaticHandlerConfig({
        clientDir: __dirname,
        urlPatterns: ['assets/'],
      }),
    ).toThrow('must start with "/"');
  });

  it('should detect conflicting exact and prefix patterns', () => {
    expect(() =>
      validateStaticHandlerConfig({
        clientDir: __dirname,
        urlPatterns: ['/assets/', '/assets/style.css'],
      }),
    ).toThrow('Conflicting');
  });

  it('should not flag non-conflicting patterns', () => {
    const config = {
      clientDir: __dirname,
      urlPatterns: ['/client.js', '/assets/'],
    };
    expect(validateStaticHandlerConfig(config)).toBe(config);
  });
});

// ============================================================================
// validateDataPrefetchHandlerConfig
// ============================================================================

describe('validateDataPrefetchHandlerConfig', () => {
  it('should accept a valid configuration', () => {
    const config = validDataPrefetchConfig();
    expect(validateDataPrefetchHandlerConfig(config)).toBe(config);
  });

  it('should reject non-object input', () => {
    expect(() => validateDataPrefetchHandlerConfig([])).toThrow(
      'must be an object',
    );
  });

  it('should require createService', () => {
    const { createService: _, ...config } = validDataPrefetchConfig();
    expect(() => validateDataPrefetchHandlerConfig(config)).toThrow(
      'createService',
    );
  });

  it('should require createApp', () => {
    const { createApp: _, ...config } = validDataPrefetchConfig();
    expect(() => validateDataPrefetchHandlerConfig(config)).toThrow(
      'createApp',
    );
  });

  it('should require mount', () => {
    const { mount: _, ...config } = validDataPrefetchConfig();
    expect(() => validateDataPrefetchHandlerConfig(config)).toThrow('mount');
  });

  it('should require getData', () => {
    const { getData: _, ...config } = validDataPrefetchConfig();
    expect(() => validateDataPrefetchHandlerConfig(config)).toThrow('getData');
  });

  it('should accept optional prefix', () => {
    const config = { ...validDataPrefetchConfig(), prefix: '/_api' };
    expect(validateDataPrefetchHandlerConfig(config)).toBe(config);
  });

  it('should reject non-string prefix', () => {
    const config = { ...validDataPrefetchConfig(), prefix: 42 };
    expect(() => validateDataPrefetchHandlerConfig(config)).toThrow('string');
  });

  it('should reject prefix not starting with /', () => {
    const config = { ...validDataPrefetchConfig(), prefix: 'data' };
    expect(() => validateDataPrefetchHandlerConfig(config)).toThrow(
      'must start with "/"',
    );
  });

  it('should report multiple missing callbacks at once', () => {
    try {
      validateDataPrefetchHandlerConfig({});
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigValidationError);
      const err = e as ConfigValidationError;
      expect(err.issues.length).toBe(4);
    }
  });
});

// ============================================================================
// validateDevServerConfig
// ============================================================================

describe('validateDevServerConfig', () => {
  it('should accept a valid minimal configuration', () => {
    const config = validDevServerConfig();
    expect(validateDevServerConfig(config)).toBe(config);
  });

  it('should reject non-object input', () => {
    expect(() => validateDevServerConfig(undefined)).toThrow(
      'must be an object',
    );
  });

  // --- handler ---

  it('should require handler', () => {
    expect(() => validateDevServerConfig({})).toThrow('handler');
  });

  it('should reject non-function handler', () => {
    expect(() => validateDevServerConfig({ handler: 'bad' })).toThrow(
      'function',
    );
  });

  // --- port ---

  it('should accept valid port number', () => {
    const config = { ...validDevServerConfig(), port: 8080 };
    expect(validateDevServerConfig(config)).toBe(config);
  });

  it('should reject non-number port', () => {
    expect(() =>
      validateDevServerConfig({ ...validDevServerConfig(), port: '3000' }),
    ).toThrow('number');
  });

  it('should reject negative port', () => {
    expect(() =>
      validateDevServerConfig({ ...validDevServerConfig(), port: -1 }),
    ).toThrow('between 0 and 65535');
  });

  it('should reject port above 65535', () => {
    expect(() =>
      validateDevServerConfig({ ...validDevServerConfig(), port: 70000 }),
    ).toThrow('between 0 and 65535');
  });

  it('should reject non-integer port', () => {
    expect(() =>
      validateDevServerConfig({ ...validDevServerConfig(), port: 3000.5 }),
    ).toThrow('integer');
  });

  // --- onReady ---

  it('should reject non-function onReady', () => {
    expect(() =>
      validateDevServerConfig({ ...validDevServerConfig(), onReady: 'bad' }),
    ).toThrow('function');
  });

  // --- logging ---

  it('should accept boolean logging', () => {
    const config = { ...validDevServerConfig(), logging: false };
    expect(validateDevServerConfig(config)).toBe(config);
  });

  it('should accept object logging', () => {
    const config = {
      ...validDevServerConfig(),
      logging: { exclude: ['/assets/'] },
    };
    expect(validateDevServerConfig(config)).toBe(config);
  });

  it('should reject invalid logging type', () => {
    expect(() =>
      validateDevServerConfig({ ...validDevServerConfig(), logging: 42 }),
    ).toThrow('boolean or a RequestLoggerOptions');
  });

  // --- middleware ---

  it('should accept array of functions as middleware', () => {
    const config = {
      ...validDevServerConfig(),
      middleware: [noop, noop],
    };
    expect(validateDevServerConfig(config)).toBe(config);
  });

  it('should reject non-array middleware', () => {
    expect(() =>
      validateDevServerConfig({ ...validDevServerConfig(), middleware: noop }),
    ).toThrow('array');
  });

  it('should reject non-function items in middleware array', () => {
    expect(() =>
      validateDevServerConfig({
        ...validDevServerConfig(),
        middleware: [noop, 'bad'],
      }),
    ).toThrow('middleware[1]');
  });

  // --- errorPages ---

  it('should accept boolean errorPages', () => {
    const config = { ...validDevServerConfig(), errorPages: false };
    expect(validateDevServerConfig(config)).toBe(config);
  });

  it('should reject non-boolean errorPages', () => {
    expect(() =>
      validateDevServerConfig({ ...validDevServerConfig(), errorPages: 'yes' }),
    ).toThrow('boolean');
  });
});
