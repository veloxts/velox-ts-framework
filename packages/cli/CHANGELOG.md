# @veloxts/cli

## 0.6.18

### Patch Changes

- add node:fs/promises stub and fix esbuild plugin
- Updated dependencies
  - @veloxts/auth@0.6.18
  - @veloxts/core@0.6.18
  - @veloxts/orm@0.6.18
  - @veloxts/router@0.6.18
  - @veloxts/validation@0.6.18

## 0.6.17

### Patch Changes

- remove optimizeDeps.exclude to fix CJS/ESM interop
- Updated dependencies
  - @veloxts/auth@0.6.17
  - @veloxts/core@0.6.17
  - @veloxts/orm@0.6.17
  - @veloxts/router@0.6.17
  - @veloxts/validation@0.6.17

## 0.6.16

### Patch Changes

- add stubs for Fastify ecosystem packages
- Updated dependencies
  - @veloxts/auth@0.6.16
  - @veloxts/core@0.6.16
  - @veloxts/orm@0.6.16
  - @veloxts/router@0.6.16
  - @veloxts/validation@0.6.16

## 0.6.15

### Patch Changes

- implement three-layer Node.js stubbing for Vite
- Updated dependencies
  - @veloxts/auth@0.6.15
  - @veloxts/core@0.6.15
  - @veloxts/orm@0.6.15
  - @veloxts/router@0.6.15
  - @veloxts/validation@0.6.15

## 0.6.14

### Patch Changes

- stub dotenv as virtual module instead of process shims
- Updated dependencies
  - @veloxts/auth@0.6.14
  - @veloxts/core@0.6.14
  - @veloxts/orm@0.6.14
  - @veloxts/router@0.6.14
  - @veloxts/validation@0.6.14

## 0.6.13

### Patch Changes

- add process.argv stub for dotenv browser compatibility
- Updated dependencies
  - @veloxts/auth@0.6.13
  - @veloxts/core@0.6.13
  - @veloxts/orm@0.6.13
  - @veloxts/router@0.6.13
  - @veloxts/validation@0.6.13

## 0.6.12

### Patch Changes

- Fixes the "process is not defined" error from dotenv
- Updated dependencies
  - @veloxts/auth@0.6.12
  - @veloxts/core@0.6.12
  - @veloxts/orm@0.6.12
  - @veloxts/router@0.6.12
  - @veloxts/validation@0.6.12

## 0.6.11

### Patch Changes

- add Vite plugin for Node.js module stubs
- Updated dependencies
  - @veloxts/auth@0.6.11
  - @veloxts/core@0.6.11
  - @veloxts/orm@0.6.11
  - @veloxts/router@0.6.11
  - @veloxts/validation@0.6.11

## 0.6.10

### Patch Changes

- use import() type syntax for AppRouter
- Updated dependencies
  - @veloxts/auth@0.6.10
  - @veloxts/core@0.6.10
  - @veloxts/orm@0.6.10
  - @veloxts/router@0.6.10
  - @veloxts/validation@0.6.10

## 0.6.9

### Patch Changes

- isolate auth procedures from database imports
- Updated dependencies
  - @veloxts/auth@0.6.9
  - @veloxts/core@0.6.9
  - @veloxts/orm@0.6.9
  - @veloxts/router@0.6.9
  - @veloxts/validation@0.6.9

## 0.6.8

### Patch Changes

- prevent dotenv from leaking into browser bundle
- Updated dependencies
  - @veloxts/auth@0.6.8
  - @veloxts/core@0.6.8
  - @veloxts/orm@0.6.8
  - @veloxts/router@0.6.8
  - @veloxts/validation@0.6.8

## 0.6.7

### Patch Changes

- better-sqlite3 versions mismatch fix
- Updated dependencies
  - @veloxts/auth@0.6.7
  - @veloxts/core@0.6.7
  - @veloxts/orm@0.6.7
  - @veloxts/router@0.6.7
  - @veloxts/validation@0.6.7

## 0.6.6

### Patch Changes

