/**
 * Sync Pipeline - Integration Test
 *
 * End-to-end test of the `velox sync` pipeline using a temp directory
 * with a realistic multi-model Prisma schema. Exercises the full pipeline:
 * analyze -> detect -> plan -> generate -> register.
 *
 * Bypasses interactive prompts by calling internal functions directly
 * with pre-built choices.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { registerProcedures } from '../../generators/utils/router-integration.js';
import { analyzeSchema } from '../analyzer.js';
import { detectExisting } from '../detector.js';
import { buildPlan } from '../planner.js';
import { generateProcedureFile } from '../procedure-generator.js';
import { generateSchemaFile } from '../schema-generator.js';
import type { ModelChoices } from '../types.js';

// ============================================================================
// Test Setup
// ============================================================================

/** Prisma schema fixture with 4 models and real relations */
const PRISMA_SCHEMA = `\
datasource db {
  provider = "sqlite"
}

generator client {
  provider = "prisma-client-js"
  output   = "../node_modules/.prisma/client"
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  posts     Post[]
  comments  Comment[]
  likes     Like[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id        String    @id @default(uuid())
  title     String
  content   String?
  published Boolean   @default(false)
  authorId  String
  author    User      @relation(fields: [authorId], references: [id])
  comments  Comment[]
  likes     Like[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Comment {
  id        String   @id @default(uuid())
  text      String
  postId    String
  post      Post     @relation(fields: [postId], references: [id])
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Like {
  id        String   @id @default(uuid())
  userId    String
  postId    String
  user      User     @relation(fields: [userId], references: [id])
  post      Post     @relation(fields: [postId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([userId, postId])
}
`;

/** Minimal src/index.ts fixture with empty collections array */
const INDEX_TS_FIXTURE = `\
const collections = [];

export const router = {};
`;

/** Simulated existing user procedures file */
const USERS_TS_FIXTURE = `\
// Existing user procedures
export const userProcedures = {};
`;

let tempDir: string;

/**
 * Create a fresh temp project directory with the standard fixture files.
 */
function setupTempProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'velox-sync-integration-'));

  // Create directories
  mkdirSync(join(dir, 'prisma'), { recursive: true });
  mkdirSync(join(dir, 'src', 'procedures'), { recursive: true });
  mkdirSync(join(dir, 'src', 'schemas'), { recursive: true });

  // Write fixtures
  writeFileSync(join(dir, 'prisma', 'schema.prisma'), PRISMA_SCHEMA, 'utf-8');
  writeFileSync(join(dir, 'src', 'index.ts'), INDEX_TS_FIXTURE, 'utf-8');
  writeFileSync(join(dir, 'src', 'procedures', 'users.ts'), USERS_TS_FIXTURE, 'utf-8');

  return dir;
}

