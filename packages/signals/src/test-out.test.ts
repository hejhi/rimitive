import { describe, it, expect, beforeEach } from 'vitest';
import { createSignalFactory } from './signal';
import { createEffectFactory } from './effect';
import { createComputedFactory } from './computed';
import { createBatchFactory } from './batch';

describe('Signal _out behavior', () => {
  let ctx: any;
  
  beforeEach(() => {
    // Manually create a context similar to createContext
    const cache = new Map();
    ctx = {
      version: 0,
      batchDepth: 0,
      cache,
      extensions: [],
      dispose: () => {}
    };
    
    // Initialize factories
    const signalExt = createSignalFactory(ctx);
    const effectExt = createEffectFactory(ctx);
    
    ctx.signal = signalExt.method;
    ctx.effect = effectExt.method;
  });

  it('should have _out undefined when no subscribers', () => {
    const source = ctx.signal(0);
    console.log('No subscribers - _out:', (source as any)._out);
    expect((source as any)._out).toBeUndefined();
  });

  it('should have _out defined when effect subscribes', () => {
    const source = ctx.signal(0);
    const dispose = ctx.effect(() => { source.value; });
    
    console.log('With effect - _out:', (source as any)._out);
    expect((source as any)._out).toBeDefined();
    
    dispose();
  });

  it('should have _out become null after disposing all subscribers', () => {
    const source = ctx.signal(0);
    const dispose = ctx.effect(() => { source.value; });
    
    console.log('Before disposal - _out:', (source as any)._out);
    
    dispose();
    
    console.log('After disposal - _out:', (source as any)._out);
    const outValue = (source as any)._out;
    console.log('After disposal - _out type:', typeof outValue);
    console.log('After disposal - _out === null:', outValue === null);
    console.log('After disposal - _out === undefined:', outValue === undefined);
    
    // After disposal, _out might be null or have a specific state
    // Let's check what it actually is
    if (outValue !== null && outValue !== undefined) {
      console.log('After disposal - _out has value:', outValue);
    }
  });
});