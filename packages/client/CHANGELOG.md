# @veloxts/client

## 0.6.84

### Patch Changes

- - auth: add simplified guard() function with overloads + fluent builder

## 0.6.83

### Patch Changes

- docs(templates): add /veloxts skill to CLAUDE.md files and links to online documentation

## 0.6.82

### Patch Changes

- fix(create): add @veloxts/core to SPA template dependencies

## 0.6.81

### Patch Changes

- fix(client): update ProcedureCollection type inference for two-parameter interface

## 0.6.80

### Patch Changes

- fix(router,client): preserve procedure type literals for query/mutation discrimination + lint fixes

## 0.6.79

### Patch Changes

- fix(router,client): preserve namespace literal types for proper type narrowing

## 0.6.78

### Patch Changes

- fix(ci): add Docker Hub login to avoid rate limits in tests, add rsc-auth template to smoke test matrix, Fix / types.d.ts reference error in template

## 0.6.77

### Patch Changes

- fix(core): remove duplicate Fastify type exports

## 0.6.76

### Patch Changes

- fix(create): resolve all template type errors for zero-error scaffolding

## 0.6.75

### Patch Changes

- feat(create): add --pm flag to skip package manager prompt

## 0.6.74

### Patch Changes

- docs: fix erroneous file paths and improve auth context documentation

## 0.6.73

### Patch Changes

- fix(create): add @veloxts/auth as explicit dependency in auth template

## 0.6.72

### Patch Changes

- fix(create): prompt for database and package manager when template is passed

## 0.6.71

### Patch Changes

