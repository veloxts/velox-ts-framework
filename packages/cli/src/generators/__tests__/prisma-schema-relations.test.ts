/**
 * Prisma Schema Relation Parsing - Unit Tests
 *
 * Tests for field-level parsing and relation detection in Prisma schema files.
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  analyzePrismaSchema,
  getModelRelations,
  type PrismaModelInfo,
  type PrismaSchemaAnalysis,
} from '../utils/prisma-schema.js';

// ============================================================================
// Test Setup
// ============================================================================

const TEST_DIR = join(import.meta.dirname ?? __dirname, '__fixtures__', 'relation-tests');

function writeSchema(name: string, content: string): string {
  const dir = join(TEST_DIR, name);
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, 'schema.prisma');
  writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

/** Get model info and assert it exists */
function getModel(analysis: PrismaSchemaAnalysis, modelName: string): PrismaModelInfo {
  const info = analysis.modelDetails.get(modelName);
  expect(info).toBeDefined();
  // Use `as` since we've asserted it's defined above
  return info as PrismaModelInfo;
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
// Field Parsing Tests
// ============================================================================

describe('Prisma Schema Relation Parsing', () => {
  describe('modelDetails', () => {
    it('should parse a model with no relations', () => {
      const filePath = writeSchema(
        'no-relations',
        `
model User {
  id    String @id @default(uuid())
  name  String
  email String @unique

  @@map("users")
}
`
      );

      const analysis = analyzePrismaSchema(filePath);
      const userInfo = getModel(analysis, 'User');

      expect(userInfo.name).toBe('User');
      expect(userInfo.fields).toHaveLength(3);
      expect(userInfo.relationFields).toHaveLength(0);
    });

    it('should detect a hasOne relation', () => {
      const filePath = writeSchema(
        'has-one',
        `
model Post {
  id       String @id @default(uuid())
  title    String
  author   User
  authorId String

  @@map("posts")
}

model User {
  id    String @id @default(uuid())
  name  String
  posts Post[]
}
`
      );

      const analysis = analyzePrismaSchema(filePath);
      const postInfo = getModel(analysis, 'Post');

      expect(postInfo.relationFields).toHaveLength(1);
      expect(postInfo.relationFields[0].name).toBe('author');
      expect(postInfo.relationFields[0].isRelation).toBe(true);
      expect(postInfo.relationFields[0].isArray).toBe(false);
      expect(postInfo.relationFields[0].relatedModel).toBe('User');
    });

    it('should detect a hasMany relation', () => {
      const filePath = writeSchema(
        'has-many',
        `
model User {
  id    String @id @default(uuid())
  name  String
  posts Post[]
}

model Post {
  id       String @id @default(uuid())
  title    String
  authorId String
}
`
      );

      const analysis = analyzePrismaSchema(filePath);
      const userInfo = getModel(analysis, 'User');

      expect(userInfo.relationFields).toHaveLength(1);
      expect(userInfo.relationFields[0].name).toBe('posts');
      expect(userInfo.relationFields[0].isRelation).toBe(true);
      expect(userInfo.relationFields[0].isArray).toBe(true);
      expect(userInfo.relationFields[0].relatedModel).toBe('Post');
    });

    it('should skip back-reference fields with @relation(fields: [...])', () => {
      const filePath = writeSchema(
        'back-reference',
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

      const analysis = analyzePrismaSchema(filePath);
      const postInfo = getModel(analysis, 'Post');

      // The 'author' field with @relation(fields: [...]) should be skipped
      const authorRelation = postInfo.relationFields.find((f) => f.name === 'author');
      expect(authorRelation).toBeUndefined();
    });

    it('should detect nullable relation (User?)', () => {
      const filePath = writeSchema(
        'nullable-relation',
        `
model Post {
  id       String @id @default(uuid())
  title    String
  author   User?
  authorId String?
}

model User {
  id    String @id @default(uuid())
  name  String
}
`
      );

      const analysis = analyzePrismaSchema(filePath);
      const postInfo = getModel(analysis, 'Post');

      expect(postInfo.relationFields).toHaveLength(1);
      expect(postInfo.relationFields[0].name).toBe('author');
      expect(postInfo.relationFields[0].isRelation).toBe(true);
      expect(postInfo.relationFields[0].isArray).toBe(false);
      expect(postInfo.relationFields[0].relatedModel).toBe('User');
    });

    it('should handle multiple relations on one model', () => {
      const filePath = writeSchema(
        'multiple-relations',
        `
model User {
  id           String       @id @default(uuid())
  name         String
  organization Organization
  orgId        String
  posts        Post[]
  comments     Comment[]
}

model Organization {
  id   String @id @default(uuid())
  name String
}

model Post {
  id    String @id @default(uuid())
  title String
}

model Comment {
  id   String @id @default(uuid())
  text String
}
`
      );

      const analysis = analyzePrismaSchema(filePath);
      const userInfo = getModel(analysis, 'User');

      expect(userInfo.relationFields).toHaveLength(3);

      const orgRelation = userInfo.relationFields.find((f) => f.name === 'organization');
      expect(orgRelation).toBeDefined();
      expect(orgRelation?.isArray).toBe(false);
      expect(orgRelation?.relatedModel).toBe('Organization');

      const postsRelation = userInfo.relationFields.find((f) => f.name === 'posts');
      expect(postsRelation).toBeDefined();
      expect(postsRelation?.isArray).toBe(true);

      const commentsRelation = userInfo.relationFields.find((f) => f.name === 'comments');
      expect(commentsRelation).toBeDefined();
      expect(commentsRelation?.isArray).toBe(true);
    });

    it('should not treat non-model types as relations', () => {
      const filePath = writeSchema(
        'non-model-types',
        `
model User {
  id        String   @id @default(uuid())
  name      String
  age       Int
  active    Boolean
  createdAt DateTime @default(now())
  role      Role

  @@map("users")
}

enum Role {
  ADMIN
  USER
}
`
      );

      const analysis = analyzePrismaSchema(filePath);
      const userInfo = getModel(analysis, 'User');

      // 'Role' is an enum, not a model — should not be treated as a relation
      expect(userInfo.relationFields).toHaveLength(0);
    });
  });

  // ============================================================================
  // getModelRelations Tests
  // ============================================================================

  describe('getModelRelations', () => {
    it('should categorize hasOne and hasMany correctly', () => {
      const filePath = writeSchema(
        'categorize',
        `
model User {
  id           String       @id @default(uuid())
  organization Organization
  orgId        String
  posts        Post[]
  comments     Comment[]
}

model Organization {
  id String @id @default(uuid())
}

model Post {
  id String @id @default(uuid())
}

model Comment {
  id String @id @default(uuid())
}
`
      );

      const analysis = analyzePrismaSchema(filePath);
      const relations = getModelRelations(analysis, 'User');

      expect(relations.hasOne).toEqual(['organization']);
      expect(relations.hasMany).toEqual(['posts', 'comments']);
    });

    it('should return empty arrays for model with no relations', () => {
      const filePath = writeSchema(
        'empty-relations',
        `
model Tag {
  id   String @id @default(uuid())
  name String
}
`
      );

      const analysis = analyzePrismaSchema(filePath);
      const relations = getModelRelations(analysis, 'Tag');

      expect(relations.hasOne).toEqual([]);
      expect(relations.hasMany).toEqual([]);
    });

    it('should return empty arrays for non-existent model', () => {
      const filePath = writeSchema(
        'non-existent',
        `
model User {
  id String @id @default(uuid())
}
`
      );

      const analysis = analyzePrismaSchema(filePath);
      const relations = getModelRelations(analysis, 'NonExistent');

      expect(relations.hasOne).toEqual([]);
      expect(relations.hasMany).toEqual([]);
    });
  });
});
