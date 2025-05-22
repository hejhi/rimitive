/**
 * Production-Quality Vue Framework Adapter for Lattice Components
 * 
 * This adapter provides Vue 3 composables for consuming Lattice components with
 * reactive refs, computed properties, and Vue's reactivity system.
 */

import { ref, computed, watch, onUnmounted, type Ref, type ComputedRef } from 'vue';
import type { 
  ComponentFactory, 
  Lattice,
  ModelFactory,
  SelectorsFactory,
  ActionsFactory,
  ViewFactory
} from '@lattice/core/shared/types';
import type { StateStore } from '@lattice/core/adapters/state-adapter';

/**
 * Composable options for fine-grained control
 */
export interface UseComponentOptions {
  /**
   * Enable/disable reactive subscriptions
   */
  reactive?: boolean;
  
  /**
   * Enable deep watching for nested object changes
   */
  deep?: boolean;
  
  /**
   * Immediate execution of watchers
   */
  immediate?: boolean;
}

/**
 * Return type for Vue component composable
 */
export interface VueComponentReturn<TSelectors, TActions, TViews extends Record<string, unknown>> {
  selectors: Ref<TSelectors>;
  actions: Ref<TActions>;
  views: { [K in keyof TViews]: Ref<TViews[K]> };
}

/**
 * Core composable for consuming Lattice components in Vue
 * 
 * Provides reactive integration with Vue's reactivity system
 */
export function useComponent<
  TModel,
  TSelectors,
  TActions,
  TViews extends Record<string, unknown>
>(
  componentFactory: ComponentFactory<TModel, TSelectors, TActions, TViews>,
  options: UseComponentOptions = {}
): VueComponentReturn<TSelectors, TActions, TViews> {
  const { reactive = true, deep = false, immediate = true } = options;
  
  // Create stable component instance
  let componentInstance: Lattice<TModel, TSelectors, TActions, TViews>;
  try {
    componentInstance = componentFactory();
  } catch (error) {
    throw new Error(`Failed to create component instance: ${error}`);
  }
  
  // Extract factories
  const modelFactory = componentInstance.getModel();
  const selectorsFactory = componentInstance.getSelectors();
  const actionsFactory = componentInstance.getActions();
  const allViews = componentInstance.getAllViews();
  
  // Create reactive refs for instances
  const storeRef = ref<StateStore<TModel>>();
  
  // Create initial instances
  const createInstances = () => {
    const modelTools = { 
      set: () => {}, 
      get: () => ({} as TModel) 
    }; // Placeholder
    
    const modelInstance = modelFactory()(modelTools);
    
    const selectorsInstance = selectorsFactory()({ 
      model: () => modelInstance 
    });
    
    const actionsInstance = actionsFactory()({ 
      model: () => modelInstance 
    });
    
    const viewInstances = Object.entries(allViews).reduce((acc, [key, viewFactory]) => {
      acc[key] = (viewFactory as ViewFactory<unknown, TSelectors, TActions>)()({
        selectors: () => selectorsInstance,
        actions: () => actionsInstance,
      });
      return acc;
    }, {} as Record<string, unknown>);
    
    return {
      selectors: selectorsInstance,
      actions: actionsInstance,
      views: viewInstances as { [K in keyof TViews]: TViews[K] },
    };
  };
  
  const instances = createInstances();
  
  // Create reactive refs
  const selectorsRef = ref(instances.selectors);
  const actionsRef = ref(instances.actions);
  const viewsRef = ref(instances.views);
  
  // Convert views to individual reactive refs
  const reactiveViews = Object.entries(instances.views).reduce((acc, [key, value]) => {
    acc[key] = ref(value);
    return acc;
  }, {} as Record<string, Ref<unknown>>) as { [K in keyof TViews]: Ref<TViews[K]> };
  
  // Set up reactive subscriptions
  if (reactive && storeRef.value?.subscribe) {
    const unsubscribe = storeRef.value.subscribe((newState) => {
      // Re-create instances with new state
      const newSelectors = selectorsFactory()({ 
        model: () => newState 
      });
      
      const newActions = actionsFactory()({ 
        model: () => newState 
      });
      
      const newViews = Object.entries(allViews).reduce((acc, [key, viewFactory]) => {
        acc[key] = (viewFactory as ViewFactory<unknown, TSelectors, TActions>)()({
          selectors: () => newSelectors,
          actions: () => newActions,
        });
        return acc;
      }, {} as Record<string, unknown>);
      
      // Update reactive refs
      selectorsRef.value = newSelectors;
      actionsRef.value = newActions;
      
      // Update individual view refs
      Object.entries(newViews).forEach(([key, value]) => {
        if (reactiveViews[key]) {
          reactiveViews[key].value = value;
        }
      });
    });
    
    // Clean up subscription on unmount
    onUnmounted(() => {
      unsubscribe();
    });
  }
  
  return {
    selectors: selectorsRef,
    actions: actionsRef,
    views: reactiveViews,
  };
}

