# instagram-cli — Quick Reference

## Commands

```bash
npm install          # Install deps
npm run build        # Build (esbuild)
npm test             # Run tests
npm start            # Run CLI
npm run lint         # XO linter
```

## Common Issues

| Issue         | Fix                                     |
| ------------- | --------------------------------------- |
| Type errors   | Fix before committing — XO is strict    |
| Build failing | Check `esbuild.config.mjs` entry points |
| Tests failing | Check `tests/` for failing assertions   |
