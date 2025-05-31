import { createZustandAdapter } from '@lattice/adapter-zustand';
import type { ComponentFactory } from '@lattice/core';

// Check the signature of createZustandAdapter
type AdapterFunction = typeof createZustandAdapter;

// What TypeScript sees:
// createZustandAdapter<Model, Actions, Views>(componentFactory: ComponentFactory<Model, Actions, Views>): ZustandAdapterResult<Model, Actions, Views>

// The issue might be that when we pass typeof minimalCounter, TypeScript can't infer
// the generic parameters properly.

// Let's test different ways to call it:

// 1. With explicit type arguments (should work but verbose)
type ExplicitCall = ReturnType<typeof createZustandAdapter<{ count: number }, { increment: () => void }, { count: any }>>;

// 2. With inferred type arguments from a properly typed component factory
declare const typedFactory: ComponentFactory<{ count: number }, { increment: () => void }, { count: any }>;
type InferredCall = ReturnType<typeof createZustandAdapter<any, any, any>>;

// The issue seems to be that TypeScript needs all three type parameters but can't infer them
// from the component factory type alone.

export type { AdapterFunction, ExplicitCall, InferredCall };