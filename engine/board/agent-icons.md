# Agent icons

The Board embeds the selected Codex and Claude Code SVGs as base64 data URLs in
`ui.ts`. `scripts/build.ts` carries those bytes into `ui.mjs`; no remote image or runtime
read of Herdr is required. The shared mark renderer uses the images at 18×18 px with their
original proportions, colors, and backgrounds in both themes.

## Provenance

Issue [#191](https://github.com/ddinkov10/celetis/issues/191) approves variant C. The assets
were extracted from `/Applications/Herdr.app/Contents/MacOS/Herdr` on 2026-11-03 and frozen in
prototype commit `f13634a9142c7aee919365b8e60b1e45ef16e8c1`:

- `prototype-assets/codex.svg`: SHA-256 `4a2f43ce46b5b6e3722c95088f88d26ef91e6a8c2e598e70642a1c54367386e4`.
- `prototype-assets/claude.svg`: SHA-256 `670b3d8d749d0815ad8f7e62a59d51cb5e2053cb19403f3541a8aed7036a877f`.

Herdr's `Contents/Resources/THIRD-PARTY-NOTICES`, under “LobeHub icons”, supplies the MIT
notice retained as `prototype-assets/LICENSE-LobeHub.txt` in that commit. The complete notice
follows unchanged.

## License

MIT License

Copyright (c) 2023 LobeHub

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
