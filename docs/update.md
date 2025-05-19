We use composition:

```ts
const baseActions = createActions(model).create(({ model }) => ({
  // only reveal methods from `model`
  inc: model().increment
}))
```

Then, composed:

```ts
// we filter and only allow selection of the methods from the model
const baseActions = createActions({ model }, ({ model }) => {
    // gets the intersection between the baseActions and the provided model
    // the first call (baseActions()) can be provided a `select` function
    const { increment, ...rest } = baseActions(({ incompatibleMethod, ...rest }) => rest)({ model });

    return {
      inc: increment,
      someOtherAction: model().decrement
      ...rest
    }
  })
```

Applied to other parts:

```ts
createSelectors({ model }, ({ model }) => {
  // the first selector argument is optional. if nothing is passed, the entire baseSelectors is passed forward
  const composed = baseSelectors()({ model });

  return {
    // only exposes properties/getters from model (no methods)
    count: model().count,
    // if the model is totally compatible, these can just be spread forward
    ...composed
  }
})

composeView({ selectors, actions }, ({ selectors, actions }) => {
  const composedView = baseView()({ selectors, actions });
  
  return {
    "aria-something": selectors().count,
    onClick: (event) => {
      event.stopPropagation();

      actions().increment();
      actions().decrement();
    },
    ...composedView
  }
})
```

## Improved Type-Safe API with `from()`

To provide a better developer experience with improved type inference, we're introducing a new fluent API pattern using the `from()` function:

```ts
// Create actions directly from a model with full type inference
const actions = from(model).createActions(({ model }) => ({
  increment: model().increment,  // model() preserves all the model's methods
  reset: model().reset
}));

// Create selectors from a model
const selectors = from(model).createSelectors(({ model }) => ({
  count: model().count,
  doubled: model().count * 2
}));

// Create a view from selectors and actions
const view = from(selectors)
  .withActions(actions)
  .createView(({ selectors, actions }) => ({
    'data-count': selectors().count,
    'aria-positive': selectors().isPositive,
    onClick: actions().increment,
    onReset: actions().reset,
  }));
```

Benefits of the `from()` API:
- Only requires a single type parameter for the return type
- Automatically infers all intermediate types
- Provides a natural, chainable API that reads clearly from left to right
- Preserves full type information throughout the composition chain
- Different context-appropriate methods based on what you're starting from

This API helps address composition cases where the previous approach required multiple explicit type parameters or lost type information during composition.
