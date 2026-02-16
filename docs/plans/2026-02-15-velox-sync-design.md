# velox sync — Prisma-to-Procedures Sync Command

**Date:** 2026-02-15
**Status:** Approved

## Overview

`velox sync` reads the Prisma schema and interactively generates complete Zod validation schemas + CRUD procedure files for all models in one shot. Replaces the per-entity `velox make namespace` workflow with a whole-schema sync that produces production-ready code.

## Command Interface

```bash
velox sync                    # Interactive sync from Prisma schema
velox sync --dry-run          # Preview without writing files
velox sync --force            # Overwrite all without asking
velox sync --skip-registration # Don't auto-register in router
```

### 4-Phase Interactive Flow

**Phase 1 — Discovery:** Parse `prisma/schema.prisma`, list all models, detect existing procedures/schemas.

**Phase 2 — Per-Model Prompt:** For each model, ask:
- **Action:** Generate / Regenerate / Skip (regenerate only shown if existing code detected)
- **Output strategy:** `.output()` (simple Zod schema) or `.resource()` (field visibility per access level)
- **CRUD operations:** Checkboxes for get, list, create, update, delete
- **Schema relations:** Which relations to include in Zod schemas
- **Query relations:** Which relations to fetch via Prisma includes
- **Field visibility:** (only if `.resource()`) Per-field public/authenticated/admin assignment

**Phase 3 — Summary & Confirm:** Show all files to be created/overwritten/skipped, ask for confirmation.

**Phase 4 — Generation:** Write files with progress, auto-register in router.

### Smart Defaults

- Join tables (Like, Friendship): only `create` + `delete` checked
- Models with sensitive fields (User, Message): default to `.resource()`
- BelongsTo relations: checked by default in schema
- HasMany relations: unchecked by default
- Field visibility: all `public` unless sensitive field -> `admin`
- `id`, `createdAt`, `updatedAt` auto-excluded from Create/Update inputs
- User foreign keys (`authorId`, `senderId`) auto-excluded from Create inputs (set from `ctx.user`)
- `password` fields always excluded from all schemas

## Generated Code Structure

### Zod Schema File (`src/schemas/<model>.schema.ts`)

**With `.output()` strategy:**
- `ModelSchema` — base schema mirroring Prisma model (all scalar fields)
- `ModelWithRelationsSchema` — extends base with selected relation schemas (flattened)
- `CreateModelSchema` — omits id, timestamps, user FKs, sensitive fields
- `UpdateModelSchema` — same as Create but all `.optional()`
- `ListModelsSchema` — page/perPage with defaults

**With `.resource()` strategy:**
- `ModelSchema` — uses `resourceSchema()` builder with per-field visibility levels, calls `.build()`
- `CreateModelSchema`, `UpdateModelSchema`, `ListModelsSchema` — same as `.output()` variant

### Procedure File (`src/procedures/<models>.ts`)

**With `.output()` strategy:**
- `getModel` — `.input()` + `.output(WithRelationsSchema)` + `.query()` with Prisma includes
- `listModels` — pagination + includes + count
- `createModel` — spreads input + sets user FK from `ctx.user.id`
- `updateModel` — destructures id from input
- `deleteModel` — returns `{ success: true }`

**With `.resource()` strategy:**
- Same structure but `get`/`list` wrap returns with `resource()` / `resourceCollection()` and tagged views
- No `.output()` on the procedure chain

**Join table procedures:**
- Reduced to `create` + `delete` only
- Delete uses compound unique key (e.g., `userId_postId`)

### Prisma-to-Zod Type Mapping

| Prisma Type | Zod Schema | Notes |
|---|---|---|
| `String` | `z.string()` | `.uuid()` if `@id @default(uuid())` |
| `String` with `@unique` | `z.string().email()` | Only if field name contains "email" |
| `Int` | `z.number().int()` | |
| `Float` | `z.number()` | |
| `Boolean` | `z.boolean()` | |
| `DateTime` | `z.date()` | |
| `Json` | `z.record(z.string(), z.unknown())` | |
| `String?` | `z.string().nullable()` | Prisma optional -> nullable |
| `@default(...)` | `.default(value)` | On Create schema only |

## Architecture

### File Structure

