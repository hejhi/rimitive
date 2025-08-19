import { describe, it, expect, beforeEach } from 'vitest';
import { signal, effect, resetGlobalState } from './test-setup';

describe('Signal _out behavior check', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  it('check _out with no subscribers', () => {
    const s = signal(0);
    const outValue = (s as any)._out;
    
    console.log('\n=== No subscribers ===');
    console.log('_out value:', outValue);
    console.log('_out === undefined:', outValue === undefined);
    console.log('_out === null:', outValue === null);
    console.log('_out type:', typeof outValue);
    
    // Write to signal
    s.value = 1;
    s.value = 2;
    s.value = 3;
    
    console.log('After writes, _out:', (s as any)._out);
  });

  it('check _out with effect subscriber', () => {
    const s = signal(0);
    
    console.log('\n=== With effect subscriber ===');
    console.log('Before effect, _out:', (s as any)._out);
    
    const dispose = effect(() => { s.value; });
    
    console.log('After effect, _out:', (s as any)._out);
    console.log('_out type:', typeof (s as any)._out);
    
    // Write to signal
    s.value = 1;
    
    console.log('After write, _out:', (s as any)._out);
    
    dispose();
    
    console.log('After dispose, _out:', (s as any)._out);
    console.log('After dispose, _out === null:', (s as any)._out === null);
    console.log('After dispose, _out === undefined:', (s as any)._out === undefined);
  });
});