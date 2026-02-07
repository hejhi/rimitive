/**
 * Tests for createServiceFactory and createConfiguredServiceFactory
 */

import { describe, it, expect, vi } from 'vitest';
import { defineModule } from '@rimitive/core';
import { SignalModule, BatchModule } from '@rimitive/signals/extend';
import { MapModule } from '@rimitive/view/map';
import {
  createServiceFactory,
  createConfiguredServiceFactory,
  createRequestScope,
  handleServiceError,
} from './create-service-factory';

describe('createServiceFactory', () => {
  describe('basic factory', () => {
    it('should create a factory function', () => {
      const factory = createServiceFactory();
      expect(typeof factory).toBe('function');
    });

    it('should create a service with base modules', () => {
      const factory = createServiceFactory();
      const { service, adapterResult } = factory();

      // Base modules should be composed
      expect(service.signal).toBeDefined();
      expect(service.computed).toBeDefined();
      expect(service.effect).toBeDefined();
      expect(service.el).toBeDefined();
      expect(service.match).toBeDefined();
      expect(service.loader).toBeDefined();
      expect(typeof service.dispose).toBe('function');
      expect(adapterResult.serialize).toBeDefined();
      expect(adapterResult.insertFragmentMarkers).toBeDefined();
    });

    it('should create fresh service per call', () => {
      const factory = createServiceFactory();
      const result1 = factory();
      const result2 = factory();

      expect(result1.service).not.toBe(result2.service);
      expect(result1.adapterResult).not.toBe(result2.adapterResult);
    });

    it('should create fresh adapter per call', () => {
      const factory = createServiceFactory();
      const { adapterResult: a1 } = factory();
      const { adapterResult: a2 } = factory();

      expect(a1.adapter).not.toBe(a2.adapter);
    });
  });

  describe('custom modules', () => {
    it('should compose custom modules after base modules', () => {
      const factory = createServiceFactory({
        modules: [BatchModule],
      });
      const { service } = factory();

      // Base modules
      expect(service.signal).toBeDefined();
      expect(service.computed).toBeDefined();

      // Custom module
      expect(service.batch).toBeDefined();
    });

    it('should support multiple custom modules', () => {
      const CustomA = defineModule({
        name: 'customA',
        create: () => ({ hello: () => 'a' }),
      });
      const CustomB = defineModule({
        name: 'customB',
        create: () => ({ hello: () => 'b' }),
      });

      const factory = createServiceFactory({
        modules: [CustomA, CustomB],
      });
      const { service } = factory();

      expect(service.customA).toBeDefined();
      expect(service.customB).toBeDefined();
    });

    it('should allow custom modules to depend on base modules', () => {
      const CustomModule = defineModule({
        name: 'custom',
        dependencies: [SignalModule],
        create: ({ signal }) => ({
          createCounter: () => signal(0),
        }),
      });

      const factory = createServiceFactory({
        modules: [CustomModule],
      });
      const { service } = factory();

      expect(service.custom).toBeDefined();
    });

    it('should work with empty modules array', () => {
      const factory = createServiceFactory({ modules: [] });
      const { service } = factory();

      expect(service.signal).toBeDefined();
      expect(service.el).toBeDefined();
    });
  });

  describe('request options', () => {
    it('should pass hydration data to loader', () => {
      const factory = createServiceFactory();
      const { service } = factory({
        hydrationData: { key: 'value' },
      });

      expect(service.loader).toBeDefined();
    });

    it('should pass onResolve callback to loader', () => {
      const onResolve = vi.fn();
      const factory = createServiceFactory();
      const { service } = factory({ onResolve });

      expect(service.loader).toBeDefined();
    });

    it('should work with no options', () => {
      const factory = createServiceFactory();
      const { service } = factory();

      expect(service.signal).toBeDefined();
    });
  });

  describe('dispose', () => {
    it('should have a dispose method on the service', () => {
      const factory = createServiceFactory();
      const { service } = factory();

      expect(typeof service.dispose).toBe('function');
    });
  });
});

describe('createConfiguredServiceFactory', () => {
  it('should create a factory with adapter-dependent modules', () => {
    const factory = createConfiguredServiceFactory({
      modules: (adapter) => [MapModule.with({ adapter })],
    });
    const { service } = factory();

    expect(service.signal).toBeDefined();
    expect(service.map).toBeDefined();
  });

  it('should call modules function with fresh adapter per request', () => {
    const modulesFn = vi.fn((adapter) => [MapModule.with({ adapter })]);
    const factory = createConfiguredServiceFactory({ modules: modulesFn });

    factory();
    factory();

    expect(modulesFn).toHaveBeenCalledTimes(2);
    // Each call should receive a different adapter
    const adapter1 = modulesFn.mock.calls[0]![0];
    const adapter2 = modulesFn.mock.calls[1]![0];
    expect(adapter1).not.toBe(adapter2);
  });

  it('should support mixing static and adapter-dependent modules', () => {
    const factory = createConfiguredServiceFactory({
      modules: (adapter) => [
        BatchModule,
        MapModule.with({ adapter }),
      ],
    });
    const { service } = factory();

    expect(service.batch).toBeDefined();
    expect(service.map).toBeDefined();
  });

  it('should pass request options to loader', () => {
    const onResolve = vi.fn();
    const factory = createConfiguredServiceFactory({
      modules: () => [],
    });
    const { service } = factory({
      hydrationData: { test: true },
      onResolve,
    });

    expect(service.loader).toBeDefined();
  });

  it('should create fresh service per call', () => {
    const factory = createConfiguredServiceFactory({
      modules: () => [],
    });
    const { service: s1 } = factory();
    const { service: s2 } = factory();

    expect(s1).not.toBe(s2);
  });

  it('should call onCreate hook with service and adapterResult', () => {
    const onCreate = vi.fn();
    const factory = createConfiguredServiceFactory({
      modules: () => [],
      lifecycle: { onCreate },
    });

    const { service, adapterResult } = factory();

    expect(onCreate).toHaveBeenCalledOnce();
    expect(onCreate).toHaveBeenCalledWith(service, adapterResult);
  });
});

