# apps/web

Workspace home for the authenticated/public web app during the v2.1 monorepo migration.

Current state:
- Vite runtime now boots from `apps/web/src/main.tsx`.
- Legacy application modules are still imported from root `src/` as a temporary compatibility boundary.
- Follow-on tickets should migrate feature modules from root `src/` into `apps/web/src/` progressively.
