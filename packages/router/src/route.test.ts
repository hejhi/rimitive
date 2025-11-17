import { describe, it, expect } from 'vitest';
import { createRouteFactory } from './route';

describe('createRouteFactory', () => {
  it('should create a route factory with name and method', () => {
    const factory = createRouteFactory();

    expect(factory.name).toBe('route');
    expect(factory.method).toBeTypeOf('function');
  });

  it('should throw not implemented error when called', () => {
    const factory = createRouteFactory();

    expect(() => factory.method()).toThrow('Not implemented yet');
  });
});
