const resolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const typescript = require('@rollup/plugin-typescript');
const { babel } = require('@rollup/plugin-babel');
const dts = require('rollup-plugin-dts');
const packageJson = require('./package.json');


module.exports = [
  {
    input: 'src/index.ts',
    output: [
      {
        file: packageJson.main,
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: packageJson.module,
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: [
      resolve(),
      commonjs(),
      typescript({ 
        tsconfig: './tsconfig.json',
      }),
      babel({
        exclude: 'node_modules/**',
        babelHelpers: 'bundled',
      }),
    ],
    external: ['react', 'react-dom', 'd3'],
  },
  {
    input: 'src/index.ts',
    output: [{ file: 'dist/index.d.ts', format: 'esm' }],
    plugins: [dts.dts()],
  },
];