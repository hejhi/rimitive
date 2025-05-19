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
    const { increment, ...rest } = baseActions({ model });

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
  const composed = baseSelectors({ model });

  return {
    // only exposes properties/getters from model (no methods)
    count: model().count,
    // if the model is totally compatible, these can just be spread forward
    ...composed
  }
})

composeView({ selectors, actions }, ({ selectors, actions }) => {
  const composedView = baseView({ selectors, actions });
  
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
