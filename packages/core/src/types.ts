// Generic types for state selection and subscribing
export type Selector<TState, TSelectedState> = (
  state: TState
) => TSelectedState;

// Type for a subscriber object that can be subscribed to
export interface Subscriber<TSelectedState> {
  subscribe: (callback: (state: TSelectedState) => void) => () => void;
  getState: () => TSelectedState;
}

// Model factory types
export type ModelFactory<TSelectedState, TModel> = (
  set: (state: Partial<TSelectedState>) => void,
  get: () => TSelectedState,
  selectedState: TSelectedState
) => TModel;

// Type for the result of createModel
export interface ModelResult<TModel> {
  model: TModel;
}
