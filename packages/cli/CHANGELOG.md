# @veloxts/cli

## 0.4.2

### Patch Changes

- 5b4f02c: Updated documentations
- 0d8d775: Updated guides and readme files
- Updated dependencies [5b4f02c]
- Updated dependencies [0d8d775]
  - @veloxts/auth@0.4.2
  - @veloxts/core@0.4.2
  - @veloxts/orm@0.4.2
  - @veloxts/router@0.4.2
  - @veloxts/validation@0.4.2

## 0.4.1

### Patch Changes

- 0eea918: Completed CLI generators
- Updated dependencies [0eea918]
  - @veloxts/auth@0.4.1
  - @veloxts/core@0.4.1
  - @veloxts/orm@0.4.1
  - @veloxts/router@0.4.1
  - @veloxts/validation@0.4.1

## 0.4.0

### Minor Changes

- b478fee: Performance Benchmarks | 34k req/s, <1ms p50 latency, 75MB memory, 530ms startup

### Patch Changes

- Updated dependencies [b478fee]
  - @veloxts/auth@0.4.0
  - @veloxts/core@0.4.0
  - @veloxts/orm@0.4.0
  - @veloxts/router@0.4.0
  - @veloxts/validation@0.4.0

## 0.3.6

### Patch Changes

- 929f2ab: Interactive CLI setup
- Updated dependencies [929f2ab]
  - @veloxts/auth@0.3.6
  - @veloxts/core@0.3.6
  - @veloxts/orm@0.3.6
  - @veloxts/router@0.3.6
  - @veloxts/validation@0.3.6

## 0.3.5

### Patch Changes

- 658e83f: @veloxts/auth, Full REST Support, Better error messages, Type tests with tsd
- Updated dependencies [658e83f]
  - @veloxts/auth@0.3.5
  - @veloxts/core@0.3.5
  - @veloxts/orm@0.3.5
  - @veloxts/router@0.3.5
  - @veloxts/validation@0.3.5

## 0.3.4

### Patch Changes

- 65ef3e7: DI container and Auth Guards
- Updated dependencies [65ef3e7]
  - @veloxts/auth@0.3.4
  - @veloxts/core@0.3.4
  - @veloxts/orm@0.3.4
  - @veloxts/router@0.3.4
  - @veloxts/validation@0.3.4

## 0.3.3

### Patch Changes

- 4ee103b: Full REST support PUT, PATCH and DELETE
- Updated dependencies [4ee103b]
  - @veloxts/auth@0.3.3
  - @veloxts/core@0.3.3
  - @veloxts/orm@0.3.3
  - @veloxts/router@0.3.3
  - @veloxts/validation@0.3.3

## 0.3.2

### Patch Changes

- abf270e: Dynamically set core `VELOX_VERSION` from package.json
- Updated dependencies [abf270e]
  - @veloxts/auth@0.3.2
  - @veloxts/core@0.3.2
  - @veloxts/orm@0.3.2
  - @veloxts/router@0.3.2
  - @veloxts/validation@0.3.2

## 0.3.1

### Patch Changes

- cb9806e: Fixed the value for VELOXTS_VERSION in create app template
- Updated dependencies [cb9806e]
  - @veloxts/auth@0.3.1
  - @veloxts/core@0.3.1
  - @veloxts/orm@0.3.1
  - @veloxts/router@0.3.1
  - @veloxts/validation@0.3.1

## 0.3.0

### Minor Changes

- 1adce10: Introduced an umbrella package for server side packages: @veloxts/velox

### Patch Changes

- Updated dependencies [1adce10]
  - @veloxts/auth@0.3.0
  - @veloxts/core@0.3.0
  - @veloxts/orm@0.3.0
  - @veloxts/router@0.3.0
  - @veloxts/validation@0.3.0

## 0.2.2

### Patch Changes

- Version bump to sync with create-velox-app native module fix
- Updated dependencies
  - @veloxts/core@0.2.2
  - @veloxts/validation@0.2.2
  - @veloxts/orm@0.2.2
  - @veloxts/router@0.2.2
  - @veloxts/auth@0.2.2

## 0.2.0

### Minor Changes

- 9404976: fix Prisma client generation. README adjustments

### Patch Changes

- Updated dependencies [9404976]
  - @veloxts/validation@0.2.0
  - @veloxts/router@0.2.0
  - @veloxts/auth@0.2.0
  - @veloxts/core@0.2.0
  - @veloxts/orm@0.2.0

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
  - @veloxts/router@0.1.1
  - @veloxts/validation@0.1.1
  - @veloxts/orm@0.1.1
  - @veloxts/auth@0.1.1
