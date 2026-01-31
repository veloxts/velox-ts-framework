# @veloxts/mcp

## 0.6.89

### Patch Changes

- expand preset system with server config, auth presets, and security validation
- Updated dependencies
  - @veloxts/cli@0.6.89
  - @veloxts/router@0.6.89
  - @veloxts/validation@0.6.89

## 0.6.88

### Patch Changes

- add ecosystem presets for environment-aware configuration
- Updated dependencies
  - @veloxts/cli@0.6.88
  - @veloxts/router@0.6.88
  - @veloxts/validation@0.6.88

## 0.6.87

### Patch Changes

- Added missing documentations in left nav + primary colors from favicon
- Updated dependencies
  - @veloxts/cli@0.6.87
  - @veloxts/router@0.6.87
  - @veloxts/validation@0.6.87

## 0.6.86

### Patch Changes

- updated documentation
- Updated dependencies
  - @veloxts/cli@0.6.86
  - @veloxts/router@0.6.86
  - @veloxts/validation@0.6.86

## 0.6.85

### Patch Changes

- implement missing features from original requirements
- Updated dependencies
  - @veloxts/cli@0.6.85
  - @veloxts/router@0.6.85
  - @veloxts/validation@0.6.85

## 0.6.84

### Patch Changes

- - auth: add simplified guard() function with overloads + fluent builder
- Updated dependencies
  - @veloxts/cli@0.6.84
  - @veloxts/router@0.6.84
  - @veloxts/validation@0.6.84

## 0.6.83

### Patch Changes

- docs(templates): add /veloxts skill to CLAUDE.md files and links to online documentation
- Updated dependencies
  - @veloxts/cli@0.6.83
  - @veloxts/router@0.6.83
  - @veloxts/validation@0.6.83

## 0.6.82

### Patch Changes

- fix(create): add @veloxts/core to SPA template dependencies
- Updated dependencies
  - @veloxts/cli@0.6.82
  - @veloxts/router@0.6.82
  - @veloxts/validation@0.6.82

## 0.6.81

### Patch Changes

- fix(client): update ProcedureCollection type inference for two-parameter interface
- Updated dependencies
  - @veloxts/cli@0.6.81
  - @veloxts/router@0.6.81
  - @veloxts/validation@0.6.81

## 0.6.80

### Patch Changes

- fix(router,client): preserve procedure type literals for query/mutation discrimination + lint fixes
- Updated dependencies
  - @veloxts/cli@0.6.80
  - @veloxts/router@0.6.80
  - @veloxts/validation@0.6.80

## 0.6.79

### Patch Changes

- fix(router,client): preserve namespace literal types for proper type narrowing
- Updated dependencies
  - @veloxts/cli@0.6.79
  - @veloxts/router@0.6.79
  - @veloxts/validation@0.6.79

## 0.6.78

### Patch Changes

- fix(ci): add Docker Hub login to avoid rate limits in tests, add rsc-auth template to smoke test matrix, Fix / types.d.ts reference error in template
- Updated dependencies
  - @veloxts/cli@0.6.78
  - @veloxts/router@0.6.78
  - @veloxts/validation@0.6.78

## 0.6.77

### Patch Changes

- fix(core): remove duplicate Fastify type exports
- Updated dependencies
  - @veloxts/cli@0.6.77
  - @veloxts/router@0.6.77
  - @veloxts/validation@0.6.77

## 0.6.76

### Patch Changes

- fix(create): resolve all template type errors for zero-error scaffolding
- Updated dependencies
  - @veloxts/cli@0.6.76
  - @veloxts/router@0.6.76
  - @veloxts/validation@0.6.76

## 0.6.75

### Patch Changes

- feat(create): add --pm flag to skip package manager prompt
- Updated dependencies
  - @veloxts/cli@0.6.75
  - @veloxts/router@0.6.75
  - @veloxts/validation@0.6.75

## 0.6.74

### Patch Changes

- docs: fix erroneous file paths and improve auth context documentation
- Updated dependencies
  - @veloxts/cli@0.6.74
  - @veloxts/router@0.6.74
  - @veloxts/validation@0.6.74

## 0.6.73

### Patch Changes

- fix(create): add @veloxts/auth as explicit dependency in auth template
- Updated dependencies
  - @veloxts/cli@0.6.73
  - @veloxts/router@0.6.73
  - @veloxts/validation@0.6.73

## 0.6.72

### Patch Changes

- fix(create): prompt for database and package manager when template is passed
- Updated dependencies
  - @veloxts/cli@0.6.72
  - @veloxts/router@0.6.72
  - @veloxts/validation@0.6.72

## 0.6.71

### Patch Changes

