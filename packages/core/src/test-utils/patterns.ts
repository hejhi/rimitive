/**
 * Common mock patterns for testing Lattice components.
 * 
 * Pre-built mock implementations for typical use cases to reduce
 * test setup boilerplate and ensure consistency.
 */

import { vi } from 'vitest';
import { createMockModel, createMockSelectors, createMockActions } from './factories';

/**
 * Common mock implementations for testing.
 * These are the raw mock objects without factory branding, useful for direct testing.
 */
export const mockImplementations = {
  /**
   * Counter model implementation
   */
  counter: () => ({
    count: 0,
    increment: vi.fn(),
    decrement: vi.fn(),
    reset: vi.fn(),
    setCount: vi.fn(),
  }),

  /**
   * List model implementation
   */
  list: <T>() => ({
    items: [] as T[],
    selectedIds: [] as string[],
    addItem: vi.fn(),
    removeItem: vi.fn(),
    updateItem: vi.fn(),
    selectItem: vi.fn(),
    clearSelection: vi.fn(),
  }),

  /**
   * Form model implementation
   */
  form: () => ({
    values: {} as Record<string, any>,
    errors: {} as Record<string, string>,
    touched: {} as Record<string, boolean>,
    isValid: true,
    isDirty: false,
    isSubmitting: false,
    setValue: vi.fn(),
    setError: vi.fn(),
    setTouched: vi.fn(),
    submit: vi.fn(),
    reset: vi.fn(),
    validate: vi.fn(),
  }),

  /**
   * Counter selectors implementation
   */
  counterSelectors: () => ({
    count: 0,
    isZero: true,
    isPositive: false,
    isNegative: false,
    displayValue: 'Count: 0',
  }),

  /**
   * Counter actions implementation
   */
  counterActions: () => ({
    increment: vi.fn(),
    decrement: vi.fn(),
    reset: vi.fn(),
    setCount: vi.fn(),
    incrementTwice: vi.fn(),
  }),
};

/**
 * Common model patterns for testing.
 * Pre-built mock models for typical scenarios to reduce test setup.
 */
export const mockModels = {
  /**
   * Counter model with increment/decrement functionality
   */
  counter: () => createMockModel({
    count: 0,
    increment: vi.fn(),
    decrement: vi.fn(),
    reset: vi.fn(),
    setCount: vi.fn(),
  }),

  /**
   * List model with CRUD operations
   */
  list: <T>() => createMockModel({
    items: [] as T[],
    selectedIds: [] as string[],
    addItem: vi.fn(),
    removeItem: vi.fn(),
    updateItem: vi.fn(),
    selectItem: vi.fn(),
    clearSelection: vi.fn(),
  }),

  /**
   * Form model with validation
   */
  form: () => createMockModel({
    values: {} as Record<string, any>,
    errors: {} as Record<string, string>,
    touched: {} as Record<string, boolean>,
    isValid: true,
    isDirty: false,
    isSubmitting: false,
    setValue: vi.fn(),
    setError: vi.fn(),
    setTouched: vi.fn(),
    submit: vi.fn(),
    reset: vi.fn(),
    validate: vi.fn(),
  }),

  /**
   * Toggle model for boolean state
   */
  toggle: () => createMockModel({
    isToggled: false,
    toggle: vi.fn(),
    setToggled: vi.fn(),
  }),
};

/**
 * Common selector patterns for testing.
 * Pre-built mock selectors for typical scenarios.
 */
export const mockSelectors = {
  /**
   * Counter selectors
   */
  counter: () => createMockSelectors({
    count: 0,
    isZero: true,
    isPositive: false,
    isNegative: false,
    displayValue: 'Count: 0',
  }),

  /**
   * List selectors
   */
  list: <T>() => createMockSelectors({
    items: [] as T[],
    selectedItems: [] as T[],
    hasItems: false,
    hasSelection: false,
    itemCount: 0,
    selectedCount: 0,
  }),

  /**
   * Form selectors
   */
  form: () => createMockSelectors({
    values: {} as Record<string, any>,
    errors: {} as Record<string, string>,
    hasErrors: false,
    isValid: true,
    isDirty: false,
    canSubmit: true,
  }),
};

/**
 * Common action patterns for testing.
 * Pre-built mock actions for typical scenarios.
 */
export const mockActions = {
  /**
   * Counter actions
   */
  counter: () => createMockActions({
    increment: vi.fn(),
    decrement: vi.fn(),
    reset: vi.fn(),
    setCount: vi.fn(),
  }),

  /**
   * List actions  
   */
  list: () => createMockActions({
    addItem: vi.fn(),
    removeItem: vi.fn(),
    updateItem: vi.fn(),
    selectItem: vi.fn(),
    selectAll: vi.fn(),
    clearSelection: vi.fn(),
  }),

  /**
   * Form actions
   */
  form: () => createMockActions({
    setValue: vi.fn(),
    setError: vi.fn(),
    clearErrors: vi.fn(),
    submit: vi.fn(),
    reset: vi.fn(),
    validate: vi.fn(),
  }),
};