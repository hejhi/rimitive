# Integration Tests

This directory is for **cross-cutting integration tests only** - tests that span multiple packages where placing them in a single package would create circular dependencies.

All other tests should be **colocated** with their source code in the respective package.
