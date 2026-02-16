/**
 * Sync Procedure Generator - Unit Tests
 *
 * Tests for `generateProcedureFile()` which produces TypeScript source
 * strings for procedure files from a `ProcedureFilePlan`.
 */

import { describe, expect, it } from 'vitest';

import { generateProcedureFile } from '../procedure-generator.js';
import type {
  CrudChoices,
  ProcedureFilePlan,
  SyncFieldInfo,
  SyncModelInfo,
  SyncRelationInfo,
} from '../types.js';

// ============================================================================
// Test Helpers
// ============================================================================

/** Create a minimal SyncFieldInfo with sensible defaults. */
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

/** Create a minimal SyncRelationInfo. */
function relation(
  name: string,
  relatedModel: string,
  kind: SyncRelationInfo['kind'],
  foreignKey?: string
): SyncRelationInfo {
  return { name, relatedModel, kind, foreignKey };
}

// ── Common fields ─────────────────────────────────────

const idField = field({
  name: 'id',
  type: 'String',
  isId: true,
  isAutoManaged: true,
  hasDefault: true,
  defaultValue: 'uuid()',
});

const titleField = field({ name: 'title', type: 'String' });
const contentField = field({ name: 'content', type: 'String' });

const createdAtField = field({
  name: 'createdAt',
  type: 'DateTime',
  isAutoManaged: true,
  hasDefault: true,
  defaultValue: 'now()',
});

const updatedAtField = field({
  name: 'updatedAt',
  type: 'DateTime',
  isAutoManaged: true,
});

const authorIdField = field({
  name: 'authorId',
  type: 'String',
  isUserForeignKey: true,
});

// ── Common models ─────────────────────────────────────

const postModel: SyncModelInfo = {
  name: 'Post',
  fields: [idField, titleField, contentField, authorIdField, createdAtField, updatedAtField],
  relations: [
    relation('author', 'User', 'belongsTo', 'authorId'),
    relation('comments', 'Comment', 'hasMany'),
  ],
  isJoinTable: false,
  hasTimestamps: true,
  uniqueConstraints: [],
};

const tagModel: SyncModelInfo = {
  name: 'Tag',
  fields: [idField, field({ name: 'label', type: 'String' })],
  relations: [],
  isJoinTable: false,
  hasTimestamps: false,
  uniqueConstraints: [],
};

const likeModel: SyncModelInfo = {
  name: 'Like',
  fields: [
    field({ name: 'userId', type: 'String', isUserForeignKey: true }),
    field({ name: 'postId', type: 'String' }),
  ],
  relations: [],
  isJoinTable: true,
  hasTimestamps: false,
  uniqueConstraints: [['userId', 'postId']],
};

const friendRequestModel: SyncModelInfo = {
  name: 'FriendRequest',
  fields: [
    idField,
    field({ name: 'senderId', type: 'String' }),
    field({ name: 'receiverId', type: 'String' }),
    field({ name: 'status', type: 'String' }),
    createdAtField,
  ],
  relations: [],
  isJoinTable: false,
  hasTimestamps: false,
  uniqueConstraints: [],
};

// ── Full CRUD choices ─────────────────────────────────

const fullCrud: CrudChoices = {
  get: true,
  list: true,
  create: true,
  update: true,
  delete: true,
};

const readOnlyCrud: CrudChoices = {
  get: true,
  list: true,
  create: false,
  update: false,
  delete: false,
};

// ── Helper to build a ProcedureFilePlan ───────────────

