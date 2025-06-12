# Lattice Atoms Specification

## Vision

Lattice Atoms introduces a new paradigm: **define your state structure atomically, execute it anywhere**. Whether you need fine-grained atomic reactivity (Jotai) or prefer store-based patterns (Zustand, Redux), the same atomic definitions work everywhere.

## Core Concept

Traditional Lattice: Define behavior → Execute with any store
Lattice Atoms: Define atoms → Execute as atoms OR compose into stores

```typescript
// Define once with atoms
const defineUserState = (atoms: AtomTools) => ({
  // Primitive atoms
  profile: atoms.primitive({ name: '', email: '', role: 'user' }),
  preferences: atoms.primitive({ theme: 'light', notifications: true }),
  
  // Computed atoms  
  displayName: atoms.computed(({ get }) => 
    get(atoms.profile).name || get(atoms.profile).email.split('@')[0]
  ),
  
  // Action atoms
  updateProfile: atoms.action(({ get, set }, updates: ProfileUpdates) => {
    set(atoms.profile, { ...get(atoms.profile), ...updates });
  })
});

// Execute as atoms with Jotai
const userAtoms = createJotaiAtoms(defineUserState);
// Use: const profile = useAtom(userAtoms.profile)

// OR execute as store with ANY adapter
const userStore = createZustandAdapter(createStoreFromAtoms(defineUserState));
// Use: const profile = useSliceSelector(userStore, s => s.profile())
```

## Key Innovation

The same atomic definitions can be:
1. **Executed atomically** - Preserving fine-grained reactivity
2. **Composed into stores** - For bulk operations and traditional patterns
3. **Portable across paradigms** - Not just across libraries, but across state management philosophies

## API Design

### Core Types

```typescript
// Atom definition tools
interface AtomTools {
  // Create a primitive atom
  primitive<T>(initialValue: T): AtomDefinition<T>;
  
  // Create a computed/derived atom
  computed<T>(compute: ComputeFn<T>): ComputedAtomDefinition<T>;
  
  // Create an action atom
  action<Args extends any[], Result>(
    handler: ActionHandler<Args, Result>
  ): ActionAtomDefinition<Args, Result>;
  
  // Create an async atom
  async<T>(fetcher: AsyncFetcher<T>): AsyncAtomDefinition<T>;
  
  // Create a family of atoms
  family<Param, T>(factory: (param: Param) => AtomDefinition<T>): AtomFamily<Param, T>;
}

// Compute function has access to other atoms
type ComputeFn<T> = (tools: {
  get: <U>(atom: AtomDefinition<U>) => U;
}) => T;

// Action handler can read and write atoms
type ActionHandler<Args, Result> = (tools: {
  get: <T>(atom: AtomDefinition<T>) => T;
  set: <T>(atom: AtomDefinition<T>, value: T | ((prev: T) => T)) => void;
}, ...args: Args) => Result;
```

### Creating Stores from Atoms

```typescript
// Convert atom definitions to store factory
function createStoreFromAtoms<AtomShape>(
  defineAtoms: (tools: AtomTools) => AtomShape
): ComponentFactory<StoreShape<AtomShape>, State<AtomShape>> {
  return (createStore) => {
    // Bridge atoms to store slices
    const atoms = defineAtoms(bridgeTools);
    
    // Convert to store slices
    const createSlice = createStore(extractInitialState(atoms));
    
    return mapAtomsToSlices(atoms, createSlice);
  };
}

// Type magic to convert atom definitions to store methods
type StoreShape<AtomShape> = {
  [K in keyof AtomShape]: AtomShape[K] extends AtomDefinition<infer T>
    ? () => T
    : AtomShape[K] extends ActionAtomDefinition<infer Args, infer Result>
    ? (...args: Args) => Result
    : never;
};
```

### Execution Modes

```typescript
// Mode 1: Execute as atoms (fine-grained reactivity)
const atoms = createJotaiAtoms(defineUserState);

// Mode 2: Execute as store (bulk operations)
const store = createZustandAdapter(createStoreFromAtoms(defineUserState));

// Mode 3: Hybrid execution
const hybrid = createHybridStore(defineUserState, {
  atomic: ['preferences', 'displayName'],  // Keep as atoms
  store: ['profile', 'updateProfile']      // Compose into store
});
```

## Usage Examples

### Example 1: Todo App

