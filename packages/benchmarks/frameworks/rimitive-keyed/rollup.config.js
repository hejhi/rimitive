import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";

const plugins = [
  typescript({
    tsconfig: false,
    compilerOptions: {
      target: "ES2020",
      module: "ESNext",
      moduleResolution: "bundler",
      strict: true,
      skipLibCheck: true,
    },
  }),
  resolve({ extensions: [".js", ".ts"] }),
];

if (process.env.production) {
  plugins.push(terser());
}

export default {
  input: "src/main.ts",
  output: {
    file: "dist/main.js",
    format: "iife",
  },
  plugins,
};
