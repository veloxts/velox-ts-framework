# @veloxts/storage

## 0.6.95

### Patch Changes

- fix(create): use /trpc baseUrl for tRPC template and unwrap tRPC response format
- Updated dependencies
  - @veloxts/core@0.6.95

## 0.6.94

### Patch Changes

- feat(client): add tRPC router type support for ClientFromRouter and VeloxHooks
- Updated dependencies
  - @veloxts/core@0.6.94

## 0.6.93

### Patch Changes

- feat(router): add Resource API with phantom types for context-dependent outputs
- Updated dependencies
  - @veloxts/core@0.6.93

## 0.6.92

### Patch Changes

- feat(storage): add provider factories, lifecycle hooks, and presigned uploads
- Updated dependencies
  - @veloxts/core@0.6.92

## 0.6.91

### Patch Changes

- removed unused DI system
- Updated dependencies
  - @veloxts/core@0.6.91

## 0.6.90

### Patch Changes

- Dependencies updates – fix critical and high severity vulnerabilities
- Updated dependencies
  - @veloxts/core@0.6.90

## 0.6.89

### Patch Changes

- expand preset system with server config, auth presets, and security validation
- Updated dependencies
  - @veloxts/core@0.6.89

## 0.6.88

### Patch Changes

- add ecosystem presets for environment-aware configuration
- Updated dependencies
  - @veloxts/core@0.6.88

## 0.6.87

### Patch Changes

- Added missing documentations in left nav + primary colors from favicon
- Updated dependencies
  - @veloxts/core@0.6.87

## 0.6.86

### Patch Changes

- updated documentation
- Updated dependencies
  - @veloxts/core@0.6.86

## 0.6.85

### Patch Changes

- implement missing features from original requirements
- Updated dependencies
  - @veloxts/core@0.6.85

## 0.6.84

### Patch Changes

- - auth: add simplified guard() function with overloads + fluent builder
- Updated dependencies
  - @veloxts/core@0.6.84

## 0.6.83

### Patch Changes

- docs(templates): add /veloxts skill to CLAUDE.md files and links to online documentation
- Updated dependencies
  - @veloxts/core@0.6.83

## 0.6.82

### Patch Changes

- fix(create): add @veloxts/core to SPA template dependencies
- Updated dependencies
  - @veloxts/core@0.6.82

## 0.6.81

### Patch Changes

- fix(client): update ProcedureCollection type inference for two-parameter interface
- Updated dependencies
  - @veloxts/core@0.6.81

## 0.6.80

### Patch Changes

- fix(router,client): preserve procedure type literals for query/mutation discrimination + lint fixes
- Updated dependencies
  - @veloxts/core@0.6.80

## 0.6.79

### Patch Changes

- fix(router,client): preserve namespace literal types for proper type narrowing
- Updated dependencies
  - @veloxts/core@0.6.79

## 0.6.78

### Patch Changes

- fix(ci): add Docker Hub login to avoid rate limits in tests, add rsc-auth template to smoke test matrix, Fix / types.d.ts reference error in template
- Updated dependencies
  - @veloxts/core@0.6.78

## 0.6.77

### Patch Changes

- fix(core): remove duplicate Fastify type exports
- Updated dependencies
  - @veloxts/core@0.6.77

## 0.6.76

### Patch Changes

- fix(create): resolve all template type errors for zero-error scaffolding
- Updated dependencies
  - @veloxts/core@0.6.76

## 0.6.75

### Patch Changes

- feat(create): add --pm flag to skip package manager prompt
- Updated dependencies
  - @veloxts/core@0.6.75

## 0.6.74

### Patch Changes

- docs: fix erroneous file paths and improve auth context documentation
- Updated dependencies
  - @veloxts/core@0.6.74

## 0.6.73

### Patch Changes

- fix(create): add @veloxts/auth as explicit dependency in auth template
- Updated dependencies
  - @veloxts/core@0.6.73

## 0.6.72

### Patch Changes

- fix(create): prompt for database and package manager when template is passed
- Updated dependencies
  - @veloxts/core@0.6.72

## 0.6.71

### Patch Changes

