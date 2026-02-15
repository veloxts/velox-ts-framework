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
  getModelFields,
  getModelRelations,
  type PrismaFieldInfo,
  type PrismaModelInfo,
  type PrismaSchemaAnalysis,
  prismaFieldToFieldDefinition,
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

  // ============================================================================
  // isOptional / hasDefault Detection Tests
  // ============================================================================

  describe('field optionality and defaults', () => {
    it('should detect optional fields with ?', () => {
      const filePath = writeSchema(
        'optional-fields',
        `
model Post {
  id      String  @id @default(uuid())
  title   String
  bio     String?
  age     Int?
}
`
      );

      const analysis = analyzePrismaSchema(filePath);
      const postInfo = getModel(analysis, 'Post');

      const titleField = postInfo.fields.find((f) => f.name === 'title');
      expect(titleField?.isOptional).toBe(false);

      const bioField = postInfo.fields.find((f) => f.name === 'bio');
      expect(bioField?.isOptional).toBe(true);

      const ageField = postInfo.fields.find((f) => f.name === 'age');
      expect(ageField?.isOptional).toBe(true);
    });

    it('should detect fields with @default()', () => {
      const filePath = writeSchema(
        'default-fields',
        `
model User {
  id        String   @id @default(uuid())
  name      String
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
`
      );

      const analysis = analyzePrismaSchema(filePath);
      const userInfo = getModel(analysis, 'User');

      const idField = userInfo.fields.find((f) => f.name === 'id');
      expect(idField?.hasDefault).toBe(true);

      const nameField = userInfo.fields.find((f) => f.name === 'name');
      expect(nameField?.hasDefault).toBe(false);

      const activeField = userInfo.fields.find((f) => f.name === 'active');
      expect(activeField?.hasDefault).toBe(true);

      const createdAtField = userInfo.fields.find((f) => f.name === 'createdAt');
      expect(createdAtField?.hasDefault).toBe(true);

      const updatedAtField = userInfo.fields.find((f) => f.name === 'updatedAt');
      expect(updatedAtField?.hasDefault).toBe(true);
    });
  });

  // ============================================================================
  // prismaFieldToFieldDefinition Tests
  // ============================================================================

  describe('prismaFieldToFieldDefinition', () => {
    it('should convert a basic scalar field', () => {
      const field: PrismaFieldInfo = {
        name: 'email',
        type: 'String',
        isRelation: false,
        isArray: false,
        relatedModel: undefined,
        isOptional: false,
        hasDefault: false,
      };

      const result = prismaFieldToFieldDefinition(field);
      expect(result).toEqual({
        name: 'email',
        type: 'string',
        attributes: { optional: false, unique: false, hasDefault: false },
      });
    });

    it('should map optional and hasDefault correctly', () => {
      const field: PrismaFieldInfo = {
        name: 'bio',
        type: 'String',
        isRelation: false,
        isArray: false,
        relatedModel: undefined,
        isOptional: true,
        hasDefault: true,
      };

      const result = prismaFieldToFieldDefinition(field);
      expect(result).not.toBeNull();
      expect(result?.attributes.optional).toBe(true);
      expect(result?.attributes.hasDefault).toBe(true);
    });

    it('should return null for relation fields', () => {
      const field: PrismaFieldInfo = {
        name: 'author',
        type: 'User',
        isRelation: true,
        isArray: false,
        relatedModel: 'User',
        isOptional: false,
        hasDefault: false,
      };

      expect(prismaFieldToFieldDefinition(field)).toBeNull();
    });

    it('should return null for reserved field names', () => {
      for (const reserved of ['id', 'createdAt', 'updatedAt', 'deletedAt']) {
        const field: PrismaFieldInfo = {
          name: reserved,
          type: 'String',
          isRelation: false,
          isArray: false,
          relatedModel: undefined,
          isOptional: false,
          hasDefault: true,
        };

        expect(prismaFieldToFieldDefinition(field)).toBeNull();
      }
    });

    it('should map Prisma types to FieldType correctly', () => {
      const cases: Array<{ prismaType: string; expectedFieldType: string }> = [
        { prismaType: 'String', expectedFieldType: 'string' },
        { prismaType: 'Int', expectedFieldType: 'int' },
        { prismaType: 'Float', expectedFieldType: 'float' },
        { prismaType: 'Decimal', expectedFieldType: 'float' },
        { prismaType: 'BigInt', expectedFieldType: 'float' },
        { prismaType: 'Boolean', expectedFieldType: 'boolean' },
        { prismaType: 'DateTime', expectedFieldType: 'datetime' },
        { prismaType: 'Json', expectedFieldType: 'json' },
        { prismaType: 'UnknownType', expectedFieldType: 'string' },
      ];

      for (const { prismaType, expectedFieldType } of cases) {
        const field: PrismaFieldInfo = {
          name: 'testField',
          type: prismaType,
          isRelation: false,
          isArray: false,
          relatedModel: undefined,
          isOptional: false,
          hasDefault: false,
        };

        const result = prismaFieldToFieldDefinition(field);
        expect(result?.type).toBe(expectedFieldType);
      }
    });
  });

  // ============================================================================
  // getModelFields Tests
  // ============================================================================

  describe('getModelFields', () => {
    it('should return only scalar non-reserved fields', () => {
      const filePath = writeSchema(
        'model-fields',
        `
model Post {
  id        String   @id @default(uuid())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  author    User
}

model User {
  id   String @id @default(uuid())
  name String
}
`
      );

      const analysis = analyzePrismaSchema(filePath);
      const fields = getModelFields(analysis, 'Post');

      // Should include: title, content, published, authorId
      // Should exclude: id, createdAt, updatedAt (reserved), author (relation)
      expect(fields).toHaveLength(4);

      const names = fields.map((f) => f.name);
      expect(names).toContain('title');
      expect(names).toContain('content');
      expect(names).toContain('published');
      expect(names).toContain('authorId');

      expect(names).not.toContain('id');
      expect(names).not.toContain('createdAt');
      expect(names).not.toContain('updatedAt');
      expect(names).not.toContain('author');
    });

    it('should preserve optionality and default info', () => {
      const filePath = writeSchema(
        'model-fields-attrs',
        `
model Article {
  id        String   @id @default(uuid())
  title     String
  body      String?
  views     Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
`
      );

      const analysis = analyzePrismaSchema(filePath);
      const fields = getModelFields(analysis, 'Article');

      const titleField = fields.find((f) => f.name === 'title');
      expect(titleField?.attributes.optional).toBe(false);
      expect(titleField?.attributes.hasDefault).toBe(false);

      const bodyField = fields.find((f) => f.name === 'body');
      expect(bodyField?.attributes.optional).toBe(true);

      const viewsField = fields.find((f) => f.name === 'views');
      expect(viewsField?.attributes.hasDefault).toBe(true);
      expect(viewsField?.type).toBe('int');
    });

    it('should return empty array for non-existent model', () => {
      const filePath = writeSchema(
        'model-fields-missing',
        `
model User {
  id String @id @default(uuid())
}
`
      );

      const analysis = analyzePrismaSchema(filePath);
      expect(getModelFields(analysis, 'NonExistent')).toEqual([]);
    });
  });
});
