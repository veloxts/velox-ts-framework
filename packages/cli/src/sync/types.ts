/**
 * Sync Command Types
 *
 * Shared type definitions for the `velox sync` pipeline.
 * The sync command reads a Prisma schema and generates Zod schemas +
 * CRUD procedures for all models through a 5-stage pipeline:
 * analyze -> detect -> prompt -> plan -> generate.
 */

// ============================================================================
// Analyzer Output Types
// ============================================================================

/**
 * Rich metadata about a Prisma model, produced by the analyzer stage.
 *
 * Contains all information needed by downstream stages to generate
 * schemas and procedures for this model.
 */
export interface SyncModelInfo {
  /** PascalCase model name (e.g., "User", "BlogPost") */
  readonly name: string;

  /** All scalar fields on the model */
  readonly fields: readonly SyncFieldInfo[];

  /** All relation fields with classification */
  readonly relations: readonly SyncRelationInfo[];

  /** True if the model is a many-to-many join table */
  readonly isJoinTable: boolean;

  /** Whether the model has createdAt/updatedAt timestamp fields */
  readonly hasTimestamps: boolean;

  /** Compound unique constraints (each constraint is a list of field names) */
  readonly uniqueConstraints: readonly (readonly string[])[];
}

/**
 * A scalar field with sync-specific flags.
 *
 * Flags like `isAutoManaged` and `isSensitive` drive which fields
 * are included in create/update schemas and which are omitted or
 * redacted in output schemas.
 */
export interface SyncFieldInfo {
  /** Field name as declared in the Prisma schema */
  readonly name: string;

  /** Prisma type (e.g., "String", "Int", "DateTime", "Boolean") */
  readonly type: string;

  /** Whether the field is optional in Prisma (marked with ?) */
  readonly isOptional: boolean;

  /** Whether this field is the primary key (@id) */
  readonly isId: boolean;

  /** Whether this field has a @unique constraint */
  readonly isUnique: boolean;

  /** Whether the field has a @default value */
  readonly hasDefault: boolean;

  /** String representation of the default value, if any */
  readonly defaultValue: string | undefined;

  /** True for auto-managed fields: id, createdAt, updatedAt, deletedAt */
  readonly isAutoManaged: boolean;

  /** True for sensitive fields: password, secret, token, hash */
  readonly isSensitive: boolean;

  /** True if this field is a foreign key pointing to the User model */
  readonly isUserForeignKey: boolean;
}

/**
 * A relation field with its classified kind.
 *
 * The kind determines how the relation is represented in generated
 * procedures (e.g., belongsTo includes the foreign key, hasMany
 * supports nested includes).
 */
export interface SyncRelationInfo {
  /** Relation field name as declared in the Prisma schema */
  readonly name: string;

  /** PascalCase name of the related model */
  readonly relatedModel: string;

  /** Relation kind: belongsTo (FK on this model), hasMany, or hasOne */
  readonly kind: 'belongsTo' | 'hasMany' | 'hasOne';

  /** Foreign key field name on this model (only for belongsTo) */
  readonly foreignKey: string | undefined;
}

// ============================================================================
// Detector Output Types
// ============================================================================

/**
 * Map of existing generated files discovered by the detector stage.
 *
 * Used by the prompter to determine whether a model needs generation,
 * regeneration, or can be skipped.
 */
export interface ExistingCodeMap {
  /** Map of modelName -> absolute file path for existing procedure files */
  readonly procedures: ReadonlyMap<string, string>;

  /** Map of modelName -> absolute file path for existing schema files */
  readonly schemas: ReadonlyMap<string, string>;
}

// ============================================================================
// Prompter Output Types
// ============================================================================

/**
 * CRUD operation choices for a single model.
 *
 * Each boolean indicates whether the corresponding procedure
 * should be generated.
 */
export interface CrudChoices {
  /** Generate a get-by-id query */
  readonly get: boolean;

  /** Generate a list-all query */
  readonly list: boolean;

  /** Generate a create mutation */
  readonly create: boolean;

  /** Generate an update mutation */
  readonly update: boolean;

  /** Generate a delete mutation */
  readonly delete: boolean;
}

/**
 * User's choices for a single model, collected by the prompter stage.
 *
 * Drives what the planner produces for this model.
 */
export interface ModelChoices {
  /** PascalCase model name */
  readonly model: string;

  /** What to do with this model's files */
  readonly action: 'generate' | 'regenerate' | 'skip';

