# `velox sync` Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a `velox sync` CLI command that reads the Prisma schema and interactively generates complete Zod schemas + CRUD procedures for all models in one shot.

**Architecture:** New `sync/` module in the CLI package with a 5-stage pipeline: analyze Prisma schema → detect existing code → interactive Clack prompts per model → build generation plan → emit files and register in router. Reuses existing `prisma-schema.ts`, `router-integration.ts`, and `snapshot.ts` utilities.

**Tech Stack:** Commander.js (command registration), @clack/prompts (interactive UI), Vitest (tests), existing VeloxTS CLI infrastructure.

---

## Task 1: Types Module

**Files:**
- Create: `packages/cli/src/sync/types.ts`

**Step 1: Write the types file**

This is the shared type foundation. No tests needed — types are validated by the compiler.

```typescript
/**
 * Sync Command Types
 *
 * Shared interfaces for the velox sync pipeline:
 * analyze → detect → prompt → plan → generate
 */

// ============================================================================
// Analyzer Output
// ============================================================================

/**
 * Rich metadata about a Prisma model, extended beyond PrismaModelInfo
 * with sync-specific classifications.
 */
export interface SyncModelInfo {
  /** Model name (PascalCase, e.g. "FriendRequest") */
  readonly name: string;
  /** All scalar (non-relation) fields */
  readonly fields: readonly SyncFieldInfo[];
  /** All relation fields with classification */
  readonly relations: readonly SyncRelationInfo[];
  /** True if model is a join table (all non-id fields are FKs + compound unique) */
  readonly isJoinTable: boolean;
  /** True if model has createdAt/updatedAt fields */
  readonly hasTimestamps: boolean;
  /** Compound unique constraints (e.g. [["userId", "postId"]]) */
  readonly uniqueConstraints: readonly (readonly string[])[];
}

/**
 * A scalar field parsed from the Prisma schema with sync-specific flags.
 */
export interface SyncFieldInfo {
  /** Field name (e.g. "email") */
  readonly name: string;
  /** Prisma type (e.g. "String", "Int", "DateTime") */
  readonly type: string;
  /** Has `?` modifier */
  readonly isOptional: boolean;
  /** Has `@id` annotation */
  readonly isId: boolean;
  /** Has `@unique` annotation */
  readonly isUnique: boolean;
  /** Has `@default(...)` or `@updatedAt` */
  readonly hasDefault: boolean;
  /** Raw default value string (e.g. "uuid()", "now()", "true") */
  readonly defaultValue: string | undefined;
  /** Auto-managed: id, createdAt, updatedAt, deletedAt */
  readonly isAutoManaged: boolean;
  /** Sensitive: password, secret, token, hash */
  readonly isSensitive: boolean;
  /** Points to User model via relation (authorId, userId, senderId, etc.) */
  readonly isUserForeignKey: boolean;
}

/**
 * A relation field with kind classification.
 */
export interface SyncRelationInfo {
  /** Relation field name (e.g. "author", "posts") */
  readonly name: string;
  /** Related model name (e.g. "User", "Post") */
  readonly relatedModel: string;
  /** Relation kind */
  readonly kind: 'belongsTo' | 'hasMany' | 'hasOne';
  /** Foreign key field name on this model (for belongsTo, e.g. "authorId") */
  readonly foreignKey: string | undefined;
}

// ============================================================================
// Detector Output
// ============================================================================

/**
 * Map of existing procedure/schema files in the project.
 */
export interface ExistingCodeMap {
  /** modelName → absolute file path */
  readonly procedures: ReadonlyMap<string, string>;
  /** modelName → absolute file path */
  readonly schemas: ReadonlyMap<string, string>;
}

// ============================================================================
// Prompter Output (User Choices)
// ============================================================================

/**
 * User's choices for a single model during the interactive prompt.
 */
export interface ModelChoices {
  /** Model name (PascalCase) */
  readonly model: string;
  /** What to do with this model */
  readonly action: 'generate' | 'regenerate' | 'skip';
  /** Output strategy for procedures */
  readonly outputStrategy: 'output' | 'resource';
  /** Which CRUD operations to generate */
  readonly crud: CrudChoices;
  /** Relation names to include in Zod schema */
  readonly schemaRelations: readonly string[];
  /** Relation names to include in Prisma queries (subset of schemaRelations) */
  readonly includeRelations: readonly string[];
  /** Per-field visibility (only when outputStrategy === 'resource') */
  readonly fieldVisibility: ReadonlyMap<string, 'public' | 'authenticated' | 'admin'> | undefined;
}

export interface CrudChoices {
  readonly get: boolean;
  readonly list: boolean;
  readonly create: boolean;
  readonly update: boolean;
  readonly delete: boolean;
}

// ============================================================================
// Planner Output (Generation Plan)
// ============================================================================

/**
 * Complete plan for what to generate, built from user choices.
 */
export interface SyncPlan {
  readonly schemas: readonly SchemaFilePlan[];
  readonly procedures: readonly ProcedureFilePlan[];
  readonly registrations: readonly RegistrationPlan[];
}

export interface SchemaFilePlan {
  readonly model: SyncModelInfo;
  /** Absolute output path (e.g. "/project/src/schemas/post.schema.ts") */
  readonly outputPath: string;
  readonly outputStrategy: 'output' | 'resource';
  /** Scalar fields to include (filtered: no auto-managed, no sensitive) */
  readonly fields: readonly SyncFieldInfo[];
  /** All scalar fields including auto-managed (for base schema) */
  readonly allFields: readonly SyncFieldInfo[];
  /** Relations to include in schema */
  readonly relations: readonly SyncRelationInfo[];
  /** Per-field visibility (only when outputStrategy === 'resource') */
  readonly fieldVisibility: ReadonlyMap<string, 'public' | 'authenticated' | 'admin'> | undefined;
  readonly action: 'create' | 'overwrite';
}

export interface ProcedureFilePlan {
  readonly model: SyncModelInfo;
  /** Absolute output path */
  readonly outputPath: string;
  /** Relative import path to schema file (e.g. "../schemas/post.schema.js") */
  readonly schemaImportPath: string;
  readonly outputStrategy: 'output' | 'resource';
  readonly crud: CrudChoices;
  /** Relations to fetch via Prisma includes */
  readonly includeRelations: readonly SyncRelationInfo[];
  readonly action: 'create' | 'overwrite';
}

export interface RegistrationPlan {
  /** Variable name (e.g. "postProcedures") */
  readonly procedureVarName: string;
  /** Entity name for router key (e.g. "posts") */
  readonly entityName: string;
  /** Import path relative to index.ts (e.g. "./procedures/posts.js") */
  readonly importPath: string;
}

// ============================================================================
// Generator Output
// ============================================================================

/**
 * Result of executing the sync plan.
 */
export interface SyncResult {
  readonly created: readonly string[];
  readonly overwritten: readonly string[];
  readonly skipped: readonly string[];
  readonly registered: readonly string[];
  readonly errors: readonly string[];
}

// ============================================================================
// Command Options
// ============================================================================

export interface SyncCommandOptions {
  readonly dryRun: boolean;
  readonly force: boolean;
  readonly skipRegistration: boolean;
}
```

