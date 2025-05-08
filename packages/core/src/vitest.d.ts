/**
 * Type declarations for Vitest in-source testing
 */
interface ImportMeta {
  vitest?: {
    it: Function;
    expect: Function;
    vi: any;
    describe: Function;
    beforeEach: Function;
    afterEach: Function;
  };
}
