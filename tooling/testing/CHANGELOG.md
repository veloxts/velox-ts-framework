# @veloxts/testing

## 0.6.22

### Patch Changes

- support {method, path} route entry format
- Updated dependencies
  - @veloxts/core@0.6.22

## 0.6.21

### Patch Changes

- separate schemas from procedures for browser-safe import
- Updated dependencies
  - @veloxts/core@0.6.21

## 0.6.20

### Patch Changes

- add Fastify ecosystem stubs and debuglog to util
- Updated dependencies
  - @veloxts/core@0.6.20

## 0.6.19

### Patch Changes

- restore dotenv stub for browser compatibility
- Updated dependencies
  - @veloxts/core@0.6.19

## 0.6.18

### Patch Changes

- add node:fs/promises stub and fix esbuild plugin
- Updated dependencies
  - @veloxts/core@0.6.18

## 0.6.17

### Patch Changes

- remove optimizeDeps.exclude to fix CJS/ESM interop
- Updated dependencies
  - @veloxts/core@0.6.17

## 0.6.16

### Patch Changes

- add stubs for Fastify ecosystem packages
- Updated dependencies
  - @veloxts/core@0.6.16

## 0.6.15

### Patch Changes

- implement three-layer Node.js stubbing for Vite
- Updated dependencies
  - @veloxts/core@0.6.15

## 0.6.14

### Patch Changes

- stub dotenv as virtual module instead of process shims
- Updated dependencies
  - @veloxts/core@0.6.14

## 0.6.13

### Patch Changes

- add process.argv stub for dotenv browser compatibility
- Updated dependencies
  - @veloxts/core@0.6.13

## 0.6.12

### Patch Changes

- Fixes the "process is not defined" error from dotenv
- Updated dependencies
  - @veloxts/core@0.6.12

## 0.6.11

### Patch Changes

- add Vite plugin for Node.js module stubs
- Updated dependencies
  - @veloxts/core@0.6.11

## 0.6.10

### Patch Changes

- use import() type syntax for AppRouter
- Updated dependencies
  - @veloxts/core@0.6.10

## 0.6.9

### Patch Changes

- isolate auth procedures from database imports
- Updated dependencies
  - @veloxts/core@0.6.9

## 0.6.8

### Patch Changes

- prevent dotenv from leaking into browser bundle
- Updated dependencies
  - @veloxts/core@0.6.8

## 0.6.7

### Patch Changes

- better-sqlite3 versions mismatch fix
- Updated dependencies
  - @veloxts/core@0.6.7

## 0.6.6

### Patch Changes

- ensure the web app never imports server-side code paths
- Updated dependencies
  - @veloxts/core@0.6.6

## 0.6.5

### Patch Changes

- move @prisma/client-runtime-utils to root package.json
- Updated dependencies
  - @veloxts/core@0.6.5

## 0.6.4

### Patch Changes

- add @prisma/client-runtime-utils dependency
- Updated dependencies
  - @veloxts/core@0.6.4

## 0.6.3

### Patch Changes

- Add workspaces field to root package.json template + Fix Prisma ESM/CJS import for Node.js v24
- Updated dependencies
  - @veloxts/core@0.6.3

## 0.6.2

### Patch Changes

- add server actions, removed some deprecated and other chore
- Updated dependencies
  - @veloxts/core@0.6.2

## 0.6.1

### Patch Changes

- route groups for file-based routing; add dynamic route support with [param] segments
- Updated dependencies
  - @veloxts/core@0.6.1

## 0.6.0

### Minor Changes

- RSC streaming, dynamic routes, Vinxi integration

### Patch Changes

- Updated dependencies
  - @veloxts/core@0.6.0

## 0.5.0

### Minor Changes

- Auto-register procedures + inject Prisma models feature

### Patch Changes

- Updated dependencies
  - @veloxts/core@0.5.0

## 0.4.21

### Patch Changes

- format Prisma default values correctly by type
- Updated dependencies
  - @veloxts/core@0.4.21

## 0.4.20

### Patch Changes

- import consolidation: update import paths for `@veloxts/velox`
- Updated dependencies
  - @veloxts/core@0.4.20

## 0.4.19

### Patch Changes

- update default dev server port to 3030
- Updated dependencies
  - @veloxts/core@0.4.19

## 0.4.18

### Patch Changes

- introduce interactive field menu and templates for resource generation
- Updated dependencies
  - @veloxts/core@0.4.18

## 0.4.17

### Patch Changes

- add interactive field prompts for resource generation
- Updated dependencies
  - @veloxts/core@0.4.17

## 0.4.16

### Patch Changes

- fixed velox procedures list
- Updated dependencies
  - @veloxts/core@0.4.16

## 0.4.15

### Patch Changes

- chore lint fixes
- Updated dependencies
  - @veloxts/core@0.4.15

## 0.4.14

### Patch Changes

- fixed proxy-type inferance and update proxy hooks for optional input handling
- Updated dependencies
  - @veloxts/core@0.4.14

## 0.4.13

### Patch Changes

- add debug mode to dev server
- Updated dependencies
  - @veloxts/core@0.4.13

## 0.4.12

### Patch Changes

- preserve type info in trpc template AppRouter export
- Updated dependencies
  - @veloxts/core@0.4.12

## 0.4.11

### Patch Changes

- fixed api.health.check.useQuery is not a function issue
- Updated dependencies
  - @veloxts/core@0.4.11

## 0.4.10

### Patch Changes

- fixed ReferenceError: styles is not defined in rpc template
- Updated dependencies
  - @veloxts/core@0.4.10

## 0.4.7

### Patch Changes

- Add dynamic headers and routes config to client
- Updated dependencies
  - @veloxts/core@0.4.7

## 0.4.6

### Patch Changes

- Fix broken npm packages - republish with correct dependencies
- Updated dependencies
  - @veloxts/core@0.4.6

## 0.4.5

### Patch Changes

- b06631b: CI CD npm Trusted Publishing setup
- Updated dependencies [b06631b]
  - @veloxts/core@0.4.5

## 0.1.4

### Patch Changes

- 05ae1a5: Update to boilerplate, work in progress
- 9961b52: full-stack React frontend implementation
- Updated dependencies [05ae1a5]
- Updated dependencies [9961b52]
  - @veloxts/core@0.4.4

## 0.1.3

### Patch Changes

- ef8d5d0: Dynamically load VeloxTS version from `package.json` in shared template configuration
- Updated dependencies [ef8d5d0]
  - @veloxts/core@0.4.3

## 0.1.2

### Patch Changes

- 5b4f02c: Updated documentations
- 0d8d775: Updated guides and readme files
- Updated dependencies [5b4f02c]
- Updated dependencies [0d8d775]
  - @veloxts/core@0.4.2

## 0.1.1

### Patch Changes

- 0eea918: Completed CLI generators
- Updated dependencies [0eea918]
  - @veloxts/core@0.4.1

## 0.1.0

### Minor Changes

- b478fee: Performance Benchmarks | 34k req/s, <1ms p50 latency, 75MB memory, 530ms startup

### Patch Changes

- Updated dependencies [b478fee]
  - @veloxts/core@0.4.0

## 0.0.2

### Patch Changes

- 929f2ab: Interactive CLI setup
- Updated dependencies [929f2ab]
  - @veloxts/core@0.3.6

## 0.0.1

### Patch Changes

- 658e83f: @veloxts/auth, Full REST Support, Better error messages, Type tests with tsd
- Updated dependencies [658e83f]
  - @veloxts/core@0.3.5
