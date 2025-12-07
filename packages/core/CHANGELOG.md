# @veloxts/core

## 0.3.5

### Patch Changes

- 658e83f: @veloxts/auth, Full REST Support, Better error messages, Type tests with tsd

## 0.3.4

### Patch Changes

- 65ef3e7: DI container and Auth Guards

## 0.3.3

### Patch Changes

- 4ee103b: Full REST support PUT, PATCH and DELETE

## 0.3.2

### Patch Changes

- abf270e: Dynamically set core `VELOX_VERSION` from package.json

## 0.3.1

### Patch Changes

- cb9806e: Fixed the value for VELOXTS_VERSION in create app template

## 0.3.0

### Minor Changes

- 1adce10: Introduced an umbrella package for server side packages: @veloxts/velox

## 0.2.2

### Patch Changes

- Version bump to sync with create-velox-app native module fix

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