**Step 2: Verify it compiles**

Run: `cd packages/cli && npx tsc --noEmit src/sync/types.ts`
Expected: No errors.

**Step 3: Commit**

```
git add packages/cli/src/sync/types.ts
git commit -m "feat(cli): add sync command type definitions"
```

---

## Task 2: Analyzer

**Files:**
- Create: `packages/cli/src/sync/__tests__/analyzer.test.ts`
- Create: `packages/cli/src/sync/analyzer.ts`

**Context:** The analyzer extends the existing `prisma-schema.ts` parser (`packages/cli/src/generators/utils/prisma-schema.ts`). It calls `analyzePrismaSchema()` then enriches the raw `PrismaModelInfo` into `SyncModelInfo[]` with:
- Relation kind classification (belongsTo vs hasMany vs hasOne)
- Join table detection
- Sensitive field detection (password, secret, token, hash)
- User FK detection (FK fields pointing to User model)
- Auto-managed field detection (id, createdAt, updatedAt, deletedAt)
- `@id`, `@unique`, `@default` value extraction
- `@@unique` compound constraint parsing

**Step 1: Write the failing tests**

Use the test pattern from `packages/cli/src/generators/__tests__/prisma-schema-relations.test.ts`:
- Write schema fixtures to temp dir with `writeFileSync`
- Clean up in `afterAll`

Test cases to cover:
1. **Basic model**: Parses scalar fields with correct types, optional, defaults
2. **Relation classification**: `author User @relation(...)` → belongsTo, `posts Post[]` → hasMany, `profile Profile` (no `[]`, no `@relation(fields:...)` on it) → hasOne
3. **Join table detection**: A model where all non-id, non-timestamp fields are foreign keys AND has a `@@unique` compound → `isJoinTable: true`
4. **Non-join table**: A model with at least one non-FK scalar field → `isJoinTable: false`
5. **Sensitive fields**: Fields named `password`, `secret`, `token`, `hash`, `passwordHash` → `isSensitive: true`
6. **User FK detection**: A field like `authorId String` where the model also has `author User @relation(fields: [authorId])` → `isUserForeignKey: true` (but only if the relation points to `User`)
7. **Auto-managed fields**: `id`, `createdAt`, `updatedAt`, `deletedAt` → `isAutoManaged: true`
8. **Unique constraints**: `@@unique([userId, postId])` parsed into `uniqueConstraints`
9. **Field annotations**: `@id`, `@unique` detected; `@default(uuid())` → `defaultValue: "uuid()"`
10. **Multi-model schema**: Parses all models from a schema with 3+ models

