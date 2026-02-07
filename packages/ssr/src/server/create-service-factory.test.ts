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
});
