import { ModelFactory, ModelResult, Subscriber } from './types';

/**
 * Creates a model with getters and mutations based on a subscriber
 * The model provides a unified public interface to interact with state
 *
 * @param subscriber The subscriber that provides access to selected state
 * @returns A factory function to define the model methods
 */
export function createModel<TSelectedState>(
  subscriber: Subscriber<TSelectedState>
) {
  return <TModel extends Record<PropertyKey, unknown>>(
    modelFactory: ModelFactory<TSelectedState, TModel>
  ): ModelResult<TModel> => {
    // Define the setter function for state updates
    const set = (_state: Partial<TSelectedState>) => {
      // Not directly implemented as this would require the store to be passed
      // The tests show that state updates are done directly on the store
      // This function could be used in future iterations, but we don't want
      // subscribed models to be able to write to the store they subscribe to.
    };

    // Define the getter function to access current state
    const get = () => {
      return subscriber.getState();
    };

    // Get the current selected state
    const selectedState = subscriber.getState();

    // Create the initial model instance
    const initialModel = modelFactory(set, get, selectedState);

    // Create an object to hold the model methods
    const model = {} as TModel;

    // Initialize the model by copying all methods from the initial instance
    Object.keys(initialModel).forEach((key) => {
      const propertyKey = key as keyof TModel;

      // For functions, we create a wrapper that always accesses the latest state
      if (typeof initialModel[propertyKey] === 'function') {
        // The wrapper function preserves the 'this' context and forwards arguments
        model[propertyKey] = ((...args: unknown[]) => {
          // Always get the latest state when the function is called
          const currentState = subscriber.getState();
          // Create a fresh model instance with the latest state
          const currentModel = modelFactory(set, get, currentState);
          // Call the method on the fresh model instance
          return (currentModel[propertyKey] as Function)(...args);
        }) as unknown as TModel[keyof TModel];
      } else {
        // For non-functions, just copy the property
        model[propertyKey] = initialModel[propertyKey];
      }
    });

    return { model };
  };
}