**Step 2: Run tests to verify they fail**

Run: `cd packages/cli && pnpm vitest run src/sync/__tests__/analyzer.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement analyzer.ts**

The analyzer function signature:

```typescript
import { analyzePrismaSchema, findPrismaSchema } from '../generators/utils/prisma-schema.js';
import type { SyncModelInfo } from './types.js';

/**
 * Analyze a Prisma schema and return enriched model metadata for sync.
 *
 * @param projectRoot - Project root directory (contains prisma/schema.prisma)
 * @returns Array of SyncModelInfo for each model in the schema
 * @throws If no Prisma schema found
 */
export function analyzeSchema(projectRoot: string): SyncModelInfo[]
```

Implementation notes:
- Call `findPrismaSchema(projectRoot)` then `analyzePrismaSchema(path)`
- For each model in `analysis.modelDetails`, build a `SyncModelInfo`
- **Relation classification**: Re-parse the raw schema content to find `@relation(fields: [...])` annotations. A field with `@relation(fields: [...])` is a **belongsTo** (the owning side). A field of type `Model[]` without `@relation(fields:...)` is **hasMany**. A field of type `Model` (no `[]`) without `@relation(fields:...)` is **hasOne**.
- **Important**: The existing `parseModelFields` in `prisma-schema.ts` SKIPS fields with `@relation(fields: [...])` (line 334-337). The analyzer needs to parse these differently — it needs the raw schema body per model to extract both the relation field AND its foreign key. Parse the model body directly rather than relying on the filtered `PrismaFieldInfo`.
- **Join table**: After classifying fields, check if every non-auto-managed scalar field is a foreign key for a belongsTo relation, AND the model has at least one `@@unique` compound constraint.
- **User FK**: For each belongsTo relation where `relatedModel === 'User'`, mark the `foreignKey` field as `isUserForeignKey: true`.
- **Sensitive**: Check field name against list: `password`, `passwordHash`, `secret`, `secretKey`, `token`, `hash`, `apiKey`.
- **`@@unique` parsing**: Regex `@@unique\(\[([^\]]+)\]\)` on the model body, split by `,`, trim.
- **`@default()` value**: Regex `@default\(([^)]+)\)` on the field line.
- **`@id`**: Check for `@id` in the field line.
- **`@unique`**: Check for `@unique` in the field line.

**Step 4: Run tests to verify they pass**

Run: `cd packages/cli && pnpm vitest run src/sync/__tests__/analyzer.test.ts`
Expected: All 10 test cases PASS.

**Step 5: Commit**

```
git add packages/cli/src/sync/analyzer.ts packages/cli/src/sync/__tests__/analyzer.test.ts
git commit -m "feat(cli): add sync analyzer for Prisma schema parsing"
```

---

## Task 3: Detector

**Files:**
- Create: `packages/cli/src/sync/__tests__/detector.test.ts`
- Create: `packages/cli/src/sync/detector.ts`

**Context:** Scans `src/procedures/` and `src/schemas/` to find existing files, maps filenames back to model names.

**Step 1: Write the failing tests**

Test cases:
1. **Finds procedure files**: Create `src/procedures/users.ts` → maps to `User`
2. **Finds schema files**: Create `src/schemas/post.schema.ts` → maps to `Post`
3. **Handles kebab-case**: `friend-requests.ts` → `FriendRequest`
4. **Handles plural filenames**: `users.ts` → `User` (singularizes)
5. **Empty project**: No `src/procedures/` dir → empty map
6. **Ignores non-matching files**: `index.ts`, `__tests__/` → not in map

Setup: Create temp project dirs with fixture files (empty content is fine — we're only matching filenames).

**Step 2: Run tests to verify they fail**

Run: `cd packages/cli && pnpm vitest run src/sync/__tests__/detector.test.ts`
Expected: FAIL.

**Step 3: Implement detector.ts**

```typescript
import type { ExistingCodeMap, SyncModelInfo } from './types.js';

