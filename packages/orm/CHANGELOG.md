# @veloxts/orm

## 0.2.2

### Patch Changes

- Version bump to sync with create-velox-app native module fix
- Updated dependencies
  - @veloxts/core@0.2.2

## 0.2.0

### Minor Changes

- 9404976: fix Prisma client generation. README adjustments

### Patch Changes

- Updated dependencies [9404976]
  - @veloxts/core@0.2.0

## 0.1.1

### Patch Changes

- Fix Prisma client generation in scaffolder

  - Added automatic Prisma client generation after dependency installation in create-velox-app
  - Fixed database template to validate DATABASE_URL environment variable
  - Added alpha release warning to all package READMEs
  - Fixed TypeScript type for registerTRPCPlugin to accept FastifyInstance
  - Updated playground app to use Prisma 7.x custom output path

- Updated dependencies
  - @veloxts/core@0.1.1
