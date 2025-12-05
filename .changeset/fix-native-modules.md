---
"create-velox-app": patch
---

Fix: Add better-sqlite3 as direct dependency and postinstall script for native module compilation

- Added `better-sqlite3` as a direct dependency to ensure pnpm compiles native bindings
- Added `postinstall` script to run `prisma generate` automatically after install