/**
 * Detect existing procedure and schema files in the project.
 *
 * Maps filenames back to model names using naming conventions:
 * - src/procedures/users.ts → User
 * - src/schemas/post.schema.ts → Post
 * - src/procedures/friend-requests.ts → FriendRequest
 */
export function detectExisting(
  projectRoot: string,
  models: readonly SyncModelInfo[],
): ExistingCodeMap
```

Implementation notes:
- Glob `src/procedures/*.ts` (exclude `index.ts`, `__tests__/`)
- Glob `src/schemas/*.schema.ts`
- For each file, extract base name, convert from kebab/plural to PascalCase singular using `toPascalCase` and `singularize` from `packages/cli/src/generators/utils/naming.ts`
- Match against `models[].name`
- Return maps with model name as key, absolute path as value

**Step 4: Run tests to verify they pass**

Run: `cd packages/cli && pnpm vitest run src/sync/__tests__/detector.test.ts`
Expected: All PASS.

**Step 5: Commit**

```
git add packages/cli/src/sync/detector.ts packages/cli/src/sync/__tests__/detector.test.ts
git commit -m "feat(cli): add sync detector for existing code"
```

---

## Task 4: Planner

**Files:**
- Create: `packages/cli/src/sync/__tests__/planner.test.ts`
- Create: `packages/cli/src/sync/planner.ts`

**Context:** Converts `ModelChoices[]` into a concrete `SyncPlan` with file paths, import paths, and registration entries.

**Step 1: Write the failing tests**

Test cases:
1. **Skipped model produces no plans**: `action: 'skip'` → no schema, procedure, or registration plan
2. **Generate with `.output()` strategy**: Produces schema plan with `outputStrategy: 'output'`, procedure plan with matching strategy
3. **Generate with `.resource()` strategy**: Produces schema plan with `fieldVisibility` map, procedure plan with `outputStrategy: 'resource'`
4. **Correct file paths**: Schema at `<root>/src/schemas/<kebab>.schema.ts`, procedure at `<root>/src/procedures/<kebab-plural>.ts`
5. **Correct import path**: `schemaImportPath` is `../schemas/<kebab>.schema.js` (relative, `.js` extension)
6. **Registration plan**: `procedureVarName` is `<camel>Procedures` (e.g. `postProcedures`), `entityName` is plural kebab (e.g. `posts`), `importPath` is `./procedures/<plural>.js`
7. **Filtered fields**: `allFields` contains all non-relation fields, `fields` excludes auto-managed and sensitive
8. **Regenerate action**: Same as generate but `action: 'overwrite'` on plans
9. **Relations preserved**: Only selected relations appear in schema/procedure plans

Provide mock `SyncModelInfo` and `ModelChoices` as test inputs. Use a fake `projectRoot` like `/tmp/test-project`.

**Step 2: Run tests to verify they fail**

Run: `cd packages/cli && pnpm vitest run src/sync/__tests__/planner.test.ts`
Expected: FAIL.

**Step 3: Implement planner.ts**

```typescript
import type { ModelChoices, SyncModelInfo, SyncPlan } from './types.js';

/**
 * Build a generation plan from user choices.
 */