```
packages/cli/src/
├── commands/
│   ├── make.ts              # Existing
│   └── sync.ts              # NEW: command registration
├── sync/                    # NEW: sync command internals
│   ├── index.ts             # orchestrator — runs the pipeline
│   ├── analyzer.ts          # Prisma schema -> SyncModelInfo[]
│   ├── detector.ts          # detects existing procedures/schemas
│   ├── prompter.ts          # Clack interactive prompts per model
│   ├── planner.ts           # user choices -> SyncPlan
│   ├── generator.ts         # SyncPlan -> file contents
│   └── types.ts             # shared interfaces
```

### Pipeline

```
Analyze -> Detect -> Prompt -> Plan -> Generate
```

1. **Analyze** (`analyzer.ts`): Parse Prisma schema into rich `SyncModelInfo[]` with field metadata, relation classification (belongsTo/hasMany/hasOne), join table detection, sensitive field detection, user FK detection.

2. **Detect** (`detector.ts`): Scan `src/procedures/` and `src/schemas/` to find existing code, map filenames to model names.

3. **Prompt** (`prompter.ts`): Drive Clack interactive flow per model, return `ModelChoices[]`.

4. **Plan** (`planner.ts`): Convert choices into `SyncPlan` with concrete file paths, imports, and generation parameters.

5. **Generate** (`generator.ts`): Emit schema + procedure file contents, write to disk, register in router.

### Key Types

```typescript
interface SyncModelInfo {
  name: string;
  fields: SyncFieldInfo[];
  relations: SyncRelationInfo[];
  isJoinTable: boolean;
  hasTimestamps: boolean;
  uniqueConstraints: string[][];
}

interface SyncFieldInfo {
  name: string;
  type: string;
  isOptional: boolean;
  isId: boolean;
  isUnique: boolean;
  hasDefault: boolean;
  defaultValue?: string;
  isAutoManaged: boolean;
  isSensitive: boolean;
  isUserForeignKey: boolean;
}

interface SyncRelationInfo {
  name: string;
  relatedModel: string;
  kind: 'belongsTo' | 'hasMany' | 'hasOne';
  foreignKey?: string;
}

interface ModelChoices {
  model: string;
  action: 'generate' | 'regenerate' | 'skip';
  outputStrategy: 'output' | 'resource';
  crud: { get: boolean; list: boolean; create: boolean; update: boolean; delete: boolean };
  schemaRelations: string[];
  includeRelations: string[];
  fieldVisibility?: Map<string, 'public' | 'authenticated' | 'admin'>;
}

interface SyncPlan {
  schemas: SchemaFilePlan[];
  procedures: ProcedureFilePlan[];
  registrations: RegistrationPlan[];
}
```

### Reuse vs New

| Component | Status |
|---|---|
| `prisma-schema.ts` (parser) | **Extend** — add relation classification, join table/sensitive/user FK detection |
| `router-integration.ts` | **Reuse as-is** |
| `snapshot.ts` | **Reuse as-is** |
| `filesystem.ts` | **Reuse as-is** |
| `ast-helpers.ts` | **Reuse as-is** |
| `sync/*` (all 6 files) | **New** |
| `commands/sync.ts` | **New** |

### Error Handling

- No Prisma schema found -> clear error with `npx prisma init` suggestion
- Empty schema (no models) -> informative message
- User cancels mid-prompt -> clean exit, no files written
- File write failure -> snapshot rollback
- Router registration failure -> files still written, manual instructions shown

## Testing Strategy

### Unit Tests

- **analyzer.test.ts**: Field parsing, relation classification, join table detection, sensitive/user FK detection, edge cases
- **detector.test.ts**: Filename-to-model mapping, kebab-case handling, empty project
- **planner.test.ts**: Skip/generate/regenerate plan correctness, output vs resource strategy, join table reduced CRUD
- **generator.test.ts**: Prisma-to-Zod type mapping, Create/Update schema field filtering, relation schema shapes, `.output()` vs `.resource()` code emission, procedure CRUD naming conventions, Prisma includes for selected relations

### Integration Test

- **sync.integration.test.ts**: Full pipeline on temp filesystem with fixture Prisma schema, pre-built choices (bypassing prompts), asserts correct files at correct paths, existing code preserved when skipped, router updated, generated files are valid TypeScript.

### Smoke Test (Future)

Optional `pnpm smoke-test --sync` that scaffolds a project, adds models, runs sync non-interactively, builds, starts server, and hits generated endpoints. Not required for initial implementation.