- ensure the web app never imports server-side code paths
- Updated dependencies
  - @veloxts/auth@0.6.6
  - @veloxts/core@0.6.6
  - @veloxts/orm@0.6.6
  - @veloxts/router@0.6.6
  - @veloxts/validation@0.6.6

## 0.6.5

### Patch Changes

- move @prisma/client-runtime-utils to root package.json
- Updated dependencies
  - @veloxts/auth@0.6.5
  - @veloxts/core@0.6.5
  - @veloxts/orm@0.6.5
  - @veloxts/router@0.6.5
  - @veloxts/validation@0.6.5

## 0.6.4

### Patch Changes

- add @prisma/client-runtime-utils dependency
- Updated dependencies
  - @veloxts/auth@0.6.4
  - @veloxts/core@0.6.4
  - @veloxts/orm@0.6.4
  - @veloxts/router@0.6.4
  - @veloxts/validation@0.6.4

## 0.6.3

### Patch Changes

- Add workspaces field to root package.json template + Fix Prisma ESM/CJS import for Node.js v24
- Updated dependencies
  - @veloxts/auth@0.6.3
  - @veloxts/core@0.6.3
  - @veloxts/orm@0.6.3
  - @veloxts/router@0.6.3
  - @veloxts/validation@0.6.3

## 0.6.2

### Patch Changes

- add server actions, removed some deprecated and other chore
- Updated dependencies
  - @veloxts/auth@0.6.2
  - @veloxts/core@0.6.2
  - @veloxts/orm@0.6.2
  - @veloxts/router@0.6.2
  - @veloxts/validation@0.6.2

## 0.6.1

### Patch Changes

- route groups for file-based routing; add dynamic route support with [param] segments
- Updated dependencies
  - @veloxts/auth@0.6.1
  - @veloxts/core@0.6.1
  - @veloxts/orm@0.6.1
  - @veloxts/router@0.6.1
  - @veloxts/validation@0.6.1

## 0.6.0

### Minor Changes

- RSC streaming, dynamic routes, Vinxi integration

### Patch Changes

- Updated dependencies
  - @veloxts/auth@0.6.0
  - @veloxts/core@0.6.0
  - @veloxts/orm@0.6.0
  - @veloxts/router@0.6.0
  - @veloxts/validation@0.6.0

## 0.5.0

### Minor Changes

- Auto-register procedures + inject Prisma models feature

### Patch Changes

- Updated dependencies
  - @veloxts/auth@0.5.0
  - @veloxts/core@0.5.0
  - @veloxts/orm@0.5.0
  - @veloxts/router@0.5.0
  - @veloxts/validation@0.5.0

## 0.4.21

### Patch Changes

- format Prisma default values correctly by type
- Updated dependencies
  - @veloxts/auth@0.4.21
  - @veloxts/core@0.4.21
  - @veloxts/orm@0.4.21
  - @veloxts/router@0.4.21
  - @veloxts/validation@0.4.21

## 0.4.20

### Patch Changes

- import consolidation: update import paths for `@veloxts/velox`
- Updated dependencies
  - @veloxts/auth@0.4.20
  - @veloxts/core@0.4.20
  - @veloxts/orm@0.4.20
  - @veloxts/router@0.4.20
  - @veloxts/validation@0.4.20

## 0.4.19

### Patch Changes

- update default dev server port to 3030
- Updated dependencies
  - @veloxts/auth@0.4.19
  - @veloxts/core@0.4.19
  - @veloxts/orm@0.4.19
  - @veloxts/router@0.4.19
  - @veloxts/validation@0.4.19

## 0.4.18

### Patch Changes

- introduce interactive field menu and templates for resource generation
- Updated dependencies
  - @veloxts/auth@0.4.18
  - @veloxts/core@0.4.18
  - @veloxts/orm@0.4.18
  - @veloxts/router@0.4.18
  - @veloxts/validation@0.4.18

## 0.4.17

### Patch Changes

- add interactive field prompts for resource generation
- Updated dependencies
  - @veloxts/auth@0.4.17
  - @veloxts/core@0.4.17
  - @veloxts/orm@0.4.17
  - @veloxts/router@0.4.17
  - @veloxts/validation@0.4.17