export function buildPlan(
  models: readonly SyncModelInfo[],
  choices: readonly ModelChoices[],
  projectRoot: string,
): SyncPlan
```

Implementation notes:
- Use `deriveEntityNames(model.name)` from `packages/cli/src/generators/utils/naming.ts` for all name conversions
- Schema path: `join(projectRoot, 'src/schemas', `${names.kebab}.schema.ts`)`
- Procedure path: `join(projectRoot, 'src/procedures', `${names.plural}.ts`)` (plural kebab, e.g. `posts.ts`, `friend-requests.ts`)
- Schema import from procedure: `../schemas/${names.kebab}.schema.js`
- Registration import: `./procedures/${names.plural}.js`
- Filter `fields` from `allFields` by excluding `isAutoManaged` and `isSensitive`
- Match `schemaRelations` and `includeRelations` strings against `model.relations` by name

**Step 4: Run tests to verify they pass**

Run: `cd packages/cli && pnpm vitest run src/sync/__tests__/planner.test.ts`
Expected: All PASS.

**Step 5: Commit**

```
git add packages/cli/src/sync/planner.ts packages/cli/src/sync/__tests__/planner.test.ts
git commit -m "feat(cli): add sync planner for generation planning"
```

---

## Task 5: Schema Generator

**Files:**
- Create: `packages/cli/src/sync/__tests__/schema-generator.test.ts`
- Create: `packages/cli/src/sync/schema-generator.ts`

**Context:** Takes a `SchemaFilePlan` and emits the full TypeScript source for a Zod schema file. This is the core Prisma-to-Zod mapping logic.

**Step 1: Write the failing tests**

Test cases (each asserts on the generated string content):

1. **Basic schema with `.output()`**: Generates `PostSchema` with `z.object({...})` containing all fields from `allFields`
2. **Prisma type mapping**: `String` → `z.string()`, `Int` → `z.number().int()`, `Float` → `z.number()`, `Boolean` → `z.boolean()`, `DateTime` → `z.date()`, `Json` → `z.record(z.string(), z.unknown())`
3. **UUID id field**: Field with `isId: true` and `defaultValue: 'uuid()'` → `z.string().uuid()`
4. **Email field heuristic**: Field named `email` with `isUnique: true` → `z.string().email()`
5. **Nullable fields**: `isOptional: true` → `.nullable()`
6. **CreateSchema excludes**: No `id`, no `createdAt`, no `updatedAt`, no `password`, no user FK fields
7. **CreateSchema foreign keys**: Non-user FKs like `postId` are included in CreateSchema
8. **UpdateSchema**: Same fields as Create but all `.optional()`
9. **ListSchema**: Has `page` and `perPage` with defaults
10. **WithRelationsSchema**: Extends base schema with nested relation objects
11. **Relation shapes**: BelongsTo → `z.object({ id, name })` (flattened), HasMany → `z.array(z.object({...}))`
12. **Resource schema**: `outputStrategy: 'resource'` → uses `resourceSchema()` builder with `.public()`, `.authenticated()`, `.admin()` per `fieldVisibility` map
13. **Resource imports**: When resource strategy, imports `resourceSchema` from `@veloxts/router`
14. **Output imports**: Always imports `z` from `zod`

**Step 2: Run tests to verify they fail**

Run: `cd packages/cli && pnpm vitest run src/sync/__tests__/schema-generator.test.ts`
Expected: FAIL.

**Step 3: Implement schema-generator.ts**

```typescript
import type { SchemaFilePlan } from './types.js';

/**
 * Generate the full TypeScript source for a Zod schema file.
 */
export function generateSchemaFile(plan: SchemaFilePlan): string
```

Implementation notes:
- Use the `FIELD_TYPES` mapping from `packages/cli/src/generators/fields/types.ts` for reference, but build the Prisma→Zod mapping directly for more control:
  - `String` → `z.string()` (add `.uuid()` if `isId && defaultValue === 'uuid()'`, add `.email()` if `name includes 'email' && isUnique`, add `.min(1).max(255)` otherwise for CreateSchema fields)
  - `Int` → `z.number().int()`
  - `Float` / `Decimal` / `BigInt` → `z.number()`
  - `Boolean` → `z.boolean()`
  - `DateTime` → `z.date()`
  - `Json` → `z.record(z.string(), z.unknown())`
- Base schema (`ModelSchema`): all fields from `plan.allFields` (non-relation, including auto-managed)
- `CreateSchema`: fields from `plan.fields` minus user FKs. Keep non-user FKs.
- `UpdateSchema`: same fields as Create, all wrapped in `.optional()`
- `ListSchema`: always `{ page: z.number().int().positive().optional().default(1), perPage: z.number().int().min(1).max(100).optional().default(20) }`
- `WithRelationsSchema` (only if `plan.relations.length > 0` and strategy is `output`): extends base schema with relation fields
  - BelongsTo: `z.object({ id: z.string().uuid(), name: z.string() })` (simplified — just id + first string field)
  - HasMany: `z.array(z.object({...}))` with all scalar fields of related model
  - **Note**: The plan doesn't carry related model field info. For the relation schema shapes, use a simplified approach: emit a `// TODO: customize relation shape` comment with a basic `z.object({ id: z.string() })` placeholder. The developer refines these.
- Resource strategy: import `resourceSchema` from `@veloxts/router`, use `.public()` / `.authenticated()` / `.admin()` based on `fieldVisibility`, end with `.build()`

**Step 4: Run tests to verify they pass**

Run: `cd packages/cli && pnpm vitest run src/sync/__tests__/schema-generator.test.ts`
Expected: All PASS.

**Step 5: Commit**

```
git add packages/cli/src/sync/schema-generator.ts packages/cli/src/sync/__tests__/schema-generator.test.ts
git commit -m "feat(cli): add sync schema generator with Prisma-to-Zod mapping"
```

---

## Task 6: Procedure Generator

**Files:**
- Create: `packages/cli/src/sync/__tests__/procedure-generator.test.ts`
- Create: `packages/cli/src/sync/procedure-generator.ts`

**Context:** Takes a `ProcedureFilePlan` and emits the full TypeScript source for a procedures file.

**Step 1: Write the failing tests**

