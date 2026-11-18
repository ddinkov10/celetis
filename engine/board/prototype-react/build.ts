import { $ } from 'bun';

const here = import.meta.dir;
const mode = process.argv[2] === 'production' ? 'production' : 'development';
const result = await Bun.build({
  entrypoints: [`${here}/src/main.tsx`],
  outdir: `${here}/..`,
  naming: 'prototype-board.js',
  target: 'browser',
  format: 'esm',
  minify: true,
  jsx: { development: false },
  conditions: ['browser', 'production'],
  define: { 'process.env.NODE_ENV': '"production"', PROTOTYPE_BAR: String(mode !== 'production') },
});
if (!result.success) {
  console.log(result.logs.map(String).join('\n'));
  process.exit(1);
}
await $`bun --bun ${here}/node_modules/@tailwindcss/cli/dist/index.mjs -i ${here}/src/app.css -o ${here}/../prototype-board.css --minify`.quiet();
console.log('built', mode);
