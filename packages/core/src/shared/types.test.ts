import { describe, it, expectTypeOf } from 'vitest';
import {
  ModelFactoryParams,
  ModelFactoryCallback,
  SelectorsFactoryParams,
  SelectorsFactoryCallback,
  ActionsFactoryParams,
  ActionsFactoryCallback,
  ViewFactoryParams,
  ViewFactoryCallback,
  SliceCompositionTools,
} from './types';

// These tests are type-only tests

describe('Factory Parameter Types', () => {
  it('should define correct parameter types for ModelFactory', () => {
    // ModelFactoryParams should have get and set
    expectTypeOf<ModelFactoryParams<{ count: number }>>().toMatchTypeOf<{
      set: (state: any) => void;
      get: () => { count: number };
    }>();

    // ModelFactoryCallback should be a function returning the model shape
    expectTypeOf<ModelFactoryCallback<{ count: number }>>().toMatchTypeOf<
      (params: ModelFactoryParams<{ count: number }>) => { count: number }
    >();
  });

  it('should define correct parameter types for SelectorsFactory', () => {
    // SelectorsFactoryParams should have model accessor
    expectTypeOf<SelectorsFactoryParams<{ count: number }>>().toMatchTypeOf<{
      model: () => { count: number };
    }>();

    // SelectorsFactoryCallback should be a function returning selectors
    expectTypeOf<
      SelectorsFactoryCallback<{ value: number }, { count: number }>
    >().toMatchTypeOf<
      (params: SelectorsFactoryParams<{ count: number }>) => { value: number }
    >();
  });

  it('should define correct parameter types for ActionsFactory', () => {
    // ActionsFactoryParams should have model accessor
    expectTypeOf<
      ActionsFactoryParams<{ count: number; increment: () => void }>
    >().toMatchTypeOf<{
      model: () => { count: number; increment: () => void };
    }>();

    // ActionsFactoryCallback should be a function returning actions
    expectTypeOf<
      ActionsFactoryCallback<
        { increment: () => void },
        { count: number; increment: () => void }
      >
    >().toMatchTypeOf<
      (
        params: ActionsFactoryParams<{ count: number; increment: () => void }>
      ) => { increment: () => void }
    >();
  });

  it('should define correct parameter types for ViewFactory', () => {
    // ViewFactoryParams should have selectors and actions accessors
    expectTypeOf<
      ViewFactoryParams<{ count: number }, { increment: () => void }>
    >().toMatchTypeOf<{
      selectors: () => { count: number };
      actions: () => { increment: () => void };
    }>();

    // ViewFactoryCallback should be a function returning a view
    expectTypeOf<
      ViewFactoryCallback<
        { 'data-count': number },
        { count: number },
        { increment: () => void }
      >
    >().toMatchTypeOf<
      (
        params: ViewFactoryParams<{ count: number }, { increment: () => void }>
      ) => { 'data-count': number }
    >();
  });

  it('should define correct types for composition', () => {
    // SliceCompositionTools should have get, set and other tools based on component type
    expectTypeOf<SliceCompositionTools<{ count: number }, 'model'>>().toExtend<{
      get: () => { count: number };
      set: (state: any) => void;
    }>();

    expectTypeOf<
      SliceCompositionTools<{ count: number }, 'selectors'>
    >().toExtend<{
      model: () => any;
    }>();

    expectTypeOf<
      SliceCompositionTools<{ count: number }, 'actions'>
    >().toExtend<{
      model: () => any;
    }>();

    expectTypeOf<SliceCompositionTools<{ count: number }, 'view'>>().toExtend<{
      selectors: () => any;
      actions: () => any;
    }>();
  });
});