Test cases:
1. **Full CRUD with `.output()`**: Generates `getPost`, `listPosts`, `createPost`, `updatePost`, `deletePost` with correct naming
2. **Partial CRUD**: Only `get` + `list` checked → only those procedures generated
3. **Procedure naming**: Uses model name correctly — `getPost`, `listPosts` (singular/plural)
4. **Get procedure**: `.input(z.object({ id: z.string().uuid() }))` + `.output(Schema)` + `.query()` + `findUniqueOrThrow`
5. **List procedure**: `.input(ListSchema)` + `.query()` + `findMany` with pagination + `count()`
6. **Create procedure**: `.input(CreateSchema)` + `.mutation()` + `ctx.db.model.create()` with `ctx.user.id` for user FK
7. **Update procedure**: `.input(z.object({ id }).merge(UpdateSchema))` + `.mutation()` + destructures `id`
8. **Delete procedure**: `.input(z.object({ id }))` + `.mutation()` + returns `{ success: true }`
9. **Prisma includes**: When `includeRelations` has entries, `get` and `list` add `include: { author: true, comments: true }` etc.
10. **Resource strategy**: `get` wraps with `resource(result, ModelSchema.public)`, `list` wraps with `resourceCollection(items, ModelSchema.public)`, imports `resource`/`resourceCollection` from `@veloxts/router`
11. **Join table procedures**: Only `create` + `delete`, delete uses compound unique key from `model.uniqueConstraints`
12. **Imports**: Correct import from schema file, from `@veloxts/router`, from `zod`

**Step 2: Run tests to verify they fail**

Run: `cd packages/cli && pnpm vitest run src/sync/__tests__/procedure-generator.test.ts`
Expected: FAIL.

**Step 3: Implement procedure-generator.ts**

```typescript
import type { ProcedureFilePlan } from './types.js';

/**
 * Generate the full TypeScript source for a procedures file.
 */
export function generateProcedureFile(plan: ProcedureFilePlan): string
```

Implementation notes:
- Use `deriveEntityNames(plan.model.name)` for naming
- Collection name: `${names.camel}Procedures` (e.g. `postProcedures`)
- Procedure names: `get${names.pascal}`, `list${names.pascalPlural}`, `create${names.pascal}`, `update${names.pascal}`, `delete${names.pascal}`
- Prisma model accessor: `ctx.db.${names.camel}` (e.g. `ctx.db.post`)
- Imports from schema file: `${names.pascal}Schema` (or `${names.pascal}WithRelationsSchema`), `Create${names.pascal}Schema`, `Update${names.pascal}Schema`, `List${names.pascalPlural}Schema`
- For `.output()` with relations: use `WithRelationsSchema` on `get` and `list`
- For `.output()` without relations: use `${names.pascal}Schema`
- For `.resource()`: no `.output()` on chain, wrap return with `resource()`
- User FK in create: find field where `isUserForeignKey === true`, use its name (e.g. `authorId: ctx.user.id`)
- Join table delete: use `@@unique` constraint fields to build compound where clause, e.g. `where: { userId_postId: { userId: ctx.user.id, postId: input.postId } }`

**Step 4: Run tests to verify they pass**

Run: `cd packages/cli && pnpm vitest run src/sync/__tests__/procedure-generator.test.ts`
Expected: All PASS.

**Step 5: Commit**

```
git add packages/cli/src/sync/procedure-generator.ts packages/cli/src/sync/__tests__/procedure-generator.test.ts
git commit -m "feat(cli): add sync procedure generator with CRUD patterns"
```

---

## Task 7: Prompter

**Files:**
- Create: `packages/cli/src/sync/prompter.ts`

**Context:** Drives the Clack interactive flow per model. No unit tests — this is pure UI interaction code that would require mocking `@clack/prompts` extensively. Validated via manual testing and the integration test.

**Step 1: Implement prompter.ts**

```typescript
import type { ExistingCodeMap, ModelChoices, SyncModelInfo } from './types.js';

/**
 * Run interactive prompts for a single model.
 * Returns null if user cancels (Ctrl+C).
 */
export async function promptForModel(
  model: SyncModelInfo,
  existing: ExistingCodeMap,
): Promise<ModelChoices | null>

/**
 * Run the full interactive flow for all models.
 * Returns null if user cancels at any point.
 */
export async function promptAllModels(
  models: readonly SyncModelInfo[],
  existing: ExistingCodeMap,
): Promise<readonly ModelChoices[] | null>
```

