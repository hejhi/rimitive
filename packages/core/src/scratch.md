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