# create-velox-app

## 0.3.1

### Patch Changes

- cb9806e: Fixed the value for VELOXTS_VERSION in create app template

## 0.3.0

### Minor Changes

- 1adce10: Introduced an umbrella package for server side packages: @veloxts/velox

## 0.2.2

### Patch Changes

- 9b1d71d: Fix: Add better-sqlite3 as direct dependency and postinstall script for native module compilation

  - Added `better-sqlite3` as a direct dependency to ensure pnpm compiles native bindings
  - Added `postinstall` script to run `prisma generate` automatically after install

## 0.2.1

### Patch Changes

- b577801: Fix: include dist folder in published package

## 0.2.0

### Minor Changes

- 9404976: fix Prisma client generation. README adjustments

## 0.1.1

### Patch Changes

- Fix Prisma client generation in scaffolder

  - Added automatic Prisma client generation after dependency installation in create-velox-app
  - Fixed database template to validate DATABASE_URL environment variable
  - Added alpha release warning to all package READMEs
  - Fixed TypeScript type for registerTRPCPlugin to accept FastifyInstance
  - Updated playground app to use Prisma 7.x custom output path
