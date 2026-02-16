/**
 * Sync Analyzer - Unit Tests
 *
 * Tests for the `analyzeSchema()` function that parses Prisma schemas
 * into rich `SyncModelInfo[]` metadata for the sync pipeline.
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { SyncModelInfo } from '../types.js';
import { analyzeSchema } from '../analyzer.js';

// ============================================================================
// Test Setup
// ============================================================================

const TEST_DIR = join(import.meta.dirname ?? __dirname, '__fixtures__', 'analyzer-tests');

/**
 * Write a Prisma schema into a temporary project directory and return
 * the project root (the directory containing `prisma/schema.prisma`).
 */
function writeSchema(name: string, content: string): string {
  const projectRoot = join(TEST_DIR, name);
  const prismaDir = join(projectRoot, 'prisma');
  mkdirSync(prismaDir, { recursive: true });
  writeFileSync(join(prismaDir, 'schema.prisma'), content, 'utf-8');
  return projectRoot;
}

/** Find a model by name and assert it exists */
function getModel(models: readonly SyncModelInfo[], name: string): SyncModelInfo {
  const model = models.find((m) => m.name === name);
  expect(model, `Expected model "${name}" to exist`).toBeDefined();
  return model as SyncModelInfo;
}

beforeAll(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterAll(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

// ============================================================================
// Tests
// ============================================================================

describe('analyzeSchema', () => {
  // --------------------------------------------------------------------------
  // 1. Scalar field parsing
  // --------------------------------------------------------------------------
  it('parses scalar fields with correct types and flags', () => {
    const root = writeSchema(
      'scalar-fields',
      `
model Item {
  id        String   @id @default(uuid())
  name      String
  count     Int
  active    Boolean
  createdAt DateTime @default(now())
  bio       String?
  score     Float    @default(0.0)
}
`
    );

    const models = analyzeSchema(root);
    const item = getModel(models, 'Item');

    // name: required String, no default
    const nameField = item.fields.find((f) => f.name === 'name');
    expect(nameField).toBeDefined();
    expect(nameField?.type).toBe('String');
    expect(nameField?.isOptional).toBe(false);
    expect(nameField?.hasDefault).toBe(false);

    // count: required Int
    const countField = item.fields.find((f) => f.name === 'count');
    expect(countField?.type).toBe('Int');

    // active: required Boolean
    const activeField = item.fields.find((f) => f.name === 'active');
    expect(activeField?.type).toBe('Boolean');

    // createdAt: DateTime with default
    const createdAtField = item.fields.find((f) => f.name === 'createdAt');
    expect(createdAtField?.type).toBe('DateTime');
    expect(createdAtField?.hasDefault).toBe(true);

    // bio: optional String
    const bioField = item.fields.find((f) => f.name === 'bio');
    expect(bioField?.isOptional).toBe(true);

    // score: Float with default
    const scoreField = item.fields.find((f) => f.name === 'score');
    expect(scoreField?.type).toBe('Float');
    expect(scoreField?.hasDefault).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 2. @id and @unique annotations
  // --------------------------------------------------------------------------
  it('detects @id and @unique annotations', () => {
    const root = writeSchema(
      'id-unique',
      `
model User {
  id    String @id @default(uuid())
  email String @unique
  name  String
}
`
    );

    const models = analyzeSchema(root);
    const user = getModel(models, 'User');

    const idField = user.fields.find((f) => f.name === 'id');
    expect(idField?.isId).toBe(true);
    expect(idField?.isUnique).toBe(false);

    const emailField = user.fields.find((f) => f.name === 'email');
    expect(emailField?.isId).toBe(false);
    expect(emailField?.isUnique).toBe(true);

    const nameField = user.fields.find((f) => f.name === 'name');
    expect(nameField?.isId).toBe(false);
    expect(nameField?.isUnique).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 3. @default value extraction
  // --------------------------------------------------------------------------
  it('extracts @default values', () => {
    const root = writeSchema(
      'default-values',
      `
model Config {
  id     String  @id @default(uuid())
  when   DateTime @default(now())
  active Boolean  @default(true)
  status String   @default("PENDING")
  name   String
}
`
    );

    const models = analyzeSchema(root);
    const config = getModel(models, 'Config');

    expect(config.fields.find((f) => f.name === 'id')?.defaultValue).toBe('uuid()');
    expect(config.fields.find((f) => f.name === 'when')?.defaultValue).toBe('now()');
    expect(config.fields.find((f) => f.name === 'active')?.defaultValue).toBe('true');
    expect(config.fields.find((f) => f.name === 'status')?.defaultValue).toBe('"PENDING"');
    expect(config.fields.find((f) => f.name === 'name')?.defaultValue).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // 4. belongsTo relations
  // --------------------------------------------------------------------------
  it('classifies belongsTo relations', () => {
    const root = writeSchema(
      'belongs-to',
      `
model Post {
  id       String @id @default(uuid())
  title    String
  author   User   @relation(fields: [authorId], references: [id])
  authorId String
}

model User {
  id    String @id @default(uuid())
  name  String
  posts Post[]
}
`
    );

    const models = analyzeSchema(root);
    const post = getModel(models, 'Post');

    const authorRel = post.relations.find((r) => r.name === 'author');
    expect(authorRel).toBeDefined();
    expect(authorRel?.kind).toBe('belongsTo');
    expect(authorRel?.relatedModel).toBe('User');
    expect(authorRel?.foreignKey).toBe('authorId');
  });

  // --------------------------------------------------------------------------
  // 5. hasMany relations
  // --------------------------------------------------------------------------
  it('classifies hasMany relations', () => {
    const root = writeSchema(
      'has-many',
      `
model User {
  id    String @id @default(uuid())
  name  String
  posts Post[]
}

model Post {
  id    String @id @default(uuid())
  title String
}
`
    );

    const models = analyzeSchema(root);
    const user = getModel(models, 'User');

    const postsRel = user.relations.find((r) => r.name === 'posts');
    expect(postsRel).toBeDefined();
    expect(postsRel?.kind).toBe('hasMany');
    expect(postsRel?.relatedModel).toBe('Post');
    expect(postsRel?.foreignKey).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // 6. hasOne relations
  // --------------------------------------------------------------------------
  it('classifies hasOne relations', () => {
    const root = writeSchema(
      'has-one',
      `
model User {
  id      String  @id @default(uuid())
  name    String
  profile Profile
}

model Profile {
  id   String @id @default(uuid())
  bio  String
}
`
    );

    const models = analyzeSchema(root);
    const user = getModel(models, 'User');

    const profileRel = user.relations.find((r) => r.name === 'profile');
    expect(profileRel).toBeDefined();
    expect(profileRel?.kind).toBe('hasOne');
    expect(profileRel?.relatedModel).toBe('Profile');
    expect(profileRel?.foreignKey).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // 7. Join table detection
  // --------------------------------------------------------------------------
  it('detects join tables', () => {
    const root = writeSchema(
      'join-table',
      `
model User {
  id    String @id @default(uuid())
  name  String
  likes Like[]
}

model Post {
  id    String @id @default(uuid())
  title String
  likes Like[]
}

model Like {
  id     String @id @default(uuid())
  user   User   @relation(fields: [userId], references: [id])
  userId String
  post   Post   @relation(fields: [postId], references: [id])
  postId String

  @@unique([userId, postId])
}
`
    );

    const models = analyzeSchema(root);
    const like = getModel(models, 'Like');

    expect(like.isJoinTable).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 8. Non-join table with scalar fields
  // --------------------------------------------------------------------------
  it('non-join table with scalar fields', () => {
    const root = writeSchema(
      'non-join-table',
      `
model Post {
  id       String @id @default(uuid())
  title    String
  content  String
  author   User   @relation(fields: [authorId], references: [id])
  authorId String
}

model User {
  id    String @id @default(uuid())
  name  String
  posts Post[]
}
`
    );

    const models = analyzeSchema(root);
    const post = getModel(models, 'Post');

    // Post has non-FK scalar fields (title, content) so it is NOT a join table
    expect(post.isJoinTable).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 9. Sensitive field detection
  // --------------------------------------------------------------------------
  it('detects sensitive fields', () => {
    const root = writeSchema(
      'sensitive-fields',
      `
model User {
  id           String @id @default(uuid())
  email        String @unique
  password     String
  token        String?
  name         String
  passwordHash String
  apiKey       String?
}
`
    );

    const models = analyzeSchema(root);
    const user = getModel(models, 'User');

    expect(user.fields.find((f) => f.name === 'password')?.isSensitive).toBe(true);
    expect(user.fields.find((f) => f.name === 'token')?.isSensitive).toBe(true);
    expect(user.fields.find((f) => f.name === 'passwordHash')?.isSensitive).toBe(true);
    expect(user.fields.find((f) => f.name === 'apiKey')?.isSensitive).toBe(true);

    // Non-sensitive fields
    expect(user.fields.find((f) => f.name === 'email')?.isSensitive).toBe(false);
    expect(user.fields.find((f) => f.name === 'name')?.isSensitive).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 10. User foreign key detection
  // --------------------------------------------------------------------------
  it('detects user foreign keys', () => {
    const root = writeSchema(
      'user-fk',
      `
model Comment {
  id       String @id @default(uuid())
  text     String
  author   User   @relation(fields: [authorId], references: [id])
  authorId String
  post     Post   @relation(fields: [postId], references: [id])
  postId   String
}

model User {
  id       String    @id @default(uuid())
  name     String
  comments Comment[]
}

model Post {
  id       String    @id @default(uuid())
  title    String
  comments Comment[]
}
`
    );

    const models = analyzeSchema(root);
    const comment = getModel(models, 'Comment');

    // authorId points to User -> isUserForeignKey: true
    expect(comment.fields.find((f) => f.name === 'authorId')?.isUserForeignKey).toBe(true);

    // postId points to Post -> isUserForeignKey: false
    expect(comment.fields.find((f) => f.name === 'postId')?.isUserForeignKey).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 11. Auto-managed field detection
  // --------------------------------------------------------------------------
  it('detects auto-managed fields', () => {
    const root = writeSchema(
      'auto-managed',
      `
model Article {
  id        String    @id @default(uuid())
  title     String
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?
}
`
    );

    const models = analyzeSchema(root);
    const article = getModel(models, 'Article');

    expect(article.fields.find((f) => f.name === 'id')?.isAutoManaged).toBe(true);
    expect(article.fields.find((f) => f.name === 'createdAt')?.isAutoManaged).toBe(true);
    expect(article.fields.find((f) => f.name === 'updatedAt')?.isAutoManaged).toBe(true);
    expect(article.fields.find((f) => f.name === 'deletedAt')?.isAutoManaged).toBe(true);

    // title is NOT auto-managed
    expect(article.fields.find((f) => f.name === 'title')?.isAutoManaged).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 12. @@unique constraint parsing
  // --------------------------------------------------------------------------
  it('parses @@unique constraints', () => {
    const root = writeSchema(
      'unique-constraints',
      `
model Enrollment {
  id        String @id @default(uuid())
  student   User   @relation(fields: [studentId], references: [id])
  studentId String
  course    Post   @relation(fields: [courseId], references: [id])
  courseId   String

  @@unique([studentId, courseId])
}

model User {
  id          String       @id @default(uuid())
  enrollments Enrollment[]
}

model Post {
  id          String       @id @default(uuid())
  enrollments Enrollment[]
}
`
    );

    const models = analyzeSchema(root);
    const enrollment = getModel(models, 'Enrollment');

    expect(enrollment.uniqueConstraints).toHaveLength(1);
    expect(enrollment.uniqueConstraints[0]).toEqual(['studentId', 'courseId']);
  });

  // --------------------------------------------------------------------------
  // 13. Multi-model schema
  // --------------------------------------------------------------------------
  it('parses multi-model schema', () => {
    const root = writeSchema(
      'multi-model',
      `
model User {
  id        String   @id @default(uuid())
  name      String
  email     String   @unique
  posts     Post[]
  likes     Like[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id        String   @id @default(uuid())
  title     String
  content   String
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
  likes     Like[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Like {
  id     String @id @default(uuid())
  user   User   @relation(fields: [userId], references: [id])
  userId String
  post   Post   @relation(fields: [postId], references: [id])
  postId String

  @@unique([userId, postId])
}
`
    );

    const models = analyzeSchema(root);

    // Should return 3 models
    expect(models).toHaveLength(3);

    const modelNames = models.map((m) => m.name);
    expect(modelNames).toContain('User');
    expect(modelNames).toContain('Post');
    expect(modelNames).toContain('Like');

    // User: hasMany relations, timestamps
    const user = getModel(models, 'User');
    expect(user.relations.filter((r) => r.kind === 'hasMany')).toHaveLength(2);
    expect(user.hasTimestamps).toBe(true);
    expect(user.isJoinTable).toBe(false);

    // Post: belongsTo User, hasMany likes, timestamps
    const post = getModel(models, 'Post');
    expect(post.relations.find((r) => r.kind === 'belongsTo')?.relatedModel).toBe('User');
    expect(post.hasTimestamps).toBe(true);
    expect(post.isJoinTable).toBe(false);

    // Like: join table
    const like = getModel(models, 'Like');
    expect(like.isJoinTable).toBe(true);
    expect(like.relations.filter((r) => r.kind === 'belongsTo')).toHaveLength(2);
  });

  // --------------------------------------------------------------------------
  // Timestamps detection
  // --------------------------------------------------------------------------
  it('detects hasTimestamps correctly', () => {
    const root = writeSchema(
      'timestamps',
      `
model WithTimestamps {
  id        String   @id @default(uuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model WithoutTimestamps {
  id   String @id @default(uuid())
  name String
}

model OnlyCreatedAt {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())
}
`
    );

    const models = analyzeSchema(root);

    expect(getModel(models, 'WithTimestamps').hasTimestamps).toBe(true);
    expect(getModel(models, 'WithoutTimestamps').hasTimestamps).toBe(false);
    expect(getModel(models, 'OnlyCreatedAt').hasTimestamps).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Error: missing schema
  // --------------------------------------------------------------------------
  it('throws when no Prisma schema exists', () => {
    const root = join(TEST_DIR, 'no-schema');
    mkdirSync(root, { recursive: true });

    expect(() => analyzeSchema(root)).toThrow('Prisma schema not found');
  });
});