- feat(create): add template shorthand flags (--auth, --rsc, etc.) (#20)
- Updated dependencies
  - @veloxts/cli@0.6.71
  - @veloxts/router@0.6.71
  - @veloxts/validation@0.6.71

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

- Updated dependencies
  - @veloxts/cli@0.6.70
  - @veloxts/router@0.6.70
  - @veloxts/validation@0.6.70

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

- Updated dependencies
  - @veloxts/cli@0.6.69
  - @veloxts/router@0.6.69
  - @veloxts/validation@0.6.69

## 0.6.68

### Patch Changes

- ci: add Claude code review and security review workflows, add GitHub release workflow, remove npm publish job
- Updated dependencies
  - @veloxts/cli@0.6.68
  - @veloxts/router@0.6.68
  - @veloxts/validation@0.6.68

## 0.6.67

### Patch Changes

- fix(create): add browser-safe routes.ts for auth template, prevent set -e from hiding CLI errors in smoke tests, add tsx to scaffolded project devDependencies
- Updated dependencies
  - @veloxts/cli@0.6.67
  - @veloxts/router@0.6.67
  - @veloxts/validation@0.6.67

## 0.6.66

### Patch Changes

- docs(skills): recommend namespace generator for AI agents
- Updated dependencies
  - @veloxts/cli@0.6.66
  - @veloxts/router@0.6.66
  - @veloxts/validation@0.6.66

## 0.6.65

### Patch Changes

- improve ai integration and simplify api router definition
- Updated dependencies
  - @veloxts/cli@0.6.65
  - @veloxts/router@0.6.65
  - @veloxts/validation@0.6.65

## 0.6.64

### Patch Changes

- fix(create): add @veloxts/velox and @veloxts/mcp to root package.json
- Updated dependencies
  - @veloxts/cli@0.6.64
  - @veloxts/router@0.6.64
  - @veloxts/validation@0.6.64

## 0.6.63

### Patch Changes

- feat(create): add dynamic database display name to CLAUDE.md templates
- Updated dependencies
  - @veloxts/cli@0.6.63
  - @veloxts/router@0.6.63
  - @veloxts/validation@0.6.63

## 0.6.62

### Patch Changes

- add Common Gotchas section to all template CLAUDE.md files + add dynamic database display name to CLAUDE.md templates
- Updated dependencies
  - @veloxts/cli@0.6.62
  - @veloxts/router@0.6.62
  - @veloxts/validation@0.6.62

## 0.6.61

### Patch Changes

- fix(mcp,cli): improve workspace support and add procedure auto-registration
- Updated dependencies
  - @veloxts/cli@0.6.61
  - @veloxts/router@0.6.61
  - @veloxts/validation@0.6.61

## 0.6.60

### Patch Changes

- feat(create): add tRPC-specific CLAUDE.md and improve AI-native features
- Updated dependencies
  - @veloxts/cli@0.6.60
  - @veloxts/router@0.6.60
  - @veloxts/validation@0.6.60

## 0.6.59

### Patch Changes

- refactor(ecosystem): Laravel-style API refinements & added missing unit tests
- Updated dependencies
  - @veloxts/cli@0.6.59
  - @veloxts/router@0.6.59
  - @veloxts/validation@0.6.59

## 0.6.58

### Patch Changes

- feat(router): add OpenAPI 3.0.3 specification generator
- Updated dependencies
  - @veloxts/cli@0.6.58
  - @veloxts/router@0.6.58
  - @veloxts/validation@0.6.58

## 0.6.57

### Patch Changes

- feat: add DI support to ecosystem packages and main packages
- Updated dependencies
  - @veloxts/cli@0.6.57
  - @veloxts/router@0.6.57
  - @veloxts/validation@0.6.57

## 0.6.56

### Patch Changes

- fix(create): resolve TypeScript errors in RSC templates
- Updated dependencies
  - @veloxts/cli@0.6.56
  - @veloxts/router@0.6.56
  - @veloxts/validation@0.6.56

## 0.6.55

### Patch Changes

- feat(mcp): add static TypeScript analyzer for procedure discovery
- Updated dependencies
  - @veloxts/cli@0.6.55
  - @veloxts/router@0.6.55
  - @veloxts/validation@0.6.55

## 0.6.54

### Patch Changes

- feat(cli): add velox mcp init command for Claude Desktop setup
- Updated dependencies
  - @veloxts/cli@0.6.54
  - @veloxts/router@0.6.54
  - @veloxts/validation@0.6.54

## 0.6.53

### Patch Changes

- feat(cli): add duplicate file detection to resource generator
- Updated dependencies
  - @veloxts/cli@0.6.53
  - @veloxts/router@0.6.53
  - @veloxts/validation@0.6.53

## 0.6.52

### Patch Changes

- feat(mcp): smart CLI resolution with fallbacks
- Updated dependencies
  - @veloxts/cli@0.6.52
  - @veloxts/router@0.6.52
  - @veloxts/validation@0.6.52

## 0.6.51

### Patch Changes

- fix(web): configure @vinxi/server-functions for RSC server actions
- Updated dependencies
  - @veloxts/cli@0.6.51
  - @veloxts/router@0.6.51
  - @veloxts/validation@0.6.51

## 0.6.50

### Patch Changes

- lint fixed
- Updated dependencies
  - @veloxts/cli@0.6.50
  - @veloxts/router@0.6.50
  - @veloxts/validation@0.6.50

## 0.6.49

### Patch Changes

- feat(create): add client import lint script for RSC templates
- Updated dependencies
  - @veloxts/cli@0.6.49
  - @veloxts/router@0.6.49
  - @veloxts/validation@0.6.49

## 0.6.48

### Patch Changes

- fix(web): remove server-only guards incompatible with Vite SS
- Updated dependencies
  - @veloxts/cli@0.6.48
  - @veloxts/router@0.6.48
  - @veloxts/validation@0.6.48

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