```typescript
// Define with atoms
const defineTodoState = (atoms: AtomTools) => {
  const todos = atoms.primitive<Todo[]>([]);
  const filter = atoms.primitive<'all' | 'active' | 'completed'>('all');
  
  const filtered = atoms.computed(({ get }) => {
    const allTodos = get(todos);
    const currentFilter = get(filter);
    
    switch (currentFilter) {
      case 'active': return allTodos.filter(t => !t.done);
      case 'completed': return allTodos.filter(t => t.done);
      default: return allTodos;
    }
  });
  
  const stats = atoms.computed(({ get }) => ({
    total: get(todos).length,
    active: get(todos).filter(t => !t.done).length,
    completed: get(todos).filter(t => t.done).length
  }));
  
  const addTodo = atoms.action(({ get, set }, text: string) => {
    set(todos, [...get(todos), { id: Date.now(), text, done: false }]);
  });
  
  const toggleTodo = atoms.action(({ get, set }, id: number) => {
    set(todos, get(todos).map(t => 
      t.id === id ? { ...t, done: !t.done } : t
    ));
  });
  
  return { todos, filter, filtered, stats, addTodo, toggleTodo };
};

// Use with Jotai (atomic execution)
const todoAtoms = createJotaiAtoms(defineTodoState);

function TodoApp() {
  const [todos] = useAtom(todoAtoms.filtered);
  const stats = useAtomValue(todoAtoms.stats);
  const addTodo = useSetAtom(todoAtoms.addTodo);
  // Fine-grained updates, only re-render when filtered todos change
}

// Same definition with Zustand (store execution)
const todoStore = createZustandAdapter(createStoreFromAtoms(defineTodoState));

function TodoApp() {
  const todos = useSliceSelector(todoStore, s => s.filtered());
  const stats = useSliceSelector(todoStore, s => s.stats());
  const { addTodo } = todoStore;
  // Store-based updates, different performance characteristics
}
```

### Example 2: Complex App State

```typescript
const defineAppState = (atoms: AtomTools) => {
  // User atoms
  const currentUser = atoms.primitive<User | null>(null);
  const isAuthenticated = atoms.computed(({ get }) => get(currentUser) !== null);
  
  // UI atoms
  const theme = atoms.primitive<'light' | 'dark'>('light');
  const sidebarOpen = atoms.primitive(true);
  const activeModal = atoms.primitive<string | null>(null);
  
  // Data atoms with relationships
  const posts = atoms.primitive<Post[]>([]);
  const comments = atoms.family<number, Comment[]>((postId) => 
    atoms.computed(({ get }) => 
      get(allComments).filter(c => c.postId === postId)
    )
  );
  
  // Async atoms
  const userData = atoms.async(async ({ get }) => {
    const user = get(currentUser);
    if (!user) return null;
    const response = await fetch(`/api/users/${user.id}`);
    return response.json();
  });
  
  // Complex actions
  const login = atoms.action(async ({ set }, credentials: Credentials) => {
    const user = await api.login(credentials);
    set(currentUser, user);
    set(theme, user.preferences.theme);
  });
  
  return {
    // Auth
    currentUser, isAuthenticated, login,
    // UI
    theme, sidebarOpen, activeModal,
    // Data
    posts, comments, userData
  };
};
```

### Example 3: Migration Path

```typescript
// Existing Zustand store
const useStore = create((set, get) => ({
  count: 0,
  increment: () => set({ count: get().count + 1 })
}));

// Gradually migrate to atoms
const defineCounterState = (atoms: AtomTools) => {
  const count = atoms.primitive(0);
  const increment = atoms.action(({ get, set }) => {
    set(count, get(count) + 1);
  });
  
  // New features as atoms
  const doubled = atoms.computed(({ get }) => get(count) * 2);
  const history = atoms.primitive<number[]>([]);
  
  return { count, increment, doubled, history };
};

// Can still use with Zustand!
const newStore = createZustandAdapter(createStoreFromAtoms(defineCounterState));
```

## Implementation Strategy

### Phase 1: Core Atom Definition API
- Define `AtomTools` interface
- Create type system for atom definitions
- Build bridge to convert atoms to store factories

### Phase 2: Atomic Execution
- Implement Jotai adapter for atomic execution
- Add Recoil adapter
- Create atomic runtime hooks

### Phase 3: Store Composition
- Build `createStoreFromAtoms` converter
- Ensure all existing adapters work with atom-based stores
- Optimize performance for store execution mode

### Phase 4: Advanced Features
- Hybrid execution modes
- Atom families and parameterized atoms
- Async atoms with Suspense
- DevTools integration

### Phase 5: Migration Tools
- Utilities to convert existing stores to atom definitions
- Gradual migration helpers
- Codemods for common patterns

## Benefits

1. **Ultimate Flexibility**: Choose execution mode based on needs, not lock-in
2. **Gradual Migration**: Move from stores to atoms incrementally
3. **Performance Control**: Use atoms for hot paths, stores for bulk data
4. **Future Proof**: As new atomic libraries emerge, they just need an adapter
5. **Better Testing**: Atom definitions are pure functions, easily testable
6. **Type Safety**: Full inference from atom definitions to final API

## Technical Considerations

### Performance
- Atom definitions are compiled to efficient store slices
- No runtime overhead for store execution mode
- Atomic execution preserves all fine-grained optimization

### Type System
- Complex type inference to map atom shapes to store shapes
- Preserve all type safety across transformations
- Support for generic atoms and families

### Compatibility
- All existing Lattice adapters must work with atom-based stores
- Atomic execution is opt-in, not required
- Backward compatible with current Lattice API

## Open Questions

1. Should atom definitions be serializable for persistence?
2. How to handle atom disposal/cleanup in store mode?
3. Should we support mixed execution (some atoms, some store slices)?
4. DevTools story for debugging atom-based stores?
5. SSR implications for atomic vs store execution?

## Conclusion

Lattice Atoms represents the next evolution of portable state management. By defining state atomically but executing flexibly, we give developers unprecedented control over their architecture without sacrificing portability.

This isn't just about supporting Jotai - it's about recognizing that the atomic model is a powerful way to *think* about state, even if you ultimately execute it as a traditional store.