- feat(create): add template shorthand flags (--auth, --rsc, etc.) (#20)

## 0.6.70

### Patch Changes

- ### feat(auth): Unified Adapter-Only Architecture

  **New Features:**

  - Add `JwtAdapter` implementing the `AuthAdapter` interface for unified JWT authentication
  - Add `jwtAuth()` convenience function for direct adapter usage with optional built-in routes (`/api/auth/refresh`, `/api/auth/logout`)
  - Add `AuthContext` discriminated union (`NativeAuthContext | AdapterAuthContext`) for type-safe auth mode handling
  - Add double-registration protection to prevent conflicting auth system setups
  - Add shared decoration utilities (`decorateAuth`, `setRequestAuth`, `checkDoubleRegistration`)

  **Architecture Changes:**

  - `authPlugin` now uses `JwtAdapter` internally - all authentication flows through the adapter pattern
  - Single code path for authentication (no more dual native/adapter modes)
  - `authContext.authMode` is now always `'adapter'` with `providerId='jwt'` when using `authPlugin`

  **Breaking Changes:**

  - Remove deprecated `LegacySessionConfig` interface (use `sessionMiddleware` instead)
  - Remove deprecated `session` field from `AuthConfig`
  - `User` interface no longer has index signature (extend via declaration merging)

  **Type Safety Improvements:**

  - `AuthContext` discriminated union enables exhaustive type narrowing based on `authMode`
  - Export `NativeAuthContext` and `AdapterAuthContext` types for explicit typing

  **Migration:**

  - Existing `authPlugin` usage remains backward-compatible
  - If checking `authContext.token`, use `authContext.session` instead (token stored in session for adapter mode)

## 0.6.69

### Patch Changes

- implement user feedback improvements across packages

  ## Summary

  Addresses 9 user feedback items to improve DX, reduce boilerplate, and eliminate template duplications.

  ### Phase 1: Validation Helpers (`@veloxts/validation`)

  - Add `prismaDecimal()`, `prismaDecimalNullable()`, `prismaDecimalOptional()` for Prisma Decimal → number conversion
  - Add `dateToIso`, `dateToIsoNullable`, `dateToIsoOptional` aliases for consistency

  ### Phase 2: Template Deduplication (`@veloxts/auth`)

  - Export `createEnhancedTokenStore()` with token revocation and refresh token reuse detection
  - Export `parseUserRoles()` and `DEFAULT_ALLOWED_ROLES`
  - Fix memory leak: track pending timeouts for proper cleanup on `destroy()`
  - Update templates to import from `@veloxts/auth` instead of duplicating code
  - Fix jwtManager singleton pattern in templates

  ### Phase 3: Router Helpers (`@veloxts/router`)

  - Add `createRouter()` returning `{ collections, router }` for DRY setup
  - Add `toRouter()` for router-only use cases
  - Update all router templates to use `createRouter()`

  ### Phase 4: Guard Type Narrowing - Experimental (`@veloxts/auth`, `@veloxts/router`)

  - Add `NarrowingGuard` interface with phantom `_narrows` type
  - Add `authenticatedNarrow` and `hasRoleNarrow()` guards
  - Add `guardNarrow()` method to `ProcedureBuilder` for context narrowing
  - Enables `ctx.user` to be non-null after guard passes

  ### Phase 5: Documentation (`@veloxts/router`)

  - Document `.rest()` override patterns
  - Document `createRouter()` helper usage
  - Document `guardNarrow()` experimental API
  - Add schema browser-safety patterns for RSC apps

## 0.6.68

### Patch Changes

- ci: add Claude code review and security review workflows, add GitHub release workflow, remove npm publish job

## 0.6.67

### Patch Changes

- fix(create): add browser-safe routes.ts for auth template, prevent set -e from hiding CLI errors in smoke tests, add tsx to scaffolded project devDependencies

## 0.6.66

### Patch Changes

- docs(skills): recommend namespace generator for AI agents

## 0.6.65

### Patch Changes

- improve ai integration and simplify api router definition

## 0.6.64

### Patch Changes

- fix(create): add @veloxts/velox and @veloxts/mcp to root package.json

## 0.6.63

### Patch Changes

- feat(create): add dynamic database display name to CLAUDE.md templates

## 0.6.62

### Patch Changes

- add Common Gotchas section to all template CLAUDE.md files + add dynamic database display name to CLAUDE.md templates

## 0.6.61

### Patch Changes

- fix(mcp,cli): improve workspace support and add procedure auto-registration

## 0.6.60

### Patch Changes

- feat(create): add tRPC-specific CLAUDE.md and improve AI-native features

## 0.6.59

### Patch Changes

- refactor(ecosystem): Laravel-style API refinements & added missing unit tests

## 0.6.58

### Patch Changes

- feat(router): add OpenAPI 3.0.3 specification generator

## 0.6.57

### Patch Changes

- feat: add DI support to ecosystem packages and main packages

## 0.6.56

### Patch Changes

- fix(create): resolve TypeScript errors in RSC templates

## 0.6.55

### Patch Changes

- feat(mcp): add static TypeScript analyzer for procedure discovery

## 0.6.54

### Patch Changes

- feat(cli): add velox mcp init command for Claude Desktop setup

## 0.6.53

### Patch Changes

- feat(cli): add duplicate file detection to resource generator

## 0.6.52

### Patch Changes

- feat(mcp): smart CLI resolution with fallbacks

## 0.6.51

### Patch Changes

- fix(web): configure @vinxi/server-functions for RSC server actions

## 0.6.50

### Patch Changes

- lint fixed

## 0.6.49

### Patch Changes

- feat(create): add client import lint script for RSC templates

## 0.6.48

### Patch Changes

- fix(web): remove server-only guards incompatible with Vite SS

## 0.6.47

### Patch Changes

- fix(web): use /adapters for createH3ApiHandler to avoid server-only

## 0.6.46

### Patch Changes

- fix(web): remove transitive server-only import from main entry

## 0.6.45

### Patch Changes

- fix(web): remove server-only guard from main entry for Vinxi compat

## 0.6.44

### Patch Changes

- refactor(web): implement proper RSC server/client separation

## 0.6.43

### Patch Changes

- fix(web): exclude native modules from Vite dependency optimization

## 0.6.42

### Patch Changes

- fix(web): enable tsconfig path aliases for Vite/Vinxi + docs(web): add @public/@internal JSDoc annotations to server actions

## 0.6.41

### Patch Changes

- feat(web): add authAction helper for procedure bridge authentication

## 0.6.40

### Patch Changes

- feat(create): consolidate template styles with unified dark mode design

## 0.6.39

### Patch Changes

- fix RSC client hydration with split layout architecture

## 0.6.38

### Patch Changes

- fix client hydration for RSC templates

## 0.6.37

### Patch Changes

- feat(web): add validated() helper for secure server actions & add rsc-auth template with validated()

## 0.6.36

### Patch Changes

- Gap Remediation Plan

## 0.6.35

### Patch Changes

- proper auth template testing in verify-publis

## 0.6.34

### Patch Changes

- update PostgreSQL adapter for Prisma 7 API

## 0.6.33

### Patch Changes

- changed claude.md instruction, added prisma config

## 0.6.32

### Patch Changes

- Introducing new Ecosystem Expansion packages: cache, queue, mail, storage, scheduler, events. Do not use yet

## 0.6.31

### Patch Changes

- npm must use concurrently for run dev script

## 0.6.30

### Patch Changes

- disable source maps for published packages

## 0.6.29

### Patch Changes

- add multi-tenancy and PostgreSQL support - test and lint fix

## 0.6.28

### Patch Changes

- add multi-tenancy support and postgresql database

## 0.6.27

### Patch Changes

- chore: add GUIDE, LICENSE and CHANGELOG.md to npm files

## 0.6.26

### Patch Changes

- docs(mcp): add README and GUIDE, docs(web): simplify README and create concise GUIDE

## 0.6.25

### Patch Changes

- docs(create): add guide for React Server Components setup

## 0.6.24

### Patch Changes

- clarify installation paths and package contents

## 0.6.23

### Patch Changes

- add defineContract for improved type inference DX

## 0.6.22

### Patch Changes

- support {method, path} route entry format

## 0.6.21

### Patch Changes

- separate schemas from procedures for browser-safe import

## 0.6.20

### Patch Changes

- add Fastify ecosystem stubs and debuglog to util

## 0.6.19

### Patch Changes

- restore dotenv stub for browser compatibility

## 0.6.18

### Patch Changes

- add node:fs/promises stub and fix esbuild plugin

## 0.6.17

### Patch Changes

- remove optimizeDeps.exclude to fix CJS/ESM interop

## 0.6.16

### Patch Changes

- add stubs for Fastify ecosystem packages

## 0.6.15

### Patch Changes

- implement three-layer Node.js stubbing for Vite

## 0.6.14

### Patch Changes

- stub dotenv as virtual module instead of process shims

## 0.6.13

### Patch Changes

- add process.argv stub for dotenv browser compatibility

## 0.6.12

### Patch Changes

- Fixes the "process is not defined" error from dotenv

## 0.6.11

### Patch Changes

- add Vite plugin for Node.js module stubs

## 0.6.10

### Patch Changes

- use import() type syntax for AppRouter

## 0.6.9

### Patch Changes

- isolate auth procedures from database imports

## 0.6.8

### Patch Changes

- prevent dotenv from leaking into browser bundle

## 0.6.7

### Patch Changes

- better-sqlite3 versions mismatch fix

## 0.6.6

### Patch Changes

- ensure the web app never imports server-side code paths

## 0.6.5

### Patch Changes

- move @prisma/client-runtime-utils to root package.json

## 0.6.4

### Patch Changes

- add @prisma/client-runtime-utils dependency

## 0.6.3

### Patch Changes

- Add workspaces field to root package.json template + Fix Prisma ESM/CJS import for Node.js v24

## 0.6.2

### Patch Changes

- add server actions, removed some deprecated and other chore

## 0.6.1

### Patch Changes

- route groups for file-based routing; add dynamic route support with [param] segments

## 0.6.0

### Minor Changes

- RSC streaming, dynamic routes, Vinxi integration

## 0.5.0

### Minor Changes

- Auto-register procedures + inject Prisma models feature

## 0.4.21

### Patch Changes

- format Prisma default values correctly by type

## 0.4.20

### Patch Changes

- import consolidation: update import paths for `@veloxts/velox`

## 0.4.19

### Patch Changes

- update default dev server port to 3030

## 0.4.18

### Patch Changes

- introduce interactive field menu and templates for resource generation

## 0.4.17

### Patch Changes

- add interactive field prompts for resource generation

## 0.4.16

### Patch Changes

- fixed velox procedures list

## 0.4.15

### Patch Changes

- chore lint fixes

## 0.4.14

### Patch Changes

- fixed proxy-type inferance and update proxy hooks for optional input handling

## 0.4.13

### Patch Changes

- add debug mode to dev server

## 0.4.12

### Patch Changes

- preserve type info in trpc template AppRouter export

## 0.4.11

### Patch Changes

- fixed api.health.check.useQuery is not a function issue

## 0.4.10

### Patch Changes

- fixed ReferenceError: styles is not defined in rpc template

## 0.4.8

### Patch Changes

- Fix 'Illegal invocation' error when using fetch in browser

  Bind fetch to globalThis to preserve the correct execution context.

## 0.4.7

### Patch Changes

- Add dynamic headers and routes config to client

## 0.4.6

### Patch Changes

- Fix broken npm packages - republish with correct dependencies

## 0.4.5

### Patch Changes

- b06631b: CI CD npm Trusted Publishing setup

## 0.4.4

### Patch Changes

- 05ae1a5: Update to boilerplate, work in progress
- 9961b52: full-stack React frontend implementation

## 0.4.3

### Patch Changes

- ef8d5d0: Dynamically load VeloxTS version from `package.json` in shared template configuration

## 0.4.2

### Patch Changes

- 5b4f02c: Updated documentations
- 0d8d775: Updated guides and readme files

## 0.4.1

### Patch Changes

- 0eea918: Completed CLI generators

## 0.4.0

### Minor Changes

- b478fee: Performance Benchmarks | 34k req/s, <1ms p50 latency, 75MB memory, 530ms startup

## 0.3.6

### Patch Changes

- 929f2ab: Interactive CLI setup

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
