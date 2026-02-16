/**
 * Sync Planner - Unit Tests
 *
 * Tests for the `buildPlan()` function that transforms user choices
 * into a concrete generation plan for the generator stage.
 */

import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ModelChoices, SyncFieldInfo, SyncModelInfo, SyncRelationInfo } from '../types.js';
import { buildPlan } from '../planner.js';

// ============================================================================
// Test Helpers
// ============================================================================

const PROJECT_ROOT = '/tmp/test-planner';

/** Create a minimal SyncFieldInfo */
function field(overrides: Partial<SyncFieldInfo> & { name: string; type: string }): SyncFieldInfo {
  return {
    isOptional: false,
    isId: false,
    isUnique: false,
    hasDefault: false,
    defaultValue: undefined,
    isAutoManaged: false,
    isSensitive: false,
    isUserForeignKey: false,
    ...overrides,
  };
}

/** Create a minimal SyncRelationInfo */
function relation(
  name: string,
  relatedModel: string,
  kind: SyncRelationInfo['kind'],
  foreignKey?: string,
): SyncRelationInfo {
  return { name, relatedModel, kind, foreignKey };
}

/** A Post model with common fields and relations */
const postModel: SyncModelInfo = {
  name: 'Post',
  fields: [
    field({ name: 'id', type: 'String', isId: true, isAutoManaged: true, hasDefault: true, defaultValue: 'uuid()' }),
    field({ name: 'title', type: 'String' }),
    field({ name: 'content', type: 'String' }),
    field({ name: 'authorId', type: 'String', isUserForeignKey: true }),
    field({ name: 'createdAt', type: 'DateTime', isAutoManaged: true, hasDefault: true, defaultValue: 'now()' }),
    field({ name: 'updatedAt', type: 'DateTime', isAutoManaged: true }),
    field({ name: 'password', type: 'String', isSensitive: true }),
  ],
  relations: [
    relation('author', 'User', 'belongsTo', 'authorId'),
    relation('comments', 'Comment', 'hasMany'),
    relation('tags', 'Tag', 'hasMany'),
    relation('category', 'Category', 'belongsTo', 'categoryId'),
  ],
  isJoinTable: false,
  hasTimestamps: true,
  uniqueConstraints: [],
};

/** A FriendRequest model for multi-word name testing */
const friendRequestModel: SyncModelInfo = {
  name: 'FriendRequest',
  fields: [
    field({ name: 'id', type: 'String', isId: true, isAutoManaged: true, hasDefault: true }),
    field({ name: 'status', type: 'String' }),
    field({ name: 'senderId', type: 'String', isUserForeignKey: true }),
    field({ name: 'receiverId', type: 'String', isUserForeignKey: true }),
  ],
  relations: [
    relation('sender', 'User', 'belongsTo', 'senderId'),
    relation('receiver', 'User', 'belongsTo', 'receiverId'),
  ],
  isJoinTable: false,
  hasTimestamps: false,
  uniqueConstraints: [],
};

/** Default CRUD choices (all enabled) */
const allCrud: ModelChoices['crud'] = {
  get: true,
  list: true,
  create: true,
  update: true,
  delete: true,
};

// ============================================================================
// Tests
// ============================================================================