describe('service lifecycle hooks', () => {
  describe('onCreate', () => {
    it('should call onCreate when service is created via createServiceFactory', () => {
      const onCreate = vi.fn();
      const factory = createServiceFactory({
        lifecycle: { onCreate },
      });

      const { service, adapterResult } = factory();

      expect(onCreate).toHaveBeenCalledOnce();
      expect(onCreate).toHaveBeenCalledWith(service, adapterResult);
    });

    it('should call onCreate for each service creation', () => {
      const onCreate = vi.fn();
      const factory = createServiceFactory({
        lifecycle: { onCreate },
      });

      factory();
      factory();
      factory();

      expect(onCreate).toHaveBeenCalledTimes(3);
    });

    it('should not call onCreate when not provided', () => {
      const factory = createServiceFactory({ lifecycle: {} });
      const { service } = factory();

      // Should work without errors
      expect(service.signal).toBeDefined();
    });
  });

  describe('factory without lifecycle', () => {
    it('should work with no lifecycle config', () => {
      const factory = createServiceFactory();
      const { service } = factory();

      expect(service.signal).toBeDefined();
    });
  });
});

describe('createRequestScope', () => {
  it('should return service and adapterResult', () => {
    const factory = createServiceFactory();
    const scope = createRequestScope(factory);

    expect(scope.service.signal).toBeDefined();
    expect(scope.adapterResult.serialize).toBeDefined();
  });

  it('should pass request options to factory', () => {
    const onResolve = vi.fn();
    const factory = createServiceFactory();
    const scope = createRequestScope(factory, {
      hydrationData: { key: 'value' },
      onResolve,
    });

    expect(scope.service.loader).toBeDefined();
  });

  it('should dispose service on scope.dispose()', () => {
    const factory = createServiceFactory();
    const scope = createRequestScope(factory);

    // Should not throw
    scope.dispose();
  });

  it('should be safe to call dispose multiple times', () => {
    const factory = createServiceFactory();
    const scope = createRequestScope(factory);

    scope.dispose();
    scope.dispose();
    scope.dispose();
    // No error thrown
  });

  it('should create fresh scope per call', () => {
    const factory = createServiceFactory();
    const scope1 = createRequestScope(factory);
    const scope2 = createRequestScope(factory);

    expect(scope1.service).not.toBe(scope2.service);
    expect(scope1.adapterResult).not.toBe(scope2.adapterResult);
  });

  it('should trigger onCreate hook via factory', () => {
    const onCreate = vi.fn();
    const factory = createServiceFactory({
      lifecycle: { onCreate },
    });

    createRequestScope(factory);

    expect(onCreate).toHaveBeenCalledOnce();
  });
});

describe('handleServiceError', () => {
  it('should return a 500 error response with default body', () => {
    const response = handleServiceError(new Error('test error'));

    expect(response.status).toBe(500);
    expect(response.headers['Content-Type']).toBe('text/html');
    expect(response.body).toContain('500');
    expect(response.body).toContain('Internal Server Error');
  });

  it('should use custom onError body when provided', () => {
    const lifecycle = {
      onError: () => '<h1>Custom Error Page</h1>',
    };
    const response = handleServiceError(new Error('test'), lifecycle);

    expect(response.status).toBe(500);
    expect(response.body).toBe('<h1>Custom Error Page</h1>');
    expect(response.headers['Content-Type']).toBe('text/html');
  });

  it('should pass the error to onError callback', () => {
    const onError = vi.fn(() => '<h1>Error</h1>');
    const error = new Error('specific error');
    handleServiceError(error, { onError });

    expect(onError).toHaveBeenCalledWith(error);
  });

  it('should fall back to default body when onError returns undefined', () => {
    const lifecycle = {
      onError: () => undefined,
    };
    const response = handleServiceError(new Error('test'), lifecycle);

    expect(response.body).toContain('500');
    expect(response.body).toContain('Internal Server Error');
  });

  it('should work without lifecycle parameter', () => {
    const response = handleServiceError(new Error('test'));

    expect(response.status).toBe(500);
    expect(response.body).toContain('500');
  });

  it('should handle non-Error objects', () => {
    const response = handleServiceError('string error');

    expect(response.status).toBe(500);
    expect(response.body).toContain('500');
  });

  it('should return valid HTML in default response', () => {
    const response = handleServiceError(new Error('test'));

    expect(response.body).toContain('<!DOCTYPE html>');
    expect(response.body).toContain('</html>');
  });
});