- feat(create): add template shorthand flags (--auth, --rsc, etc.) (#20)
- Updated dependencies
  - @veloxts/core@0.6.71

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
  - @veloxts/core@0.6.70

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
  - @veloxts/core@0.6.69

## 0.6.68

### Patch Changes

- ci: add Claude code review and security review workflows, add GitHub release workflow, remove npm publish job
- Updated dependencies
  - @veloxts/core@0.6.68

## 0.6.67

### Patch Changes

- fix(create): add browser-safe routes.ts for auth template, prevent set -e from hiding CLI errors in smoke tests, add tsx to scaffolded project devDependencies
- Updated dependencies
  - @veloxts/core@0.6.67

## 0.6.66

### Patch Changes

- docs(skills): recommend namespace generator for AI agents
- Updated dependencies
  - @veloxts/core@0.6.66

## 0.6.65

### Patch Changes

- improve ai integration and simplify api router definition
- Updated dependencies
  - @veloxts/core@0.6.65

## 0.6.64

### Patch Changes

- fix(create): add @veloxts/velox and @veloxts/mcp to root package.json
- Updated dependencies
  - @veloxts/core@0.6.64

## 0.6.63

### Patch Changes

- feat(create): add dynamic database display name to CLAUDE.md templates
- Updated dependencies
  - @veloxts/core@0.6.63

## 0.6.62

### Patch Changes

- add Common Gotchas section to all template CLAUDE.md files + add dynamic database display name to CLAUDE.md templates
- Updated dependencies
  - @veloxts/core@0.6.62

## 0.6.61

### Patch Changes

- fix(mcp,cli): improve workspace support and add procedure auto-registration
- Updated dependencies
  - @veloxts/core@0.6.61

## 0.6.60

### Patch Changes

- feat(create): add tRPC-specific CLAUDE.md and improve AI-native features
- Updated dependencies
  - @veloxts/core@0.6.60

## 0.6.59

### Patch Changes

- refactor(ecosystem): Laravel-style API refinements & added missing unit tests
- Updated dependencies
  - @veloxts/core@0.6.59

## 0.6.58

### Patch Changes

- feat(router): add OpenAPI 3.0.3 specification generator
- Updated dependencies
  - @veloxts/core@0.6.58

## 0.6.57

### Patch Changes

- feat: add DI support to ecosystem packages and main packages
- Updated dependencies
  - @veloxts/core@0.6.57

## 0.6.56

### Patch Changes

- fix(create): resolve TypeScript errors in RSC templates
- Updated dependencies
  - @veloxts/core@0.6.56

## 0.6.55

### Patch Changes

- feat(mcp): add static TypeScript analyzer for procedure discovery
- Updated dependencies
  - @veloxts/core@0.6.55

## 0.6.54

### Patch Changes

- feat(cli): add velox mcp init command for Claude Desktop setup
- Updated dependencies
  - @veloxts/core@0.6.54

## 0.6.53

### Patch Changes

- feat(cli): add duplicate file detection to resource generator
- Updated dependencies
  - @veloxts/core@0.6.53

## 0.6.52

### Patch Changes

- feat(mcp): smart CLI resolution with fallbacks
- Updated dependencies
  - @veloxts/core@0.6.52

## 0.6.51

### Patch Changes

- fix(web): configure @vinxi/server-functions for RSC server actions
- Updated dependencies
  - @veloxts/core@0.6.51

## 0.6.50

### Patch Changes

- lint fixed
- Updated dependencies
  - @veloxts/core@0.6.50

## 0.6.49

### Patch Changes

- feat(create): add client import lint script for RSC templates
- Updated dependencies
  - @veloxts/core@0.6.49

## 0.6.48

### Patch Changes

- fix(web): remove server-only guards incompatible with Vite SS
- Updated dependencies
  - @veloxts/core@0.6.48

## 0.6.47

### Patch Changes

- fix(web): use /adapters for createH3ApiHandler to avoid server-only
- Updated dependencies
  - @veloxts/core@0.6.47

## 0.6.46

### Patch Changes

- fix(web): remove transitive server-only import from main entry
- Updated dependencies
  - @veloxts/core@0.6.46

## 0.6.45

### Patch Changes

- fix(web): remove server-only guard from main entry for Vinxi compat
- Updated dependencies
  - @veloxts/core@0.6.45

## 0.6.44

### Patch Changes

- refactor(web): implement proper RSC server/client separation
- Updated dependencies
  - @veloxts/core@0.6.44

## 0.6.43

### Patch Changes

- fix(web): exclude native modules from Vite dependency optimization
- Updated dependencies
  - @veloxts/core@0.6.43

## 0.6.42

### Patch Changes

- fix(web): enable tsconfig path aliases for Vite/Vinxi + docs(web): add @public/@internal JSDoc annotations to server actions
- Updated dependencies
  - @veloxts/core@0.6.42

## 0.6.41

### Patch Changes

- feat(web): add authAction helper for procedure bridge authentication
- Updated dependencies
  - @veloxts/core@0.6.41

## 0.6.40

### Patch Changes

- feat(create): consolidate template styles with unified dark mode design
- Updated dependencies
  - @veloxts/core@0.6.40

## 0.6.39

### Patch Changes

- fix RSC client hydration with split layout architecture
- Updated dependencies
  - @veloxts/core@0.6.39

## 0.6.38

### Patch Changes

- fix client hydration for RSC templates
- Updated dependencies
  - @veloxts/core@0.6.38

## 0.6.37

### Patch Changes

- feat(web): add validated() helper for secure server actions & add rsc-auth template with validated()
- Updated dependencies
  - @veloxts/core@0.6.37

## 0.6.36

### Patch Changes

- Gap Remediation Plan
- Updated dependencies
  - @veloxts/core@0.6.36

## 0.6.35

### Patch Changes

- proper auth template testing in verify-publis
- Updated dependencies
  - @veloxts/core@0.6.35

## 0.6.34

### Patch Changes

- update PostgreSQL adapter for Prisma 7 API
- Updated dependencies
  - @veloxts/core@0.6.34

## 0.6.33

### Patch Changes

- changed claude.md instruction, added prisma config
- Updated dependencies
  - @veloxts/core@0.6.33

## 0.6.32

### Patch Changes

- Introducing new Ecosystem Expansion packages: cache, queue, mail, storage, scheduler, events. Do not use yet
- Updated dependencies
  - @veloxts/core@0.6.32
