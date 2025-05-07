import { describe, it, expect } from 'vitest';
import {
  brandContract,
  isContract,
  validateDependency,
  CONTRACT_BRAND,
} from '../utils';
import { LATTICE_TYPE } from '../constants';

// Dummy lattice and factory brands for negative tests
const lattice = { [LATTICE_TYPE]: true };
const fakeFactory = (() => {}) as any;
fakeFactory[Symbol.for('lattice.modelFactory')] = true;

describe('brandContract', () => {
  it('brands an object with the CONTRACT_BRAND symbol', () => {
    const obj = {};
    const branded = brandContract(obj);
    expect((branded as any)[CONTRACT_BRAND]).toBe(true);
    expect(
      Object.prototype.propertyIsEnumerable.call(branded, CONTRACT_BRAND)
    ).toBe(false);
  });
});

describe('isContract', () => {
  it('returns true for branded contract objects', () => {
    const obj = brandContract({ foo: 1 });
    expect(isContract(obj)).toBe(true);
  });
  it('returns false for unbranded objects', () => {
    expect(isContract({})).toBe(false);
    expect(isContract({ foo: 1 })).toBe(false);
  });
  it('returns false for lattices and factories', () => {
    expect(isContract(lattice)).toBe(false);
    expect(isContract(fakeFactory)).toBe(false);
  });
  it('returns false for null and non-objects', () => {
    expect(isContract(null)).toBe(false);
    expect(isContract(undefined)).toBe(false);
    expect(isContract(123)).toBe(false);
    expect(isContract('foo')).toBe(false);
  });
});

describe('validateDependency', () => {
  it('accepts undefined', () => {
    expect(() => validateDependency(undefined)).not.toThrow();
  });
  it('accepts a lattice', () => {
    expect(() => validateDependency(lattice)).not.toThrow();
  });
  it('accepts a branded contract', () => {
    const obj = brandContract({ foo: 1 });
    expect(() => validateDependency(obj)).not.toThrow();
  });
  it('rejects unbranded objects', () => {
    expect(() => validateDependency({})).toThrow();
    expect(() => validateDependency({ foo: 1 })).toThrow();
  });
  it('rejects factories', () => {
    expect(() => validateDependency(fakeFactory)).toThrow();
  });
  it('rejects null and non-objects', () => {
    expect(() => validateDependency(null)).toThrow();
    expect(() => validateDependency(123)).toThrow();
    expect(() => validateDependency('foo')).toThrow();
  });
});
