/**
 * Vite import declarations
 *
 * Explicit ambient modules so typechecking works from the parent
 * @rimitive/examples package where vite isn't a direct dependency.
 */
declare module '*?worker' {
  const workerConstructor: {
    new (): Worker;
  };
  export default workerConstructor;
}

declare module '*.css' {
  const css: string;
  export default css;
}
