# SpeedEcom Frontend — Guide for Claude

React 19 + Vite + Tailwind SPA. The API is in the sibling `backend` repo
(`../backend`); the two never import each other and only share the HTTP contract.

## Layout

```
src/pages/       route-level screens (Dashboard, Uploads, Automation, …)
src/components/  reusable UI; subfolders: automation/ calculations/ dashboard/ speedy/
src/contexts/    MarketplaceContext (selected marketplace/account)
src/hooks/       useUploadQueue, useCalculationsFilters, useDateRangeFilter, …
src/api.js       axios instance — auth header + tenantId injection + toast errors
```

## Conventions

- 2-space indent; match the file you are editing.
- Call the API only through `src/api.js`.
- API shape changes belong in the backend repo first; check its
  `docs/FEATURE_IMPACT.md` before changing anything that depends on a response.

## Commands

```bash
npm run dev
npm run lint
npm run build
```

A husky pre-commit hook runs lint-staged; commits fail on lint errors.
