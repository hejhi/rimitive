One of those "emergent properties" that comes from the clean separation of concerns in the architecture:

Why This "Just Works"

1. Components are just functions that return objects
2. Signals are just values that happen to be reactive
3. The store doesn't care about the shape of what you return

So when you compose components:

const App = createComponent(
withState(() => ({ /_ ... _/ })),
(context) => {
// These are just function calls returning objects
const nav = NavComponent(context);
const auth = AuthComponent(context);

    // You can even do conditional composition!
    return {
      nav,
      auth,
      // Computed can depend on nested signals
      userName: computed(() => auth.user().name),
      // You can even have methods that coordinate between components
      logout: () => {
        auth.signOut();
        nav.goToHome();
      }
    };

}
);

The Hidden Superpower

This means you can build fractal architectures - patterns that repeat at every scale:

// A todo item is a component
const TodoItem = createComponent(...);

// A todo list composes todo items
const TodoList = createComponent(..., (ctx) => ({
items: ctx.store.items().map(item => TodoItem(ctx))
}));

// A project composes todo lists
const Project = createComponent(..., (ctx) => ({
lists: ctx.store.lists().map(list => TodoList(ctx))
}));

// An app composes projects
const App = createComponent(..., (ctx) => ({
projects: ctx.store.projects().map(proj => Project(ctx))
}));

Each level has the same pattern, same reactivity, same type safety. It's turtles all the way down! 🐢

This wasn't even explicitly designed - it just emerged from making components simple functions that return objects. Sometimes the best features are the ones you don't have to build!