  /** Output strategy: plain .output() or resource schema with visibility tiers */
  readonly outputStrategy: 'output' | 'resource';

  /** Which CRUD operations to generate */
  readonly crud: CrudChoices;

  /** Relation names to include in the Zod schema (nested object shapes) */
  readonly schemaRelations: readonly string[];

  /** Relation names to include via Prisma `include` in procedure queries */
  readonly includeRelations: readonly string[];

  /** Per-field visibility tiers (only when outputStrategy is 'resource') */
  readonly fieldVisibility: ReadonlyMap<string, 'public' | 'authenticated' | 'admin'> | undefined;
}

// ============================================================================
// Planner Output Types
// ============================================================================

/**
 * Complete generation plan produced by the planner stage.
 *
 * Contains all files to create/overwrite and registrations to add.
 * The generator stage consumes this plan without further decision-making.
 */
export interface SyncPlan {
  /** Schema files to generate */
  readonly schemas: readonly SchemaFilePlan[];

  /** Procedure files to generate */
  readonly procedures: readonly ProcedureFilePlan[];

  /** Router registration entries to add */
  readonly registrations: readonly RegistrationPlan[];
}

/**
 * Plan for generating a single Zod schema file.
 */
export interface SchemaFilePlan {
  /** Model metadata from the analyzer */
  readonly model: SyncModelInfo;

  /** Absolute path where the schema file will be written */
  readonly outputPath: string;

  /** Whether to use plain output or resource schema with visibility tiers */
  readonly outputStrategy: 'output' | 'resource';

  /** Fields to include in create/update input schemas */
  readonly fields: readonly SyncFieldInfo[];

  /** All fields on the model (for output/resource schema generation) */
  readonly allFields: readonly SyncFieldInfo[];

  /** Relations to include as nested shapes in the schema */
  readonly relations: readonly SyncRelationInfo[];

  /** Per-field visibility tiers (only when outputStrategy is 'resource') */
  readonly fieldVisibility: ReadonlyMap<string, 'public' | 'authenticated' | 'admin'> | undefined;

  /** Whether this is a new file or an overwrite of an existing file */
  readonly action: 'create' | 'overwrite';
}

/**
 * Plan for generating a single procedure file.
 */
export interface ProcedureFilePlan {
  /** Model metadata from the analyzer */
  readonly model: SyncModelInfo;

  /** Absolute path where the procedure file will be written */
  readonly outputPath: string;

  /** Relative import path from the procedure file to the schema file */
  readonly schemaImportPath: string;

  /** Whether to use plain output or resource schema with visibility tiers */
  readonly outputStrategy: 'output' | 'resource';

  /** Which CRUD operations to generate */
  readonly crud: CrudChoices;

  /** Relation names to include via Prisma `include` in queries */
  readonly includeRelations: readonly string[];

  /** Whether this is a new file or an overwrite of an existing file */
  readonly action: 'create' | 'overwrite';
}

/**
 * Plan for registering a procedure collection in the router.
 */
export interface RegistrationPlan {
  /** Variable name for the procedure collection (e.g., "userProcedures") */
  readonly procedureVarName: string;

  /** Entity name used for route prefix (e.g., "users") */
  readonly entityName: string;

  /** Import path for the procedure file (e.g., "./procedures/users.js") */
  readonly importPath: string;
}

// ============================================================================
// Generator Output Types
// ============================================================================

/**
 * Result summary from the generator stage.
 *
 * Tracks which files were created, overwritten, skipped, or errored
 * for display in the CLI output.
 */
export interface SyncResult {
  /** Files that were newly created */
  readonly created: readonly string[];

  /** Files that were overwritten */
  readonly overwritten: readonly string[];

  /** Files that were skipped (user chose to skip or already up-to-date) */
  readonly skipped: readonly string[];

  /** Procedure collections that were registered in the router */
  readonly registered: readonly string[];

  /** Error messages for files that failed to generate */
  readonly errors: readonly string[];
}

// ============================================================================
// Command Options
// ============================================================================

/**
 * CLI options for the `velox sync` command.
 */
export interface SyncCommandOptions {
  /** Preview changes without writing any files */
  readonly dryRun: boolean;

  /** Skip confirmation prompts and overwrite existing files */
  readonly force: boolean;

  /** Skip automatic router registration of generated procedures */
  readonly skipRegistration: boolean;
}
