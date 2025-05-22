// Minimal reproduction of the type issue

// Simplified types
type ViewSliceFactory<T> = (params: { selectors: () => any }) => T;

// The createView function expects a factory that returns T
function createView<T>(
  params: { selectors?: any },
  factory: ViewSliceFactory<T>
): T {
  return factory({ selectors: () => params.selectors });
}

// The fluent API wrapper
function fluentCreateView<TArgs extends any[], TReturn extends Record<string, any>>(
  factory: (tools: { selectors: () => any }) => (...args: TArgs) => TReturn
) {
  // This is where the issue is - we're calling factory() and passing its result
  // directly to createView, but createView's type parameter is the full function type
  return createView<(...args: TArgs) => TReturn>(
    { selectors: {} },
    (tools) => factory({ selectors: tools.selectors }) // BUG: This returns the result of factory(), not a function
  );
}

// This should error but doesn't
const result = fluentCreateView(({ selectors }) => ({
  // Returning an object instead of a function that returns an object
  'data-count': 42,
  onClick: () => {}
}));

// The issue is that TypeScript infers:
// TArgs = never[]
// TReturn = { 'data-count': number, onClick: () => void }
// And the return type of factory() matches (...args: never[]) => TReturn
// because an object can be called as a function in TypeScript's type system