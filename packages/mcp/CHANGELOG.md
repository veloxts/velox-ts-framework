# @veloxts/mcp

## 0.6.47

### Patch Changes

- fix(web): use /adapters for createH3ApiHandler to avoid server-only
- Updated dependencies
  - @veloxts/cli@0.6.47
  - @veloxts/router@0.6.47
  - @veloxts/validation@0.6.47

## 0.6.46

### Patch Changes

- fix(web): remove transitive server-only import from main entry
- Updated dependencies
  - @veloxts/cli@0.6.46
  - @veloxts/router@0.6.46
  - @veloxts/validation@0.6.46

## 0.6.45

### Patch Changes

- fix(web): remove server-only guard from main entry for Vinxi compat
- Updated dependencies
  - @veloxts/cli@0.6.45
  - @veloxts/router@0.6.45
  - @veloxts/validation@0.6.45

## 0.6.44

### Patch Changes

- refactor(web): implement proper RSC server/client separation
- Updated dependencies
  - @veloxts/cli@0.6.44
  - @veloxts/router@0.6.44
  - @veloxts/validation@0.6.44

## 0.6.43

### Patch Changes

- fix(web): exclude native modules from Vite dependency optimization
- Updated dependencies
  - @veloxts/cli@0.6.43
  - @veloxts/router@0.6.43
  - @veloxts/validation@0.6.43

## 0.6.42

### Patch Changes

- fix(web): enable tsconfig path aliases for Vite/Vinxi + docs(web): add @public/@internal JSDoc annotations to server actions
- Updated dependencies
  - @veloxts/cli@0.6.42
  - @veloxts/router@0.6.42
  - @veloxts/validation@0.6.42

## 0.6.41

### Patch Changes

- feat(web): add authAction helper for procedure bridge authentication
- Updated dependencies
  - @veloxts/cli@0.6.41
  - @veloxts/router@0.6.41
  - @veloxts/validation@0.6.41

## 0.6.40

### Patch Changes

- feat(create): consolidate template styles with unified dark mode design
- Updated dependencies
  - @veloxts/cli@0.6.40
  - @veloxts/router@0.6.40
  - @veloxts/validation@0.6.40

## 0.6.39

### Patch Changes

- fix RSC client hydration with split layout architecture
- Updated dependencies
  - @veloxts/cli@0.6.39
  - @veloxts/router@0.6.39
  - @veloxts/validation@0.6.39

## 0.6.38

### Patch Changes

- fix client hydration for RSC templates
- Updated dependencies
  - @veloxts/cli@0.6.38
  - @veloxts/router@0.6.38
  - @veloxts/validation@0.6.38

## 0.6.37

### Patch Changes

- feat(web): add validated() helper for secure server actions & add rsc-auth template with validated()
- Updated dependencies
  - @veloxts/cli@0.6.37
  - @veloxts/router@0.6.37
  - @veloxts/validation@0.6.37

## 0.6.36

### Patch Changes

- Gap Remediation Plan
- Updated dependencies
  - @veloxts/cli@0.6.36
  - @veloxts/router@0.6.36
  - @veloxts/validation@0.6.36

## 0.6.35

### Patch Changes

- proper auth template testing in verify-publis
- Updated dependencies
  - @veloxts/cli@0.6.35
  - @veloxts/router@0.6.35
  - @veloxts/validation@0.6.35

## 0.6.34

### Patch Changes

- update PostgreSQL adapter for Prisma 7 API
- Updated dependencies
  - @veloxts/cli@0.6.34
  - @veloxts/router@0.6.34
  - @veloxts/validation@0.6.34

## 0.6.33

### Patch Changes

- changed claude.md instruction, added prisma config
- Updated dependencies
  - @veloxts/cli@0.6.33
  - @veloxts/router@0.6.33
  - @veloxts/validation@0.6.33

## 0.6.32

### Patch Changes