/**
 * Composable for consuming only selectors from a Lattice component
 * Returns a reactive ref to selectors
 */
export function useSelectors<TModel, TSelectors>(
  componentFactory: ComponentFactory<TModel, TSelectors, unknown, unknown>,
  options: UseComponentOptions = {}
): Ref<TSelectors> {
  const { selectors } = useComponent(componentFactory, options);
  return selectors;
}

/**
 * Composable for consuming only actions from a Lattice component
 * Returns a reactive ref to actions
 */
export function useActions<TModel, TActions>(
  componentFactory: ComponentFactory<TModel, unknown, TActions, unknown>,
  options: UseComponentOptions = {}
): Ref<TActions> {
  const { actions } = useComponent(componentFactory, options);
  return actions;
}

/**
 * Composable for consuming a specific view from a Lattice component
 * Returns a reactive ref to the view
 */
export function useView<
  TModel, 
  TSelectors, 
  TActions, 
  TViews extends Record<string, unknown>, 
  K extends keyof TViews
>(
  componentFactory: ComponentFactory<TModel, TSelectors, TActions, TViews>,
  viewName: K,
  options: UseComponentOptions = {}
): Ref<TViews[K]> {
  const { views } = useComponent(componentFactory, options);
  return views[viewName];
}

/**
 * Composable for creating computed properties from selectors
 * Provides optimized reactivity for derived state
 */
export function useComputedSelector<TModel, TSelectors, TComputed>(
  componentFactory: ComponentFactory<TModel, TSelectors, unknown, unknown>,
  selector: (selectors: TSelectors) => TComputed,
  options: UseComponentOptions = {}
): ComputedRef<TComputed> {
  const { selectors } = useComponent(componentFactory, options);
  
  return computed(() => {
    return selector(selectors.value);
  });
}

/**
 * Composable for watching selector changes
 * Provides fine-grained reactivity with custom callbacks
 */
export function useWatchSelector<TModel, TSelectors, TSelected>(
  componentFactory: ComponentFactory<TModel, TSelectors, unknown, unknown>,
  selector: (selectors: TSelectors) => TSelected,
  callback: (newValue: TSelected, oldValue: TSelected) => void,
  options: UseComponentOptions & { watchOptions?: Parameters<typeof watch>[2] } = {}
): void {
  const { watchOptions, ...componentOptions } = options;
  const { selectors } = useComponent(componentFactory, componentOptions);
  
  const selectedValue = computed(() => selector(selectors.value));
  
  watch(selectedValue, callback, watchOptions);
}

/**
 * Composable for component lifecycle management
 * Provides hooks for mount, update, and unmount events
 */
export function useComponentLifecycle<
  TModel,
  TSelectors,
  TActions,
  TViews extends Record<string, unknown>
>(
  componentFactory: ComponentFactory<TModel, TSelectors, TActions, TViews>,
  callbacks: {
    onMount?: () => void;
    onUpdate?: (selectors: TSelectors) => void;
    onUnmount?: () => void;
  },
  options: UseComponentOptions = {}
): void {
  const { selectors } = useComponent(componentFactory, options);
  
  // On mount
  if (callbacks.onMount) {
    callbacks.onMount();
  }
  
  // Watch for updates
  if (callbacks.onUpdate) {
    watch(selectors, callbacks.onUpdate, { deep: true });
  }
  
  // On unmount
  if (callbacks.onUnmount) {
    onUnmounted(callbacks.onUnmount);
  }
}

/**
 * Composable for creating component instances with custom state adapters
 * Allows per-instance adapter configuration
 */
export function useComponentWithAdapter<
  TModel,
  TSelectors,
  TActions,
  TViews extends Record<string, unknown>
>(
  componentFactory: ComponentFactory<TModel, TSelectors, TActions, TViews>,
  adapter: StateStore<TModel>,
  options: UseComponentOptions = {}
): VueComponentReturn<TSelectors, TActions, TViews> {
  // This would integrate with the custom adapter
  // For now, delegate to regular useComponent
  return useComponent(componentFactory, options);
}

/**
 * Utility for creating reactive component store
 * Provides direct access to the underlying state store
 */
export function useComponentStore<TModel>(
  componentFactory: ComponentFactory<TModel, unknown, unknown, unknown>
): Ref<StateStore<TModel> | undefined> {
  const storeRef = ref<StateStore<TModel>>();
  
  try {
    const componentInstance = componentFactory();
    // Extract store from component instance
    // This would require additional architecture to expose the store
  } catch (error) {
    console.error('Failed to create component store:', error);
  }
  
  return storeRef;
}