function makePlan(
  overrides: Partial<ProcedureFilePlan> & { model: SyncModelInfo }
): ProcedureFilePlan {
  return {
    outputPath: overrides.outputPath ?? '/tmp/test/src/procedures/post.ts',
    schemaImportPath: overrides.schemaImportPath ?? '../schemas/post.schema.js',
    outputStrategy: overrides.outputStrategy ?? 'output',
    crud: overrides.crud ?? fullCrud,
    includeRelations: overrides.includeRelations ?? [],
    action: overrides.action ?? 'create',
    model: overrides.model,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('generateProcedureFile', () => {
  // --------------------------------------------------------------------------
  // 1. Full CRUD: All 5 procedures generated with correct names
  // --------------------------------------------------------------------------
  it('generates all 5 CRUD procedures when all crud flags are true', () => {
    const plan = makePlan({ model: postModel, crud: fullCrud });
    const output = generateProcedureFile(plan);

    expect(output).toContain('getPost: procedure()');
    expect(output).toContain('listPosts: procedure()');
    expect(output).toContain('createPost: procedure()');
    expect(output).toContain('updatePost: procedure()');
    expect(output).toContain('deletePost: procedure()');
  });

  // --------------------------------------------------------------------------
  // 2. Partial CRUD (get + list only): Only get and list generated
  // --------------------------------------------------------------------------
  it('generates only get and list when create/update/delete are false', () => {
    const plan = makePlan({ model: postModel, crud: readOnlyCrud });
    const output = generateProcedureFile(plan);

    expect(output).toContain('getPost: procedure()');
    expect(output).toContain('listPosts: procedure()');
    expect(output).not.toContain('createPost');
    expect(output).not.toContain('updatePost');
    expect(output).not.toContain('deletePost');
  });

  // --------------------------------------------------------------------------
  // 3. Procedure naming: correct names for multi-word models
  // --------------------------------------------------------------------------
  it('generates correct procedure names for multi-word model names', () => {
    const plan = makePlan({ model: friendRequestModel, crud: fullCrud });
    const output = generateProcedureFile(plan);

    expect(output).toContain('getFriendRequest: procedure()');
    expect(output).toContain('listFriendRequests: procedure()');
    expect(output).toContain('createFriendRequest: procedure()');
    expect(output).toContain('updateFriendRequest: procedure()');
    expect(output).toContain('deleteFriendRequest: procedure()');
    expect(output).toContain("friendRequestProcedures = procedures('friend-requests',");
  });

  // --------------------------------------------------------------------------
  // 4. Get procedure structure: .input(), .output(), findUniqueOrThrow
  // --------------------------------------------------------------------------
  it('generates get procedure with input, output, and findUniqueOrThrow', () => {
    const plan = makePlan({ model: postModel });
    const output = generateProcedureFile(plan);

    expect(output).toContain('.input(z.object({ id: z.string().uuid() }))');
    expect(output).toContain('.output(PostSchema)');
    expect(output).toContain('findUniqueOrThrow');
    expect(output).toContain('where: { id: input.id }');
  });

  // --------------------------------------------------------------------------
  // 5. List procedure structure: pagination, findMany, count()
  // --------------------------------------------------------------------------
  it('generates list procedure with pagination, findMany, and count', () => {
    const plan = makePlan({ model: postModel });
    const output = generateProcedureFile(plan);

    expect(output).toContain('.input(ListPostsSchema)');
    expect(output).toContain('const { page, perPage } = input;');
    expect(output).toContain('ctx.db.post.findMany(');
    expect(output).toContain('skip: (page - 1) * perPage,');
    expect(output).toContain('take: perPage,');
    expect(output).toContain("orderBy: { createdAt: 'desc' },");
    expect(output).toContain('ctx.db.post.count()');
    expect(output).toContain('return { items, total, page, perPage };');
  });

  // --------------------------------------------------------------------------
  // 6. Create with user FK: authorId: ctx.user.id in data spread
  // --------------------------------------------------------------------------
  it('spreads input and adds user FK field in create when isUserForeignKey is present', () => {
    const plan = makePlan({ model: postModel });
    const output = generateProcedureFile(plan);

    expect(output).toContain('data: { ...input, authorId: ctx.user.id }');
  });

  // --------------------------------------------------------------------------
  // 7. Update destructures id from input
  // --------------------------------------------------------------------------
  it('destructures id from input in update procedure', () => {
    const plan = makePlan({ model: postModel });
    const output = generateProcedureFile(plan);

    expect(output).toContain('const { id, ...data } = input;');
    expect(output).toContain('ctx.db.post.update({ where: { id }, data });');
  });

  // --------------------------------------------------------------------------
  // 8. Delete returns { success: true }
  // --------------------------------------------------------------------------
  it('returns { success: true } from delete procedure', () => {
    const plan = makePlan({ model: postModel });
    const output = generateProcedureFile(plan);

    expect(output).toContain('await ctx.db.post.delete({ where: { id: input.id } });');
    expect(output).toContain('return { success: true };');
  });

  // --------------------------------------------------------------------------
  // 9. Prisma includes: include block when includeRelations is set
  // --------------------------------------------------------------------------
  it('adds include block with relations when includeRelations is non-empty', () => {
    const plan = makePlan({
      model: postModel,
      includeRelations: ['author', 'comments'],
    });
    const output = generateProcedureFile(plan);

    expect(output).toContain('include: {');
    expect(output).toContain('author: true,');
    expect(output).toContain('comments: true,');
  });

  // --------------------------------------------------------------------------
  // 10. No includes when includeRelations is empty
  // --------------------------------------------------------------------------
  it('does not generate include block when includeRelations is empty', () => {
    const plan = makePlan({
      model: postModel,
      includeRelations: [],
    });
    const output = generateProcedureFile(plan);

    expect(output).not.toContain('include:');
  });

  // --------------------------------------------------------------------------
  // 11. Resource strategy: resource() and resourceCollection() present
  // --------------------------------------------------------------------------
  it('uses resource() and resourceCollection() for resource strategy', () => {
    const plan = makePlan({
      model: postModel,
      outputStrategy: 'resource',
    });
    const output = generateProcedureFile(plan);

    expect(output).toContain('resource(');
    expect(output).toContain('resourceCollection(');
    expect(output).toContain(
      "import { procedure, procedures, resource, resourceCollection } from '@veloxts/router';"
    );
  });

  // --------------------------------------------------------------------------
  // 12. Resource strategy: no .output() for get/list
  // --------------------------------------------------------------------------
  it('does not use .output() in resource strategy for get and list', () => {
    const plan = makePlan({
      model: postModel,
      outputStrategy: 'resource',
    });
    const output = generateProcedureFile(plan);

    expect(output).not.toContain('.output(');
  });

  // --------------------------------------------------------------------------
  // 13. Output imports: procedure and procedures from @veloxts/router
  // --------------------------------------------------------------------------
  it('imports procedure and procedures from @veloxts/router', () => {
    const plan = makePlan({ model: postModel });
    const output = generateProcedureFile(plan);

    expect(output).toContain("import { procedure, procedures } from '@veloxts/router';");
  });

  // --------------------------------------------------------------------------
  // 14. Schema import path: imports from plan's schemaImportPath
  // --------------------------------------------------------------------------
  it('imports schemas from the plan schemaImportPath', () => {
    const plan = makePlan({
      model: postModel,
      schemaImportPath: '../schemas/post.schema.js',
    });
    const output = generateProcedureFile(plan);

    expect(output).toContain("from '../schemas/post.schema.js';");
  });

  // --------------------------------------------------------------------------
  // 15. Join table compound delete: uses userId_postId compound key
  // --------------------------------------------------------------------------
  it('generates compound unique delete for join table models', () => {
    const plan = makePlan({
      model: likeModel,
      crud: { get: false, list: false, create: false, update: false, delete: true },
    });
    const output = generateProcedureFile(plan);

    expect(output).toContain('userId_postId: { userId: input.userId, postId: input.postId }');
  });

  // --------------------------------------------------------------------------
  // Additional: output strategy with relations imports WithRelationsSchema
  // --------------------------------------------------------------------------
  it('imports WithRelationsSchema when output strategy has includeRelations', () => {
    const plan = makePlan({
      model: postModel,
      includeRelations: ['author', 'comments'],
    });
    const output = generateProcedureFile(plan);

    expect(output).toContain('PostWithRelationsSchema');
    expect(output).toContain('.output(PostWithRelationsSchema)');
  });

  // --------------------------------------------------------------------------
  // Additional: output strategy without relations imports plain schema
  // --------------------------------------------------------------------------
  it('imports plain Schema when output strategy has no includeRelations', () => {
    const plan = makePlan({
      model: postModel,
      includeRelations: [],
    });
    const output = generateProcedureFile(plan);

    expect(output).toContain('PostSchema');
    expect(output).not.toContain('WithRelationsSchema');
  });

  // --------------------------------------------------------------------------
  // Additional: resource strategy imports base schema (not WithRelations)
  // --------------------------------------------------------------------------
  it('imports base schema (not WithRelations) for resource strategy', () => {
    const plan = makePlan({
      model: postModel,
      outputStrategy: 'resource',
      includeRelations: ['author'],
    });
    const output = generateProcedureFile(plan);

    expect(output).toContain('PostSchema');
    expect(output).not.toContain('WithRelationsSchema');
  });

  // --------------------------------------------------------------------------
  // Additional: create without user FK uses plain data: input
  // --------------------------------------------------------------------------
  it('uses plain data: input when no user FK field exists', () => {
    const plan = makePlan({ model: tagModel });
    const output = generateProcedureFile(plan);

    expect(output).toContain('ctx.db.tag.create({ data: input });');
    expect(output).not.toContain('ctx.user.id');
  });

  // --------------------------------------------------------------------------
  // Additional: Prisma accessor uses camelCase model name
  // --------------------------------------------------------------------------
  it('uses camelCase model name for Prisma accessor', () => {
    const plan = makePlan({ model: friendRequestModel });
    const output = generateProcedureFile(plan);

    expect(output).toContain('ctx.db.friendRequest.findUniqueOrThrow');
    expect(output).toContain('ctx.db.friendRequest.findMany');
    expect(output).toContain('ctx.db.friendRequest.create');
    expect(output).toContain('ctx.db.friendRequest.update');
    expect(output).toContain('ctx.db.friendRequest.delete');
  });

  // --------------------------------------------------------------------------
  // Additional: router name uses kebab-case plural
  // --------------------------------------------------------------------------
  it('uses kebab-case plural for the procedures router name', () => {
    const plan = makePlan({ model: postModel });
    const output = generateProcedureFile(plan);

    expect(output).toContain("postProcedures = procedures('posts',");
  });

  // --------------------------------------------------------------------------
  // Additional: collection var name uses camelCase + Procedures suffix
  // --------------------------------------------------------------------------
  it('names the collection variable as camelCase + Procedures', () => {
    const plan = makePlan({ model: friendRequestModel });
    const output = generateProcedureFile(plan);

    expect(output).toContain('export const friendRequestProcedures');
  });

  // --------------------------------------------------------------------------
  // Additional: resource strategy get uses PostSchema.public
  // --------------------------------------------------------------------------
  it('uses PostSchema.public in resource strategy get procedure', () => {
    const plan = makePlan({
      model: postModel,
      outputStrategy: 'resource',
    });
    const output = generateProcedureFile(plan);

    expect(output).toContain('resource(post, PostSchema.public)');
  });

  // --------------------------------------------------------------------------
  // Additional: resource strategy list uses resourceCollection with Schema.public
  // --------------------------------------------------------------------------
  it('uses resourceCollection with Schema.public in resource strategy list procedure', () => {
    const plan = makePlan({
      model: postModel,
      outputStrategy: 'resource',
    });
    const output = generateProcedureFile(plan);

    expect(output).toContain('resourceCollection(items, PostSchema.public)');
  });

  // --------------------------------------------------------------------------
  // Additional: includes appear in both get and list queries
  // --------------------------------------------------------------------------
  it('adds include block to both get and list queries', () => {
    const plan = makePlan({
      model: postModel,
      includeRelations: ['author'],
    });
    const output = generateProcedureFile(plan);

    // Count occurrences of "include:" - should appear in get and list
    const includeMatches = output.match(/include: \{/g);
    expect(includeMatches).not.toBeNull();
    expect(includeMatches?.length).toBe(2);
  });

  // --------------------------------------------------------------------------
  // Additional: includes do NOT appear in create/update/delete
  // --------------------------------------------------------------------------
  it('does not add include block to create, update, or delete procedures', () => {
    const plan = makePlan({
      model: postModel,
      includeRelations: ['author', 'comments'],
      crud: { get: false, list: false, create: true, update: true, delete: true },
    });
    const output = generateProcedureFile(plan);

    expect(output).not.toContain('include:');
  });

  // --------------------------------------------------------------------------
  // Additional: update procedure merges id with UpdateSchema
  // --------------------------------------------------------------------------
  it('merges id input with UpdateSchema in update procedure', () => {
    const plan = makePlan({ model: postModel });
    const output = generateProcedureFile(plan);

    expect(output).toContain('.input(UpdatePostSchema.extend({ id: z.string().uuid() }))');
  });

  // --------------------------------------------------------------------------
  // Additional: zod import is always present
  // --------------------------------------------------------------------------
  it('always imports zod', () => {
    const plan = makePlan({ model: postModel });
    const output = generateProcedureFile(plan);

    expect(output).toContain("import { z } from 'zod';");
  });
});