- Introducing new Ecosystem Expansion packages: cache, queue, mail, storage, scheduler, events. Do not use yet
- Updated dependencies
  - @veloxts/cli@0.6.32
  - @veloxts/router@0.6.32
  - @veloxts/validation@0.6.32

## 0.6.31

### Patch Changes

- npm must use concurrently for run dev script
- Updated dependencies
  - @veloxts/cli@0.6.31
  - @veloxts/router@0.6.31
  - @veloxts/validation@0.6.31

## 0.6.30

### Patch Changes

- disable source maps for published packages
- Updated dependencies
  - @veloxts/cli@0.6.30
  - @veloxts/router@0.6.30
  - @veloxts/validation@0.6.30

## 0.6.29

### Patch Changes

- add multi-tenancy and PostgreSQL support - test and lint fix
- Updated dependencies
  - @veloxts/cli@0.6.29
  - @veloxts/router@0.6.29
  - @veloxts/validation@0.6.29

## 0.6.28

### Patch Changes

- add multi-tenancy support and postgresql database
- Updated dependencies
  - @veloxts/cli@0.6.28
  - @veloxts/router@0.6.28
  - @veloxts/validation@0.6.28

## 0.6.27

### Patch Changes

- chore: add GUIDE, LICENSE and CHANGELOG.md to npm files
- Updated dependencies
  - @veloxts/cli@0.6.27
  - @veloxts/router@0.6.27
  - @veloxts/validation@0.6.27

## 0.6.26

### Patch Changes

- docs(mcp): add README and GUIDE, docs(web): simplify README and create concise GUIDE
- Updated dependencies
  - @veloxts/cli@0.6.26
  - @veloxts/router@0.6.26
  - @veloxts/validation@0.6.26

## 0.6.25

### Patch Changes

- docs(create): add guide for React Server Components setup
- Updated dependencies
  - @veloxts/cli@0.6.25
  - @veloxts/router@0.6.25
  - @veloxts/validation@0.6.25

## 0.6.24

### Patch Changes

- clarify installation paths and package contents
- Updated dependencies
  - @veloxts/cli@0.6.24
  - @veloxts/router@0.6.24
  - @veloxts/validation@0.6.24

## 0.6.23

### Patch Changes

- add defineContract for improved type inference DX
- Updated dependencies
  - @veloxts/cli@0.6.23
  - @veloxts/router@0.6.23
  - @veloxts/validation@0.6.23

## 0.6.22

### Patch Changes

- support {method, path} route entry format
- Updated dependencies
  - @veloxts/cli@0.6.22
  - @veloxts/router@0.6.22
  - @veloxts/validation@0.6.22

## 0.6.21

### Patch Changes

- separate schemas from procedures for browser-safe import
- Updated dependencies
  - @veloxts/cli@0.6.21
  - @veloxts/router@0.6.21
  - @veloxts/validation@0.6.21

## 0.6.20

### Patch Changes

- add Fastify ecosystem stubs and debuglog to util
- Updated dependencies
  - @veloxts/cli@0.6.20
  - @veloxts/router@0.6.20
  - @veloxts/validation@0.6.20

## 0.6.19

### Patch Changes

- restore dotenv stub for browser compatibility
- Updated dependencies
  - @veloxts/cli@0.6.19
  - @veloxts/router@0.6.19
  - @veloxts/validation@0.6.19

## 0.6.18

### Patch Changes

- add node:fs/promises stub and fix esbuild plugin
- Updated dependencies
  - @veloxts/cli@0.6.18
  - @veloxts/router@0.6.18
  - @veloxts/validation@0.6.18

## 0.6.17

### Patch Changes

- remove optimizeDeps.exclude to fix CJS/ESM interop
- Updated dependencies
  - @veloxts/cli@0.6.17
  - @veloxts/router@0.6.17
  - @veloxts/validation@0.6.17

## 0.6.16

### Patch Changes

- add stubs for Fastify ecosystem packages
- Updated dependencies
  - @veloxts/cli@0.6.16
  - @veloxts/router@0.6.16
  - @veloxts/validation@0.6.16

