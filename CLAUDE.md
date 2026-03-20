# instagram-cli

## What

Instagram automation CLI tool. TypeScript.

## Stack

TypeScript · Node.js · esbuild (bundler)

## Files

- `source/` — TypeScript source
- `dist/` — Built output
- `tests/` — Test files
- `esbuild.config.mjs` — Build config
- `xo.config.ts` — XO linter config
- `resource/` — Static resources
- `snap/` — Snapcraft packaging

## Quick Commands

```bash
npm install          # Install deps
npm run build        # Build with esbuild
npm test             # Run tests
npm start            # Run CLI
```

## Notes

- XO for linting (strict TypeScript linter)
- esbuild for fast bundling
- Snap packaging for Linux distribution