Implementation notes:
- Use `import * as p from '@clack/prompts'` (consistent with all other CLI files)
- Use `import pc from 'picocolors'` for coloring
- **Model header**: `p.log.info()` with model name, field count, relation count
- **Existing code detected**: If model is in `existing.procedures`, show path and offer `skip`/`regenerate`/`add-missing`
- **No existing code**: Ask `generate` or `skip`
- **Output strategy**: `p.select()` with `.output()` and `.resource()` options. Default to `.resource()` if model has sensitive fields or model name is `User`/`Message`.
- **CRUD operations**: `p.multiselect()` with all 5 ops. Default: all checked for regular models, only create+delete for join tables.
- **Schema relations**: `p.multiselect()` listing all `model.relations` by name+kind. Default: belongsTo checked, hasMany unchecked.
- **Include relations**: `p.multiselect()` listing only the schema-selected relations. Default: all checked.
- **Field visibility** (only if resource): For each non-auto-managed field, show a table and let user assign visibility. Use `p.select()` per field, or a single `p.multiselect()` grouped approach. Start simple: default all to `public`, then ask "Any fields to restrict?" with a multi-select to pick fields, then for each picked field ask `authenticated` or `admin`.
- **Cancel handling**: Check `p.isCancel()` after each prompt, return `null` if cancelled.

**Step 2: Verify it compiles**

Run: `cd packages/cli && npx tsc --noEmit src/sync/prompter.ts`
Expected: No errors.

**Step 3: Commit**

```
git add packages/cli/src/sync/prompter.ts
git commit -m "feat(cli): add sync interactive prompter with Clack UI"
```

---

## Task 8: Orchestrator + Command Registration

**Files:**
- Create: `packages/cli/src/sync/index.ts`
- Create: `packages/cli/src/commands/sync.ts`
- Modify: `packages/cli/src/cli.ts` (add `createSyncCommand` import + registration)

**Step 1: Implement sync/index.ts (orchestrator)**

```typescript
import type { SyncCommandOptions, SyncResult } from './types.js';

/**
 * Execute the full sync pipeline:
 * 1. Analyze Prisma schema
 * 2. Detect existing code
 * 3. Prompt user for choices
 * 4. Build generation plan
 * 5. Generate files + register in router
 */
export async function executeSync(
  projectRoot: string,
  options: SyncCommandOptions,
): Promise<SyncResult>
```

Implementation notes:
- Call `analyzeSchema(projectRoot)` → `SyncModelInfo[]`
- Call `detectExisting(projectRoot, models)` → `ExistingCodeMap`
- Show discovery phase with `p.intro()`, model count, existing code summary
- Call `promptAllModels(models, existing)` → `ModelChoices[]` (or exit if cancelled)
- Call `buildPlan(models, choices, projectRoot)` → `SyncPlan`
- Show summary phase: list files to create/overwrite/skip, ask confirm
- If `dryRun`: show plan and exit
- Use `executeWithRollback` from `packages/cli/src/generators/utils/snapshot.ts`
- For each schema plan: call `generateSchemaFile(plan)`, write with `writeFileSync`
- For each procedure plan: call `generateProcedureFile(plan)`, write with `writeFileSync`
- For each registration plan: call `registerProcedures()` from `packages/cli/src/generators/utils/router-integration.ts`
- Show result phase with `p.outro()`

**Step 2: Implement commands/sync.ts**

```typescript
import { Command } from 'commander';

export function createSyncCommand(): Command
```

Implementation notes:
- Command name: `sync`
- Options: `--dry-run`, `--force`, `--skip-registration`
- Action: resolve `projectRoot` from cwd, call `executeSync()`
- Use `ensureVeloxProject()` from generators (or just check for `prisma/schema.prisma`)
- Error handling: catch and display with `p.log.error()`

**Step 3: Register in cli.ts**

Add to `packages/cli/src/cli.ts`:
- Import: `import { createSyncCommand } from './commands/sync.js';`
- Register: `program.addCommand(createSyncCommand());` (after the make command)

**Step 4: Verify it compiles**

Run: `cd packages/cli && pnpm type-check`
Expected: No errors.

**Step 5: Commit**

```
git add packages/cli/src/sync/index.ts packages/cli/src/commands/sync.ts packages/cli/src/cli.ts
git commit -m "feat(cli): add velox sync command with full pipeline orchestration"
```

---

## Task 9: Integration Test

**Files:**
- Create: `packages/cli/src/sync/__tests__/sync.integration.test.ts`

**Context:** End-to-end test of the sync pipeline using a temp directory with a real Prisma schema. Bypasses interactive prompts by calling the internal functions directly with pre-built choices.

**Step 1: Write the integration test**

