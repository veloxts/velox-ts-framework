# @veloxts/mcp

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
