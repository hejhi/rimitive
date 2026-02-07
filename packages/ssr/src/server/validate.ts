/**
 * Configuration Validation
 *
 * Runtime validation for SSR server configuration objects. Catches common
 * mistakes early with clear, actionable error messages instead of cryptic
 * failures deep in the rendering pipeline.
 */

import { existsSync } from 'node:fs';
import type { StreamingServerConfig } from './streaming-server';
import type { StaticHandlerConfig } from './static-handler';
import type { DataPrefetchHandlerConfig } from './data-prefetch-handler';
import type { DevServerConfig } from './dev';

// ---------------------------------------------------------------------------
// Validation Error
// ---------------------------------------------------------------------------

/**
 * Error thrown when configuration validation fails.
 *
 * Contains a structured list of issues found during validation,
 * formatted as a single readable message.
 */
export class ConfigValidationError extends Error {
  /** Individual validation issues found */
  readonly issues: string[];

  constructor(configName: string, issues: string[]) {
    const message = `Invalid ${configName} configuration:\n${issues.map((i) => `  - ${i}`).join('\n')}`;
    super(message);
    this.name = 'ConfigValidationError';
    this.issues = issues;
  }
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkRequired(
  obj: Record<string, unknown>,
  field: string,
  expectedType: string,
  issues: string[],
): void {
  if (!(field in obj) || obj[field] === undefined) {
    issues.push(`Missing required field "${field}". Expected ${expectedType}.`);
  } else if (expectedType === 'function' && typeof obj[field] !== 'function') {
    issues.push(
      `"${field}" must be a function, got ${typeof obj[field]}.`,
    );
  } else if (expectedType === 'string' && typeof obj[field] !== 'string') {
    issues.push(
      `"${field}" must be a string, got ${typeof obj[field]}.`,
    );
  }
}

function checkOptionalType(
  obj: Record<string, unknown>,
  field: string,
  expectedType: string,
  issues: string[],
): void {
  if (field in obj && obj[field] !== undefined && typeof obj[field] !== expectedType) {
    issues.push(
      `"${field}" must be a ${expectedType} if provided, got ${typeof obj[field]}.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Streaming Server Config Validation
// ---------------------------------------------------------------------------

/**
 * Validate a streaming server configuration object.
 *
 * Checks that all required fields are present and have correct types,
 * and that the shell sub-config includes a `streamKey` for streaming.
 *
 * @returns The validated config, cast to the proper type.
 * @throws {ConfigValidationError} If validation fails.
 *
 * @example
 * ```ts
 * const config = validateStreamingServerConfig({
 *   shell: { streamKey: '__APP__', title: 'My App' },
 *   clientSrc: '/client.js',
 *   createService: ({ pathname, onResolve }) => ({ ... }),
 *   createApp: (svc) => AppLayout(svc),
 *   mount: (svc) => (spec) => spec.create(svc),
 * });
 *
 * const handler = createStreamingServer(config);
 * ```
 */
export function validateStreamingServerConfig(
  config: unknown,
): StreamingServerConfig<unknown> {
  const issues: string[] = [];

  if (!isObject(config)) {
    throw new ConfigValidationError('StreamingServerConfig', [
      'Configuration must be an object.',
    ]);
  }

  // shell (required object with streamKey)
  if (!('shell' in config) || !isObject(config.shell)) {
    issues.push(
      'Missing required field "shell". Expected an object with at least { streamKey: string }.',
    );
  } else {
    const shell = config.shell;
    if (!('streamKey' in shell) || typeof shell.streamKey !== 'string') {
      issues.push(
        '"shell.streamKey" is required and must be a string (e.g., "__APP_STREAM__").',
      );
    } else if (shell.streamKey.length === 0) {
      issues.push('"shell.streamKey" must not be empty.');
    }

    if ('title' in shell && typeof shell.title !== 'string') {
      issues.push('"shell.title" must be a string if provided.');
    }
    if ('styles' in shell && shell.styles !== undefined) {
      const styles = shell.styles;
      if (typeof styles !== 'string' && !Array.isArray(styles)) {
        issues.push('"shell.styles" must be a string or array of strings.');
      } else if (
        Array.isArray(styles) &&
        styles.some((s) => typeof s !== 'string')
      ) {
        issues.push('"shell.styles" array must contain only strings.');
      }
    }
    if ('head' in shell && typeof shell.head !== 'string') {
      issues.push('"shell.head" must be a string if provided.');
    }
  }

  // clientSrc (required string)
  checkRequired(config, 'clientSrc', 'string', issues);
  if (
    typeof config.clientSrc === 'string' &&
    !config.clientSrc.startsWith('/')
  ) {
    issues.push(
      `"clientSrc" should be an absolute URL path starting with "/" (got "${config.clientSrc}"). ` +
        'Example: "/client.js".',
    );
  }

  // createService (required function)
  checkRequired(config, 'createService', 'function', issues);

  // createApp (required function)
  checkRequired(config, 'createApp', 'function', issues);

  // mount (required function)
  checkRequired(config, 'mount', 'function', issues);

  if (issues.length > 0) {
    throw new ConfigValidationError('StreamingServerConfig', issues);
  }

  return config as StreamingServerConfig<unknown>;
}

// ---------------------------------------------------------------------------
// Static Handler Config Validation
// ---------------------------------------------------------------------------

/**
 * Validate a static handler configuration object.
 *
 * Checks that `clientDir` exists on disk and that `urlPatterns` is a
 * non-empty array of strings starting with "/".
 *
 * @returns The validated config, cast to the proper type.
 * @throws {ConfigValidationError} If validation fails.
 *
 * @example
 * ```ts
 * const config = validateStaticHandlerConfig({
 *   clientDir: join(__dirname, '../dist/client'),
 *   urlPatterns: ['/client.js', '/assets/'],
 * });
 *
 * const serveStatic = createStaticHandler(config);
 * ```
 */
export function validateStaticHandlerConfig(
  config: unknown,
): StaticHandlerConfig {
  const issues: string[] = [];

  if (!isObject(config)) {
    throw new ConfigValidationError('StaticHandlerConfig', [
      'Configuration must be an object.',
    ]);
  }

  // clientDir (required string, must exist)
  checkRequired(config, 'clientDir', 'string', issues);
  if (typeof config.clientDir === 'string') {
    if (config.clientDir.length === 0) {
      issues.push('"clientDir" must not be empty.');
    } else if (!existsSync(config.clientDir)) {
      issues.push(
        `"clientDir" path does not exist: "${config.clientDir}". ` +
          'Ensure the client build has been run before starting the server.',
      );
    }
  }

  // urlPatterns (required non-empty array of strings)
  if (!('urlPatterns' in config) || !Array.isArray(config.urlPatterns)) {
    issues.push(
      'Missing required field "urlPatterns". Expected an array of URL pattern strings (e.g., [\'/client.js\', \'/assets/\']).',
    );
  } else {
    if (config.urlPatterns.length === 0) {
      issues.push(
        '"urlPatterns" must contain at least one pattern.',
      );
    }
    for (let i = 0; i < config.urlPatterns.length; i++) {
      const pattern = config.urlPatterns[i];
      if (typeof pattern !== 'string') {
        issues.push(
          `"urlPatterns[${i}]" must be a string, got ${typeof pattern}.`,
        );
      } else if (!pattern.startsWith('/')) {
        issues.push(
          `"urlPatterns[${i}]" must start with "/" (got "${pattern}").`,
        );
      }
    }

    // Check for conflicting patterns (exact pattern that is also a prefix)
    const patterns = config.urlPatterns.filter(
      (p: unknown): p is string => typeof p === 'string',
    );
    for (const pattern of patterns) {
      if (!pattern.endsWith('/')) {
        // Check if an exact match is also covered by a prefix pattern
        const conflicting = patterns.find(
          (p) =>
            p !== pattern &&
            p.endsWith('/') &&
            pattern.startsWith(p),
        );
        if (conflicting) {
          issues.push(
            `Conflicting URL patterns: "${pattern}" is already covered by prefix pattern "${conflicting}". ` +
              'The exact pattern will never match because the prefix takes precedence.',
          );
        }
      }
    }
  }

  if (issues.length > 0) {
    throw new ConfigValidationError('StaticHandlerConfig', issues);
  }

  return config as StaticHandlerConfig;
}

// ---------------------------------------------------------------------------
// Data Prefetch Handler Config Validation
// ---------------------------------------------------------------------------

/**
 * Validate a data prefetch handler configuration object.
 *
 * Checks that all required callback functions are present and that the
 * optional `prefix` starts with "/".
 *
 * @returns The validated config, cast to the proper type.
 * @throws {ConfigValidationError} If validation fails.
 *
 * @example
 * ```ts
 * const config = validateDataPrefetchHandlerConfig({
 *   createService: (path) => createAppService(path),
 *   createApp: (svc) => App(svc),
 *   mount: (svc) => (spec) => spec.create(svc),
 *   getData: (svc) => svc.loader.getData(),
 * });
 *
 * const handlePrefetch = createDataPrefetchHandler(config);
 * ```
 */
export function validateDataPrefetchHandlerConfig(
  config: unknown,
): DataPrefetchHandlerConfig<unknown> {
  const issues: string[] = [];

  if (!isObject(config)) {
    throw new ConfigValidationError('DataPrefetchHandlerConfig', [
      'Configuration must be an object.',
    ]);
  }

  // prefix (optional string, must start with /)
  if ('prefix' in config && config.prefix !== undefined) {
    if (typeof config.prefix !== 'string') {
      issues.push(`"prefix" must be a string, got ${typeof config.prefix}.`);
    } else if (!config.prefix.startsWith('/')) {
      issues.push(
        `"prefix" must start with "/" (got "${config.prefix}"). Example: "/_data".`,
      );
    }
  }

  // createService (required function)
  checkRequired(config, 'createService', 'function', issues);

  // createApp (required function)
  checkRequired(config, 'createApp', 'function', issues);

  // mount (required function)
  checkRequired(config, 'mount', 'function', issues);

  // getData (required function)
  checkRequired(config, 'getData', 'function', issues);

  if (issues.length > 0) {
    throw new ConfigValidationError('DataPrefetchHandlerConfig', issues);
  }

  return config as DataPrefetchHandlerConfig<unknown>;
}

// ---------------------------------------------------------------------------
// Dev Server Config Validation
// ---------------------------------------------------------------------------

/**
 * Validate a development server configuration object.
 *
 * Checks that the required `handler` is a function and that optional
 * fields have correct types (port range, middleware array, etc.).
 *
 * @returns The validated config, cast to the proper type.
 * @throws {ConfigValidationError} If validation fails.
 *
 * @example
 * ```ts
 * const config = validateDevServerConfig({
 *   handler: handleStreaming,
 *   port: 3000,
 *   middleware: [serveStatic],
 * });
 *
 * const dev = createDevServer(config);
 * ```
 */
export function validateDevServerConfig(
  config: unknown,
): DevServerConfig {
  const issues: string[] = [];

  if (!isObject(config)) {
    throw new ConfigValidationError('DevServerConfig', [
      'Configuration must be an object.',
    ]);
  }

  // handler (required function)
  checkRequired(config, 'handler', 'function', issues);

  // port (optional number, must be valid port range)
  if ('port' in config && config.port !== undefined) {
    if (typeof config.port !== 'number') {
      issues.push(`"port" must be a number, got ${typeof config.port}.`);
    } else if (
      !Number.isInteger(config.port) ||
      config.port < 0 ||
      config.port > 65535
    ) {
      issues.push(
        `"port" must be an integer between 0 and 65535 (got ${config.port}).`,
      );
    }
  }

  // onReady (optional function)
  checkOptionalType(config, 'onReady', 'function', issues);

  // logging (optional boolean or object)
  if ('logging' in config && config.logging !== undefined) {
    if (typeof config.logging !== 'boolean' && !isObject(config.logging)) {
      issues.push(
        '"logging" must be a boolean or a RequestLoggerOptions object.',
      );
    }
  }

  // middleware (optional array of functions)
  if ('middleware' in config && config.middleware !== undefined) {
    if (!Array.isArray(config.middleware)) {
      issues.push('"middleware" must be an array of handler functions.');
    } else {
      for (let i = 0; i < config.middleware.length; i++) {
        if (typeof config.middleware[i] !== 'function') {
          issues.push(
            `"middleware[${i}]" must be a function, got ${typeof config.middleware[i]}.`,
          );
        }
      }
    }
  }

  // errorPages (optional boolean)
  checkOptionalType(config, 'errorPages', 'boolean', issues);

  if (issues.length > 0) {
    throw new ConfigValidationError('DevServerConfig', issues);
  }

  return config as DevServerConfig;
}
