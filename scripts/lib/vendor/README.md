# Vendored `yaml`

`yaml.mjs` is the npm package [`yaml`](https://github.com/eemeli/yaml) 2.9.1, bundled into one readable ES module, so
that `../config.ts` needs no install step. `yaml.LICENSE` is the ISC license of the package, unchanged.

- npm integrity of `yaml-2.9.1.tgz`:
  `sha512-3NxN8+78OdzbT7C/WjGsyfPAtJaN3FNDsWxv7Y7mcDsT/oOmgW8BpyQQFFBnvZE3j9Y2Sdz1ULFLezL7Eb2yFw==`
- Built with Bun 1.4.2. The result has 6479 lines and the sha256
  `4ff31df191fa26a9cf07ef43fd233964e554426bd0dd314009bd9e1a377f0bd7`.

The build runs in a new, empty folder outside the checkout. `<checkout>` is the path of this repository:

```bash
npm pack yaml@2.9.1
openssl dgst -sha512 -binary yaml-2.9.1.tgz | base64
tar -xzf yaml-2.9.1.tgz
bun build package/browser/dist/index.js --target=bun --format=esm --outfile=<checkout>/scripts/lib/vendor/yaml.mjs
cp package/LICENSE <checkout>/scripts/lib/vendor/yaml.LICENSE
```

The `openssl` line must print the integrity above, after `sha512-`, before `tar` runs. The bundle names each module by
its path from the build folder, so run `bun build` in the folder that holds `package/`. The entry is the browser ES
module build: the CommonJS `dist/index.js` gives `__commonJS` wrappers and `import.meta.require` calls.

`yaml.d.mts` is written by hand. It declares only the API that `../config.ts` calls.

Rules:

- Never edit `yaml.mjs` by hand.
- An update runs the commands above again, with the new version, and updates this file and `yaml.d.mts`. Then it runs
  the verify gate, `scripts/verify.sh`, and the full suite, `tests/suite.sh`.
