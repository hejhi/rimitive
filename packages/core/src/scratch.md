starting v2 unified signal implementation

phase 1 task 1 - delete Signal<T> interface and replace
looking at runtime-types.ts first

found the Signal interface - lines 14-48
it has all the overloaded signatures for predicates, collection ops etc
deleting entire interface and replacing with read-only version

replaced Signal<T> with read-only version
- predicates now return Signal<U | undefined> instead of U | undefined
- added keyed selector signatures
- updated SetState to work with signals instead of selectors
- removed select from LatticeContext

task 1 done. moving to task 2 - delete signal factory function

deleted entire old signal implementation and replaced with new one
- signals are now read-only, throw error if write attempted
- predicates create derived signals that cache position for O(1) updates
- keyed selectors cache derived signals by key
- added helper functions: updateSignalValue, getSourceSignal, isDerivedSignal
- derived signals subscribe to source and propagate changes

task 2 and 3 done (implementation included derived signals). moving to task 4

deleted O(n) selector logic and replaced with new set() function
- set() now takes signal as first arg instead of selector result
- derived signals update through their source signal using cached position (O(1))
- falls back to O(n) search if cache miss
- handles arrays, maps, sets, objects with proper immutable updates
- adapter stores also updated to work with new api
- removed select() function from everywhere - no longer needed

task 4 and 5 done. now need to update all the places that write to signals

task 6 - updating signal writes
fixed internal signal write in adapter subscribe handler
started fixing tests - there are many signal writes in component.test.ts
examples of changes needed:
- store.count(value) -> set(store.count, value)  
- store.items(predicate) now returns derived signal, not value
- store.tags('add', tag) -> set(store.tags, newSet) or similar

stopping here - core implementation is done. remaining work:
- fix all tests (lots of mechanical changes)
- update computed.ts if needed
- check adapters work correctly

phase 2 - fixing type safety and implementation bugs

task 1 - create proper internal types
looking at signal.ts - already has DerivedSignal and BaseSignal interfaces
good, no any type in _cachedIndex anymore, using number | string | any
wait that's still any, need to fix this
actually the any is for object keys which could be anything
let me define proper type: CacheKey = number | string | symbol
updated DerivedSignal interface to use CacheKey type instead of any
fixed all any casts in signal.ts:
- added _unsubscribeFromSource to DerivedSignal interface
- replaced all 'as any' with proper type assertions
- used unknown instead of any where appropriate
- isDerivedSignal already has proper type guard

task 2 - fix set() function parameter types
found the issue - SetState type only accepts signals now but component.ts set() 
implementation still expects old API where you could pass property key updates
the tests are calling set({ count: 0 }) which is old API
need to update set() implementation to only accept signals as first param
fixed type issues - exported DerivedSignal, added proper type casts
issue remains: tests use old API set({ count: 0 }) but new API needs set(store.count, 0)

task 8 - fixing component.test.ts
need to update all tests to use new set API:
- set({ count: 0 }) -> set(store.count, 0)
- set({ count: store.count() + 1 }) -> set(store.count, store.count() + 1)
- store.items(value) -> set(store.items, value)
- store.todos(predicate) now returns signal, not value
- need to pass set to component callbacks
many tests using old collection operations API that no longer exists
fixing remaining type errors in component.test.ts - middleware is broken
middleware expects old set API, need to fix
fixed middleware to work with new API
all component and middleware tests passing

remaining issues:
- adapter-contract-tests.ts uses old set API (313, 314, 322, 323, 376, 377, 378)
- type narrowing issues in component.ts with update functions
- need to properly handle Partial<T> case without any casts