## 0.4.16

### Patch Changes

- fixed velox procedures list
- Updated dependencies
  - @veloxts/auth@0.4.16
  - @veloxts/core@0.4.16
  - @veloxts/orm@0.4.16
  - @veloxts/router@0.4.16
  - @veloxts/validation@0.4.16

## 0.4.15

### Patch Changes

- chore lint fixes
- Updated dependencies
  - @veloxts/auth@0.4.15
  - @veloxts/core@0.4.15
  - @veloxts/orm@0.4.15
  - @veloxts/router@0.4.15
  - @veloxts/validation@0.4.15

## 0.4.14

### Patch Changes

- fixed proxy-type inferance and update proxy hooks for optional input handling
- Updated dependencies
  - @veloxts/auth@0.4.14
  - @veloxts/core@0.4.14
  - @veloxts/orm@0.4.14
  - @veloxts/router@0.4.14
  - @veloxts/validation@0.4.14

## 0.4.13

### Patch Changes

- add debug mode to dev server
- Updated dependencies
  - @veloxts/auth@0.4.13
  - @veloxts/core@0.4.13
  - @veloxts/orm@0.4.13
  - @veloxts/router@0.4.13
  - @veloxts/validation@0.4.13

## 0.4.12

### Patch Changes

- preserve type info in trpc template AppRouter export
- Updated dependencies
  - @veloxts/auth@0.4.12
  - @veloxts/core@0.4.12
  - @veloxts/orm@0.4.12
  - @veloxts/router@0.4.12
  - @veloxts/validation@0.4.12

## 0.4.11

### Patch Changes

- fixed api.health.check.useQuery is not a function issue
- Updated dependencies
  - @veloxts/auth@0.4.11
  - @veloxts/core@0.4.11
  - @veloxts/orm@0.4.11
  - @veloxts/router@0.4.11
  - @veloxts/validation@0.4.11

## 0.4.10

### Patch Changes

- fixed ReferenceError: styles is not defined in rpc template
- Updated dependencies
  - @veloxts/auth@0.4.10
  - @veloxts/core@0.4.10
  - @veloxts/orm@0.4.10
  - @veloxts/router@0.4.10
  - @veloxts/validation@0.4.10

## 0.4.7

### Patch Changes

- Add dynamic headers and routes config to client
- Updated dependencies
  - @veloxts/auth@0.4.7
  - @veloxts/core@0.4.7
  - @veloxts/orm@0.4.7
  - @veloxts/router@0.4.7
  - @veloxts/validation@0.4.7

## 0.4.6

### Patch Changes

- Fix broken npm packages - republish with correct dependencies
- Updated dependencies
  - @veloxts/auth@0.4.6
  - @veloxts/core@0.4.6
  - @veloxts/orm@0.4.6
  - @veloxts/router@0.4.6
  - @veloxts/validation@0.4.6

## 0.4.5

### Patch Changes

- b06631b: CI CD npm Trusted Publishing setup
- Updated dependencies [b06631b]
  - @veloxts/auth@0.4.5
  - @veloxts/core@0.4.5
  - @veloxts/orm@0.4.5
  - @veloxts/router@0.4.5
  - @veloxts/validation@0.4.5

## 0.4.4

### Patch Changes

- 05ae1a5: Update to boilerplate, work in progress
- 9961b52: full-stack React frontend implementation
- Updated dependencies [05ae1a5]
- Updated dependencies [9961b52]
  - @veloxts/auth@0.4.4
  - @veloxts/core@0.4.4
  - @veloxts/orm@0.4.4
  - @veloxts/router@0.4.4
  - @veloxts/validation@0.4.4

## 0.4.3

### Patch Changes

- ef8d5d0: Dynamically load VeloxTS version from `package.json` in shared template configuration
- Updated dependencies [ef8d5d0]
  - @veloxts/auth@0.4.3
  - @veloxts/core@0.4.3
  - @veloxts/orm@0.4.3
  - @veloxts/router@0.4.3
  - @veloxts/validation@0.4.3

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