Setup:
- Create temp dir with:
  - `prisma/schema.prisma` containing User + Post + Comment + Like models (similar to user's playground)
  - `src/index.ts` with a minimal `const collections = [];` array-based router pattern
  - `src/procedures/users.ts` with dummy content (simulates existing code)

Test scenario:
1. Call `analyzeSchema(tempDir)` → verify 4 models found
2. Call `detectExisting(tempDir, models)` → verify User found in procedures
3. Build mock `ModelChoices[]`:
   - User: skip
   - Post: generate, `.output()`, full CRUD, relations: author + comments, includes: author
   - Comment: generate, `.output()`, full CRUD, no relations
   - Like: skip
4. Call `buildPlan(models, choices, tempDir)` → verify 2 schema plans, 2 procedure plans, 2 registrations
5. Execute generation manually (call `generateSchemaFile` + `generateProcedureFile` + write files)
6. Assert file exists: `src/schemas/post.schema.ts`
7. Assert file exists: `src/schemas/comment.schema.ts`
8. Assert file exists: `src/procedures/posts.ts`
9. Assert file exists: `src/procedures/comments.ts`
10. Assert `src/procedures/users.ts` unchanged (skip action)
11. Assert generated schema file contains expected patterns: `z.object`, `CreatePostSchema`, `UpdatePostSchema`
12. Assert generated procedure file contains: `postProcedures`, `getPost`, `listPosts`, `createPost`
13. Register in router: call `registerProcedures()` for each, assert `src/index.ts` now contains imports

Cleanup: `rmSync(tempDir, { recursive: true, force: true })`

**Step 2: Run integration test**

Run: `cd packages/cli && pnpm vitest run src/sync/__tests__/sync.integration.test.ts`
Expected: All PASS.

**Step 3: Commit**

```
git add packages/cli/src/sync/__tests__/sync.integration.test.ts
git commit -m "test(cli): add sync command integration test"
```

---

## Task 10: Full Build + Type Check + Lint

**Files:**
- None (validation only)

**Step 1: Run full type check**

Run: `cd packages/cli && pnpm type-check`
Expected: No errors.

**Step 2: Run lint**

Run: `pnpm lint`
Expected: No warnings or errors. Fix any Biome formatting issues.

**Step 3: Run all CLI tests**

Run: `cd packages/cli && pnpm test`
Expected: All tests pass, including new sync tests.

**Step 4: Build the full monorepo**

Run: `pnpm build`
Expected: Clean build, no errors.

**Step 5: Commit any lint/formatting fixes**

```
git add -A
git commit -m "chore(cli): lint and formatting fixes for sync command"
```

---

## Task 11: Manual Testing

**Files:**
- None (validation only)

**Step 1: Test against the playground schema**

Use the user's playground project or create a temp project:

```bash
cd /tmp
npx create-velox-app sync-test --auth
cd sync-test/apps/api
```

Add a few models to `prisma/schema.prisma` (Post, Comment, Like), then:

```bash
velox sync
```

Walk through the interactive prompts, verify:
- All models discovered
- User model shows as "existing"
- Post/Comment/Like prompts work correctly
- Generated files compile (`pnpm build`)
- Server starts (`velox dev`)
- REST endpoints respond (`curl http://localhost:3030/api/posts`)

**Step 2: Test edge cases**

- Run `velox sync --dry-run` → no files written
- Run `velox sync` in a project with no Prisma schema → clear error message
- Run `velox sync` and cancel mid-prompt → clean exit
- Run `velox sync` with all models skipped → "Nothing to generate" message

**Step 3: Final commit with any fixes**

```
git add -A
git commit -m "feat(cli): velox sync command complete"
```

---

## Summary

| Task | What | Files | Estimated Steps |
|------|------|-------|-----------------|
| 1 | Types module | 1 new | 3 |
| 2 | Analyzer (Prisma→SyncModelInfo) | 2 new | 5 |
| 3 | Detector (existing code scan) | 2 new | 5 |
| 4 | Planner (choices→file plan) | 2 new | 5 |
| 5 | Schema generator (plan→Zod source) | 2 new | 5 |
| 6 | Procedure generator (plan→CRUD source) | 2 new | 5 |
| 7 | Prompter (Clack interactive UI) | 1 new | 3 |
| 8 | Orchestrator + command registration | 3 new, 1 modify | 5 |
| 9 | Integration test | 1 new | 3 |
| 10 | Build/lint/test validation | 0 | 5 |
| 11 | Manual testing | 0 | 3 |
| **Total** | | **16 new, 1 modify** | **47 steps** |

Dependency order: Task 1 first (types), then 2-6 can be parallelized, 7 depends on types, 8 depends on all, 9-11 sequential at end.