## 0.6.15

### Patch Changes

- implement three-layer Node.js stubbing for Vite
- Updated dependencies
  - @veloxts/cli@0.6.15
  - @veloxts/router@0.6.15
  - @veloxts/validation@0.6.15

## 0.6.14

### Patch Changes

- stub dotenv as virtual module instead of process shims
- Updated dependencies
  - @veloxts/cli@0.6.14
  - @veloxts/router@0.6.14
  - @veloxts/validation@0.6.14

## 0.6.13

### Patch Changes

- add process.argv stub for dotenv browser compatibility
- Updated dependencies
  - @veloxts/cli@0.6.13
  - @veloxts/router@0.6.13
  - @veloxts/validation@0.6.13

## 0.6.12

### Patch Changes

- Fixes the "process is not defined" error from dotenv
- Updated dependencies
  - @veloxts/cli@0.6.12
  - @veloxts/router@0.6.12
  - @veloxts/validation@0.6.12

## 0.6.11

### Patch Changes

- add Vite plugin for Node.js module stubs
- Updated dependencies
  - @veloxts/cli@0.6.11
  - @veloxts/router@0.6.11
  - @veloxts/validation@0.6.11

## 0.6.10

### Patch Changes

- use import() type syntax for AppRouter
- Updated dependencies
  - @veloxts/cli@0.6.10
  - @veloxts/router@0.6.10
  - @veloxts/validation@0.6.10

## 0.6.9

### Patch Changes

- isolate auth procedures from database imports
- Updated dependencies
  - @veloxts/cli@0.6.9
  - @veloxts/router@0.6.9
  - @veloxts/validation@0.6.9

## 0.6.8

### Patch Changes

- prevent dotenv from leaking into browser bundle
- Updated dependencies
  - @veloxts/cli@0.6.8
  - @veloxts/router@0.6.8
  - @veloxts/validation@0.6.8

## 0.6.7

### Patch Changes

- better-sqlite3 versions mismatch fix
- Updated dependencies
  - @veloxts/cli@0.6.7
  - @veloxts/router@0.6.7
  - @veloxts/validation@0.6.7

## 0.6.6

### Patch Changes

- ensure the web app never imports server-side code paths
- Updated dependencies
  - @veloxts/cli@0.6.6
  - @veloxts/router@0.6.6
  - @veloxts/validation@0.6.6

## 0.6.5

### Patch Changes

- move @prisma/client-runtime-utils to root package.json
- Updated dependencies
  - @veloxts/cli@0.6.5
  - @veloxts/router@0.6.5
  - @veloxts/validation@0.6.5

## 0.6.4

### Patch Changes

- add @prisma/client-runtime-utils dependency
- Updated dependencies
  - @veloxts/cli@0.6.4
  - @veloxts/router@0.6.4
  - @veloxts/validation@0.6.4

## 0.6.3

### Patch Changes

- Add workspaces field to root package.json template + Fix Prisma ESM/CJS import for Node.js v24
- Updated dependencies
  - @veloxts/cli@0.6.3
  - @veloxts/router@0.6.3
  - @veloxts/validation@0.6.3

## 0.6.2

### Patch Changes

- add server actions, removed some deprecated and other chore
- Updated dependencies
  - @veloxts/cli@0.6.2
  - @veloxts/router@0.6.2
  - @veloxts/validation@0.6.2

## 0.6.1

### Patch Changes

- route groups for file-based routing; add dynamic route support with [param] segments
- Updated dependencies
  - @veloxts/cli@0.6.1
  - @veloxts/router@0.6.1
  - @veloxts/validation@0.6.1

## 0.6.0

### Minor Changes

- RSC streaming, dynamic routes, Vinxi integration

### Patch Changes

- Updated dependencies
  - @veloxts/cli@0.6.0
  - @veloxts/router@0.6.0
  - @veloxts/validation@0.6.0