afterEach(() => {
  if (tempDir && existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

// ============================================================================
// Integration Test
// ============================================================================

describe('sync pipeline integration', () => {
  it('runs the full analyze -> detect -> plan -> generate -> register pipeline', () => {
    tempDir = setupTempProject();

    // ── Stage 1: Analyze ────────────────────────────────────────────────
    const models = analyzeSchema(tempDir);

    // Assertion 1: 4 models found
    expect(models).toHaveLength(4);
    const modelNames = models.map((m) => m.name);
    expect(modelNames).toContain('User');
    expect(modelNames).toContain('Post');
    expect(modelNames).toContain('Comment');
    expect(modelNames).toContain('Like');

    // ── Stage 2: Detect ─────────────────────────────────────────────────
    const existing = detectExisting(tempDir, models);

    // Assertion 2: User found in existing procedures
    expect(existing.procedures.has('User')).toBe(true);
    expect(existing.procedures.size).toBe(1);
    // No existing schemas
    expect(existing.schemas.size).toBe(0);

    // ── Stage 3: Build choices (bypassing the interactive prompter) ─────
    const choices: ModelChoices[] = [
      {
        model: 'User',
        action: 'skip',
        outputStrategy: 'output',
        crud: { get: false, list: false, create: false, update: false, delete: false },
        schemaRelations: [],
        includeRelations: [],
        fieldVisibility: undefined,
      },
      {
        model: 'Post',
        action: 'generate',
        outputStrategy: 'output',
        crud: { get: true, list: true, create: true, update: true, delete: true },
        schemaRelations: ['author', 'comments'],
        includeRelations: ['author'],
        fieldVisibility: undefined,
      },
      {
        model: 'Comment',
        action: 'generate',
        outputStrategy: 'output',
        crud: { get: true, list: true, create: true, update: true, delete: true },
        schemaRelations: [],
        includeRelations: [],
        fieldVisibility: undefined,
      },
      {
        model: 'Like',
        action: 'skip',
        outputStrategy: 'output',
        crud: { get: false, list: false, create: false, update: false, delete: false },
        schemaRelations: [],
        includeRelations: [],
        fieldVisibility: undefined,
      },
    ];

    // ── Stage 4: Build plan ─────────────────────────────────────────────
    const plan = buildPlan(models, choices, tempDir);

    // Assertion 3: 2 schema plans, 2 procedure plans, 2 registrations
    expect(plan.schemas).toHaveLength(2);
    expect(plan.procedures).toHaveLength(2);
    expect(plan.registrations).toHaveLength(2);

    // Verify planned models are Post and Comment (not User or Like)
    const plannedSchemaModels = plan.schemas.map((s) => s.model.name);
    expect(plannedSchemaModels).toContain('Post');
    expect(plannedSchemaModels).toContain('Comment');
    expect(plannedSchemaModels).not.toContain('User');
    expect(plannedSchemaModels).not.toContain('Like');

    // ── Stage 5: Generate files ─────────────────────────────────────────
    for (const schemaPlan of plan.schemas) {
      const content = generateSchemaFile(schemaPlan);
      mkdirSync(join(tempDir, 'src', 'schemas'), { recursive: true });
      writeFileSync(schemaPlan.outputPath, content, 'utf-8');
    }

    for (const procedurePlan of plan.procedures) {
      const content = generateProcedureFile(procedurePlan);
      mkdirSync(join(tempDir, 'src', 'procedures'), { recursive: true });
      writeFileSync(procedurePlan.outputPath, content, 'utf-8');
    }

    // ── Assertion 4: Schema files exist ─────────────────────────────────
    const postSchemaPath = join(tempDir, 'src', 'schemas', 'post.schema.ts');
    const commentSchemaPath = join(tempDir, 'src', 'schemas', 'comment.schema.ts');
    expect(existsSync(postSchemaPath)).toBe(true);
    expect(existsSync(commentSchemaPath)).toBe(true);

    // ── Assertion 5: Procedure files exist ──────────────────────────────
    const postProcedurePath = join(tempDir, 'src', 'procedures', 'posts.ts');
    const commentProcedurePath = join(tempDir, 'src', 'procedures', 'comments.ts');
    expect(existsSync(postProcedurePath)).toBe(true);
    expect(existsSync(commentProcedurePath)).toBe(true);

    // ── Assertion 6: users.ts unchanged (skip action) ───────────────────
    const usersContent = readFileSync(join(tempDir, 'src', 'procedures', 'users.ts'), 'utf-8');
    expect(usersContent).toBe(USERS_TS_FIXTURE);

    // ── Assertion 7: Schema file contains expected patterns ─────────────
    const postSchemaContent = readFileSync(postSchemaPath, 'utf-8');
    expect(postSchemaContent).toContain('z.object');
    expect(postSchemaContent).toContain('CreatePostSchema');
    expect(postSchemaContent).toContain('UpdatePostSchema');
    expect(postSchemaContent).toContain('ListPostsSchema');
    expect(postSchemaContent).toContain('PostSchema');
    // Should have the WithRelationsSchema since we selected author + comments
    expect(postSchemaContent).toContain('PostWithRelationsSchema');

    const commentSchemaContent = readFileSync(commentSchemaPath, 'utf-8');
    expect(commentSchemaContent).toContain('z.object');
    expect(commentSchemaContent).toContain('CreateCommentSchema');
    expect(commentSchemaContent).toContain('UpdateCommentSchema');
    expect(commentSchemaContent).toContain('CommentSchema');

    // ── Assertion 8: Procedure file contains expected patterns ──────────
    const postProcContent = readFileSync(postProcedurePath, 'utf-8');
    expect(postProcContent).toContain('postProcedures');
    expect(postProcContent).toContain('getPost');
    expect(postProcContent).toContain('listPosts');
    expect(postProcContent).toContain('createPost');
    expect(postProcContent).toContain('updatePost');
    expect(postProcContent).toContain('deletePost');
    // Should include author relation
    expect(postProcContent).toContain('author: true');

    const commentProcContent = readFileSync(commentProcedurePath, 'utf-8');
    expect(commentProcContent).toContain('commentProcedures');
    expect(commentProcContent).toContain('getComment');
    expect(commentProcContent).toContain('listComments');
    expect(commentProcContent).toContain('createComment');

    // ── Stage 6: Register procedures in router ──────────────────────────
    for (const reg of plan.registrations) {
      registerProcedures(tempDir, reg.entityName, reg.procedureVarName);
    }

    // ── Assertion 9: index.ts now contains imports and registrations ────
    const indexContent = readFileSync(join(tempDir, 'src', 'index.ts'), 'utf-8');

    // Should have import statements for postProcedures and commentProcedures
    expect(indexContent).toContain('postProcedures');
    expect(indexContent).toContain('commentProcedures');

    // Should contain import paths
    expect(indexContent).toContain('./procedures/posts.js');
    expect(indexContent).toContain('./procedures/comments.js');
  });

  it('generates valid schema field types from Prisma types', () => {
    tempDir = setupTempProject();
    const models = analyzeSchema(tempDir);

    // Build choices for Post only
    const choices: ModelChoices[] = [
      {
        model: 'Post',
        action: 'generate',
        outputStrategy: 'output',
        crud: { get: true, list: true, create: true, update: true, delete: true },
        schemaRelations: [],
        includeRelations: [],
        fieldVisibility: undefined,
      },
    ];

    const plan = buildPlan(models, choices, tempDir);
    const schemaContent = generateSchemaFile(plan.schemas[0]);

    // Verify Zod types for different Prisma types
    expect(schemaContent).toContain('z.string().uuid()'); // id field
    expect(schemaContent).toContain('z.boolean()'); // published field
    expect(schemaContent).toContain('z.date()'); // createdAt/updatedAt
    // content is optional String -> should have .nullable()
    expect(schemaContent).toContain('.nullable()');
  });

  it('handles resource output strategy with field visibility', () => {
    tempDir = setupTempProject();
    const models = analyzeSchema(tempDir);

    const visibility = new Map<string, 'public' | 'authenticated' | 'admin'>([
      ['id', 'public'],
      ['title', 'public'],
      ['content', 'authenticated'],
      ['published', 'admin'],
    ]);

    const choices: ModelChoices[] = [
      {
        model: 'Post',
        action: 'generate',
        outputStrategy: 'resource',
        crud: { get: true, list: true, create: true, update: true, delete: true },
        schemaRelations: [],
        includeRelations: [],
        fieldVisibility: visibility,
      },
    ];

    const plan = buildPlan(models, choices, tempDir);
    const schemaContent = generateSchemaFile(plan.schemas[0]);

    // Resource strategy uses resourceSchema() builder with visibility tiers
    expect(schemaContent).toContain('resourceSchema()');
    expect(schemaContent).toContain(".public('id'");
    expect(schemaContent).toContain(".public('title'");
    expect(schemaContent).toContain(".authenticated('content'");
    expect(schemaContent).toContain(".admin('published'");
    expect(schemaContent).toContain('.build()');

    // Procedure should use resource() for get
    const procContent = generateProcedureFile(plan.procedures[0]);
    expect(procContent).toContain('resource(');
    expect(procContent).toContain('PostSchema.public');
  });

  it('detects join table (Like) and sets compound delete', () => {
    tempDir = setupTempProject();
    const models = analyzeSchema(tempDir);

    const likeModel = models.find((m) => m.name === 'Like');
    expect(likeModel).toBeDefined();
    expect(likeModel?.isJoinTable).toBe(true);
    expect(likeModel?.uniqueConstraints).toHaveLength(1);
    expect(likeModel?.uniqueConstraints[0]).toEqual(['userId', 'postId']);

    // Generate procedure for Like to verify compound delete
    const choices: ModelChoices[] = [
      {
        model: 'Like',
        action: 'generate',
        outputStrategy: 'output',
        crud: { get: false, list: false, create: false, update: false, delete: true },
        schemaRelations: [],
        includeRelations: [],
        fieldVisibility: undefined,
      },
    ];

    const plan = buildPlan(models, choices, tempDir);
    const procContent = generateProcedureFile(plan.procedures[0]);

    // Compound delete should reference both FK fields
    expect(procContent).toContain('userId');
    expect(procContent).toContain('postId');
    expect(procContent).toContain('userId_postId');
  });

  it('includes user foreign key in create mutation via ctx.user.id', () => {
    tempDir = setupTempProject();
    const models = analyzeSchema(tempDir);

    // Post has authorId -> User, so it should be a user FK
    const postModel = models.find((m) => m.name === 'Post');
    const authorIdField = postModel?.fields.find((f) => f.name === 'authorId');
    expect(authorIdField?.isUserForeignKey).toBe(true);

    const choices: ModelChoices[] = [
      {
        model: 'Post',
        action: 'generate',
        outputStrategy: 'output',
        crud: { get: false, list: false, create: true, update: false, delete: false },
        schemaRelations: [],
        includeRelations: [],
        fieldVisibility: undefined,
      },
    ];

    const plan = buildPlan(models, choices, tempDir);
    const procContent = generateProcedureFile(plan.procedures[0]);

    // Create mutation should inject authorId from ctx.user.id
    expect(procContent).toContain('authorId: ctx.user.id');
  });
});
