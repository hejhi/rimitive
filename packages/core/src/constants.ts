/** Unique symbol to tag model factories at runtime and type level */
export const MODEL_FACTORY_TYPE: unique symbol = Symbol.for(
  'Lattice.ModelFactory'
);

/** Unique symbol to tag lattice objects at runtime and type level */
export const LATTICE_TYPE: unique symbol = Symbol.for('Lattice.Lattice');

/** Unique symbol to tag state factories at runtime and type level */
export const STATE_FACTORY_TYPE: unique symbol = Symbol.for(
  'Lattice.StateFactory'
);

/** Unique symbol to tag actions factories at runtime and type level */
export const ACTIONS_FACTORY_TYPE: unique symbol = Symbol.for(
  'Lattice.ActionsFactory'
);

/** Unique symbol to tag view factories at runtime and type level */
export const VIEW_FACTORY_TYPE: unique symbol = Symbol.for(
  'Lattice.ViewFactory'
);