describe('buildPlan', () => {
  // --------------------------------------------------------------------------
  // 1. Skipped model produces no plans
  // --------------------------------------------------------------------------
  it('produces no plans for skipped models', () => {
    const choices: ModelChoices[] = [
      {
        model: 'Post',
        action: 'skip',
        outputStrategy: 'output',
        crud: allCrud,
        schemaRelations: [],
        includeRelations: [],
        fieldVisibility: undefined,
      },
    ];

    const plan = buildPlan([postModel], choices, PROJECT_ROOT);

    expect(plan.schemas).toHaveLength(0);
    expect(plan.procedures).toHaveLength(0);
    expect(plan.registrations).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // 2. Generate with .output() strategy
  // --------------------------------------------------------------------------
  it('produces plans with output strategy', () => {
    const choices: ModelChoices[] = [
      {
        model: 'Post',
        action: 'generate',
        outputStrategy: 'output',
        crud: allCrud,
        schemaRelations: ['author'],
        includeRelations: ['author', 'comments'],
        fieldVisibility: undefined,
      },
    ];

    const plan = buildPlan([postModel], choices, PROJECT_ROOT);

    expect(plan.schemas).toHaveLength(1);
    expect(plan.schemas[0].outputStrategy).toBe('output');
    expect(plan.procedures).toHaveLength(1);
    expect(plan.procedures[0].outputStrategy).toBe('output');
  });

  // --------------------------------------------------------------------------
  // 3. Generate with .resource() strategy and field visibility
  // --------------------------------------------------------------------------
  it('produces plans with resource strategy and field visibility', () => {
    const visibility = new Map<string, 'public' | 'authenticated' | 'admin'>([
      ['title', 'public'],
      ['content', 'authenticated'],
      ['authorId', 'admin'],
    ]);

    const choices: ModelChoices[] = [
      {
        model: 'Post',
        action: 'generate',
        outputStrategy: 'resource',
        crud: allCrud,
        schemaRelations: [],
        includeRelations: [],
        fieldVisibility: visibility,
      },
    ];

    const plan = buildPlan([postModel], choices, PROJECT_ROOT);

    expect(plan.schemas[0].outputStrategy).toBe('resource');
    expect(plan.schemas[0].fieldVisibility).toBe(visibility);
    expect(plan.procedures[0].outputStrategy).toBe('resource');
  });

  // --------------------------------------------------------------------------
  // 4. Correct schema file path
  // --------------------------------------------------------------------------
  it('generates correct schema file path', () => {
    const choices: ModelChoices[] = [
      {
        model: 'Post',
        action: 'generate',
        outputStrategy: 'output',
        crud: allCrud,
        schemaRelations: [],
        includeRelations: [],
        fieldVisibility: undefined,
      },
    ];

    const plan = buildPlan([postModel], choices, PROJECT_ROOT);

    expect(plan.schemas[0].outputPath).toBe(
      join(PROJECT_ROOT, 'src/schemas/post.schema.ts'),
    );
  });

  // --------------------------------------------------------------------------
  // 5. Correct procedure file path
  // --------------------------------------------------------------------------
  it('generates correct procedure file path', () => {
    const choices: ModelChoices[] = [
      {
        model: 'Post',
        action: 'generate',
        outputStrategy: 'output',
        crud: allCrud,
        schemaRelations: [],
        includeRelations: [],
        fieldVisibility: undefined,
      },
    ];

    const plan = buildPlan([postModel], choices, PROJECT_ROOT);

    expect(plan.procedures[0].outputPath).toBe(
      join(PROJECT_ROOT, 'src/procedures/posts.ts'),
    );
  });

  // --------------------------------------------------------------------------
  // 6. Correct kebab paths for multi-word models
  // --------------------------------------------------------------------------
  it('uses kebab-case paths for multi-word model names', () => {
    const choices: ModelChoices[] = [
      {
        model: 'FriendRequest',
        action: 'generate',
        outputStrategy: 'output',
        crud: allCrud,
        schemaRelations: [],
        includeRelations: [],
        fieldVisibility: undefined,
      },
    ];

    const plan = buildPlan([friendRequestModel], choices, PROJECT_ROOT);

    expect(plan.schemas[0].outputPath).toBe(
      join(PROJECT_ROOT, 'src/schemas/friend-request.schema.ts'),
    );
    expect(plan.procedures[0].outputPath).toBe(
      join(PROJECT_ROOT, 'src/procedures/friend-requests.ts'),
    );
  });

  // --------------------------------------------------------------------------
  // 7. Schema import path
  // --------------------------------------------------------------------------
  it('generates correct schema import path with .js extension', () => {
    const choices: ModelChoices[] = [
      {
        model: 'Post',
        action: 'generate',
        outputStrategy: 'output',
        crud: allCrud,
        schemaRelations: [],
        includeRelations: [],
        fieldVisibility: undefined,
      },
    ];

    const plan = buildPlan([postModel], choices, PROJECT_ROOT);

    expect(plan.procedures[0].schemaImportPath).toBe('../schemas/post.schema.js');
  });

  // --------------------------------------------------------------------------
  // 8. Registration plan values
  // --------------------------------------------------------------------------
  it('generates correct registration plan values', () => {
    const choices: ModelChoices[] = [
      {
        model: 'Post',
        action: 'generate',
        outputStrategy: 'output',
        crud: allCrud,
        schemaRelations: [],
        includeRelations: [],
        fieldVisibility: undefined,
      },
    ];

    const plan = buildPlan([postModel], choices, PROJECT_ROOT);

    expect(plan.registrations[0].procedureVarName).toBe('postProcedures');
    expect(plan.registrations[0].entityName).toBe('posts');
    expect(plan.registrations[0].importPath).toBe('./procedures/posts.js');
  });

  // --------------------------------------------------------------------------
  // 9. Filtered fields: excludes auto-managed and sensitive
  // --------------------------------------------------------------------------
  it('filters out auto-managed and sensitive fields from fields array', () => {
    const choices: ModelChoices[] = [
      {
        model: 'Post',
        action: 'generate',
        outputStrategy: 'output',
        crud: allCrud,
        schemaRelations: [],
        includeRelations: [],
        fieldVisibility: undefined,
      },
    ];

    const plan = buildPlan([postModel], choices, PROJECT_ROOT);
    const schema = plan.schemas[0];

    // allFields includes everything
    expect(schema.allFields).toHaveLength(7);
    expect(schema.allFields.map((f) => f.name)).toContain('id');
    expect(schema.allFields.map((f) => f.name)).toContain('createdAt');
    expect(schema.allFields.map((f) => f.name)).toContain('password');

    // fields excludes auto-managed (id, createdAt, updatedAt) and sensitive (password)
    const fieldNames = schema.fields.map((f) => f.name);
    expect(fieldNames).toContain('title');
    expect(fieldNames).toContain('content');
    expect(fieldNames).toContain('authorId');
    expect(fieldNames).not.toContain('id');
    expect(fieldNames).not.toContain('createdAt');
    expect(fieldNames).not.toContain('updatedAt');
    expect(fieldNames).not.toContain('password');
    expect(schema.fields).toHaveLength(3);
  });

  // --------------------------------------------------------------------------
  // 10. Only selected relations in schema plan
  // --------------------------------------------------------------------------
  it('includes only selected schema relations', () => {
    const choices: ModelChoices[] = [
      {
        model: 'Post',
        action: 'generate',
        outputStrategy: 'output',
        crud: allCrud,
        schemaRelations: ['author', 'comments'],
        includeRelations: [],
        fieldVisibility: undefined,
      },
    ];

    const plan = buildPlan([postModel], choices, PROJECT_ROOT);
    const schema = plan.schemas[0];

    // Post model has 4 relations, but only 2 selected
    expect(schema.relations).toHaveLength(2);
    expect(schema.relations.map((r) => r.name)).toEqual(['author', 'comments']);
  });

  // --------------------------------------------------------------------------
  // 11. Regenerate → overwrite action
  // --------------------------------------------------------------------------
  it('maps regenerate action to overwrite', () => {
    const choices: ModelChoices[] = [
      {
        model: 'Post',
        action: 'regenerate',
        outputStrategy: 'output',
        crud: allCrud,
        schemaRelations: [],
        includeRelations: [],
        fieldVisibility: undefined,
      },
    ];

    const plan = buildPlan([postModel], choices, PROJECT_ROOT);

    expect(plan.schemas[0].action).toBe('overwrite');
    expect(plan.procedures[0].action).toBe('overwrite');
  });

  // --------------------------------------------------------------------------
  // 12. includeRelations is a string array of selected names
  // --------------------------------------------------------------------------
  it('produces includeRelations as string array of selected relation names', () => {
    const choices: ModelChoices[] = [
      {
        model: 'Post',
        action: 'generate',
        outputStrategy: 'output',
        crud: allCrud,
        schemaRelations: [],
        includeRelations: ['author', 'tags'],
        fieldVisibility: undefined,
      },
    ];

    const plan = buildPlan([postModel], choices, PROJECT_ROOT);
    const proc = plan.procedures[0];

    // Should only contain the 2 selected relation names as strings
    expect(proc.includeRelations).toHaveLength(2);
    expect(proc.includeRelations).toEqual(['author', 'tags']);
    // Verify they are strings, not objects
    for (const rel of proc.includeRelations) {
      expect(typeof rel).toBe('string');
    }
  });

  // --------------------------------------------------------------------------
  // Multi-word registration plan values
  // --------------------------------------------------------------------------
  it('generates correct registration for multi-word models', () => {
    const choices: ModelChoices[] = [
      {
        model: 'FriendRequest',
        action: 'generate',
        outputStrategy: 'output',
        crud: allCrud,
        schemaRelations: [],
        includeRelations: [],
        fieldVisibility: undefined,
      },
    ];

    const plan = buildPlan([friendRequestModel], choices, PROJECT_ROOT);

    expect(plan.registrations[0].procedureVarName).toBe('friendRequestProcedures');
    expect(plan.registrations[0].entityName).toBe('friend-requests');
    expect(plan.registrations[0].importPath).toBe('./procedures/friend-requests.js');
  });

  // --------------------------------------------------------------------------
  // Generate action maps to create
  // --------------------------------------------------------------------------
  it('maps generate action to create', () => {
    const choices: ModelChoices[] = [
      {
        model: 'Post',
        action: 'generate',
        outputStrategy: 'output',
        crud: allCrud,
        schemaRelations: [],
        includeRelations: [],
        fieldVisibility: undefined,
      },
    ];

    const plan = buildPlan([postModel], choices, PROJECT_ROOT);

    expect(plan.schemas[0].action).toBe('create');
    expect(plan.procedures[0].action).toBe('create');
  });

  // --------------------------------------------------------------------------
  // Model not found in models array is silently skipped
  // --------------------------------------------------------------------------
  it('silently skips choices for models not found in the models array', () => {
    const choices: ModelChoices[] = [
      {
        model: 'NonExistent',
        action: 'generate',
        outputStrategy: 'output',
        crud: allCrud,
        schemaRelations: [],
        includeRelations: [],
        fieldVisibility: undefined,
      },
    ];

    const plan = buildPlan([postModel], choices, PROJECT_ROOT);

    expect(plan.schemas).toHaveLength(0);
    expect(plan.procedures).toHaveLength(0);
    expect(plan.registrations).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // CRUD choices are passed through
  // --------------------------------------------------------------------------
  it('passes through CRUD choices to procedure plan', () => {
    const customCrud: ModelChoices['crud'] = {
      get: true,
      list: true,
      create: false,
      update: false,
      delete: true,
    };

    const choices: ModelChoices[] = [
      {
        model: 'Post',
        action: 'generate',
        outputStrategy: 'output',
        crud: customCrud,
        schemaRelations: [],
        includeRelations: [],
        fieldVisibility: undefined,
      },
    ];

    const plan = buildPlan([postModel], choices, PROJECT_ROOT);

    expect(plan.procedures[0].crud).toEqual(customCrud);
  });

  // --------------------------------------------------------------------------
  // Model reference is preserved in plans
  // --------------------------------------------------------------------------
  it('preserves model reference in schema and procedure plans', () => {
    const choices: ModelChoices[] = [
      {
        model: 'Post',
        action: 'generate',
        outputStrategy: 'output',
        crud: allCrud,
        schemaRelations: [],
        includeRelations: [],
        fieldVisibility: undefined,
      },
    ];

    const plan = buildPlan([postModel], choices, PROJECT_ROOT);

    expect(plan.schemas[0].model).toBe(postModel);
    expect(plan.procedures[0].model).toBe(postModel);
  });
});
