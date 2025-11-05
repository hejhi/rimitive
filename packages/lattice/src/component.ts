/**
 * Generic component composition pattern for Lattice
 *
 * Provides a pattern for defining components with deferred context injection.
 * This allows components to be defined independently of their runtime context,
 * then instantiated later with the actual context provided.
 *
 * Key benefits:
 * - Separates component definition from instantiation
 * - Enables context injection at instantiation time
 * - Maintains type safety throughout the composition chain
 * - Allows components to be reused with different contexts
 */

/**
 * Interface for things that can be instantiated with context
 *
 * An Instantiatable represents a deferred computation that requires context
 * to produce a result. The actual instantiation is deferred until .create()
 * is called with the required context.
 *
 * @template TResult - The type of value produced when instantiated
 * @template TContext - The type of context required for instantiation
 *
 * @example
 * ```ts
 * const instantiatable: Instantiatable<Counter, API> = {
 *   create: (api) => new Counter(api)
 * };
 *
 * const counter = instantiatable.create(api);
 * ```
 */
export interface Instantiatable<TResult, TContext> {
  /**
   * Create an instance with the provided context
   *
   * @param context - The context required to instantiate the component
   * @returns The instantiated result
   */
  create(context: TContext): TResult;
}

/**
 * Generic component factory that injects context at instantiation time
 *
 * This function enables the component composition pattern where:
 * 1. Components are defined with a factory that receives context
 * 2. Components can be "called" with their arguments to create an Instantiatable
 * 3. The Instantiatable is later instantiated with .create(context)
 *
 * This pattern defers component instantiation until the context is available,
 * allowing components to be defined, configured, and composed independently
 * of their runtime context.
 *
 * @template TArgs - Tuple type of arguments the component function accepts
 * @template TResult - The type of value the component produces
 * @template TContext - The type of context required for instantiation
 *
 * @param factory - A function that receives context and returns a component function
 * @returns A function that takes component arguments and returns an Instantiatable
 *
 * @example
 * ```ts
 * // Define a component with context dependency
 * const Counter = create((api: { signal: (n: number) => Signal<number> }) =>
 *   (initialCount = 0) => {
 *     const count = api.signal(initialCount);
 *     return {
 *       count,
 *       increment: () => count.value++,
 *       decrement: () => count.value--
 *     };
 *   }
 * );
 *
 * // Configure the component (no context yet)
 * const counter = Counter(10);  // Returns Instantiatable<CounterInstance, API>
 *
 * // Later, instantiate with actual context
 * const api = { signal: createSignal };
 * const instance = counter.create(api);  // Returns CounterInstance
 *
 * instance.increment();
 * console.log(instance.count.value);  // 11
 * ```
 *
 * @example
 * ```ts
 * // Compose multiple components
 * const TodoList = create((api: AppAPI) =>
 *   (initialTodos: string[] = []) => {
 *     const todos = api.signal(initialTodos);
 *     return {
 *       todos,
 *       add: (todo: string) => todos.value = [...todos.value, todo],
 *       remove: (index: number) => todos.value = todos.value.filter((_, i) => i !== index)
 *     };
 *   }
 * );
 *
 * const App = create((api: AppAPI) => () => {
 *   const todoList = TodoList(['Buy milk', 'Walk dog']).create(api);
 *   const counter = Counter(0).create(api);
 *
 *   return { todoList, counter };
 * });
 *
 * // Instantiate the entire component tree
 * const app = App().create(apiContext);
 * ```
 */
export function create<TArgs extends unknown[], TResult, TContext>(
  factory: (context: TContext) => (...args: TArgs) => TResult
): (...args: TArgs) => Instantiatable<TResult, TContext> {
  return (...args: TArgs): Instantiatable<TResult, TContext> => ({
    create: (context: TContext): TResult => {
      const component = factory(context);
      return component(...args);
    }
  });
}
