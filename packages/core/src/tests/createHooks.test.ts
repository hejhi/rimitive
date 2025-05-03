import { vi, describe, it, expect, afterEach } from 'vitest';
import { createHooks } from '../createHooks';

// Define a test API type for the hooks
interface TestAPI {
  testMethod: (arg1: string, arg2: string) => void;
  anotherMethod: () => void;
}

describe('createHooks', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // Test basic creation and structure of the hooks system
  it('should create a hooks system with before and after methods', () => {
    const hooks = createHooks<TestAPI>();

    expect(hooks).toBeDefined();
    expect(typeof hooks.before).toBe('function');
    expect(typeof hooks.after).toBe('function');
    expect(hooks._beforeHooks).toBeDefined();
    expect(hooks._afterHooks).toBeDefined();
  });

  // Test registration of before hooks
  it('should register before hooks for a method', () => {
    const hooks = createHooks<TestAPI>();
    const callback = vi.fn();

    hooks.before('testMethod', callback);

    expect(hooks._beforeHooks['testMethod']).toContain(callback);
  });

  // Test registration of after hooks
  it('should register after hooks for a method', () => {
    const hooks = createHooks<TestAPI>();
    const callback = vi.fn();

    hooks.after('testMethod', callback);

    expect(hooks._afterHooks['testMethod']).toContain(callback);
  });

  // Test registration order preservation
  it('should register multiple hooks for the same method in order', () => {
    const hooks = createHooks<TestAPI>();
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    hooks.before('testMethod', callback1);
    hooks.before('testMethod', callback2);

    // Ensure _beforeHooks and _beforeHooks['testMethod'] exist
    expect(hooks._beforeHooks).toBeDefined();
    expect(hooks._beforeHooks['testMethod']).toBeDefined();
    expect(hooks._beforeHooks['testMethod']?.length).toBe(2);
    expect(hooks._beforeHooks['testMethod']?.[0]).toBe(callback1);
    expect(hooks._beforeHooks['testMethod']?.[1]).toBe(callback2);
  });

  // Test hook removal functionality
  it('should allow removing registered hooks', () => {
    const hooks = createHooks<TestAPI>();
    const callback = vi.fn();

    hooks.before('testMethod', callback);
    hooks.remove('before', 'testMethod', callback);

    expect(hooks._beforeHooks['testMethod']).not.toContain(callback);
  });

  // Test execution order and argument passing for before hooks
  it('should execute before hooks in registration order with correct arguments', () => {
    const hooks = createHooks<TestAPI>();
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const args = ['arg1', 'arg2'];

    hooks.before('testMethod', callback1);
    hooks.before('testMethod', callback2);

    hooks.executeBefore('testMethod', ...args);

    expect(callback1).toHaveBeenCalledWith(...args);
    expect(callback2).toHaveBeenCalledWith(...args);
    expect(callback1).toHaveBeenCalledBefore(callback2);
  });

  // Test execution order and argument passing for after hooks
  it('should execute after hooks in registration order with correct arguments', () => {
    const hooks = createHooks<TestAPI>();
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const result = { success: true };
    const args = ['arg1', 'arg2'];

    hooks.after('testMethod', callback1);
    hooks.after('testMethod', callback2);

    hooks.executeAfter('testMethod', result, ...args);

    expect(callback1).toHaveBeenCalledWith(result, ...args);
    expect(callback2).toHaveBeenCalledWith(result, ...args);
    expect(callback1).toHaveBeenCalledBefore(callback2);
  });

  // Test argument modification by before hooks
  it('should allow before hooks to modify arguments', () => {
    const hooks = createHooks<TestAPI>();
    const modifyArg = vi.fn((arg) => arg + '_modified');

    hooks.before('testMethod', modifyArg);

    const result = hooks.executeBefore('testMethod', 'original');

    expect(modifyArg).toHaveBeenCalledWith('original');
    expect(result).toBe('original_modified');
  });

  // Test result modification by after hooks
  it('should allow after hooks to modify return value', () => {
    const hooks = createHooks<TestAPI>();
    const modifyResult = vi.fn((result) => ({ ...result, modified: true }));

    hooks.after('testMethod', modifyResult);

    const result = hooks.executeAfter('testMethod', { success: true });

    expect(modifyResult).toHaveBeenCalledWith({ success: true });
    expect(result).toEqual({ success: true, modified: true });
  });

  // Test error handling in before hooks
  it('should handle errors in before hooks', () => {
    const hooks = createHooks<TestAPI>();
    const errorCallback = vi.fn(() => {
      throw new Error('Hook error');
    });
    const normalCallback = vi.fn();

    hooks.before('testMethod', errorCallback);
    hooks.before('testMethod', normalCallback);

    expect(() => hooks.executeBefore('testMethod')).toThrow('Hook error');
    expect(normalCallback).not.toHaveBeenCalled();
  });

  // Test error handling in after hooks
  it('should handle errors in after hooks', () => {
    const hooks = createHooks<TestAPI>();
    const errorCallback = vi.fn(() => {
      throw new Error('Hook error');
    });
    const normalCallback = vi.fn();

    hooks.after('testMethod', errorCallback);
    hooks.after('testMethod', normalCallback);

    expect(() => hooks.executeAfter('testMethod', { success: true })).toThrow(
      'Hook error'
    );
    expect(normalCallback).not.toHaveBeenCalled();
  });

  // Test for graceful handling of unregistered methods
  it('should not fail when executing hooks for unregistered methods', () => {
    const hooks = createHooks<TestAPI>();

    expect(() => hooks.executeBefore('nonExistentMethod')).not.toThrow();
    expect(() => hooks.executeAfter('nonExistentMethod', {})).not.toThrow();
  });
});
