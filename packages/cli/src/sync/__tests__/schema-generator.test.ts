/**
 * Sync Schema Generator - Unit Tests
 *
 * Tests for `generateSchemaFile()` which produces TypeScript source
 * strings for Zod schema files from a `SchemaFilePlan`.
 */

import { describe, expect, it } from 'vitest';

import type { SchemaFilePlan, SyncFieldInfo, SyncModelInfo, SyncRelationInfo } from '../types.js';
import { generateSchemaFile } from '../schema-generator.js';

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
	foreignKey?: string,
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
const publishedField = field({ name: 'published', type: 'Boolean' });
const viewCountField = field({ name: 'viewCount', type: 'Int' });
const ratingField = field({ name: 'rating', type: 'Float' });
const metadataField = field({ name: 'metadata', type: 'Json' });

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

const categoryIdField = field({
	name: 'categoryId',
	type: 'String',
});

const emailField = field({
	name: 'email',
	type: 'String',
	isUnique: true,
});

const passwordField = field({
	name: 'password',
	type: 'String',
	isSensitive: true,
});

const bioField = field({
	name: 'bio',
	type: 'String',
	isOptional: true,
});

// ── Common models ─────────────────────────────────────

const postModel: SyncModelInfo = {
	name: 'Post',
	fields: [
		idField,
		contentField,
		authorIdField,
		field({ name: 'wallId', type: 'String', isOptional: true }),
		createdAtField,
		updatedAtField,
	],
	relations: [
		relation('author', 'User', 'belongsTo', 'authorId'),
		relation('comments', 'Comment', 'hasMany'),
	],
	isJoinTable: false,
	hasTimestamps: true,
	uniqueConstraints: [],
};

const userModel: SyncModelInfo = {
	name: 'User',
	fields: [idField, field({ name: 'name', type: 'String' }), emailField, passwordField, createdAtField, updatedAtField],
	relations: [],
	isJoinTable: false,
	hasTimestamps: true,
	uniqueConstraints: [],
};

// ── Helper to build a SchemaFilePlan ──────────────────

function makePlan(overrides: Partial<SchemaFilePlan> & { model: SyncModelInfo }): SchemaFilePlan {
	const model = overrides.model;
	const allFields = overrides.allFields ?? model.fields;
	const inputFields = overrides.fields ??
		[...model.fields].filter((f) => !f.isAutoManaged && !f.isSensitive);
	return {
		outputPath: overrides.outputPath ?? '/tmp/test/src/schemas/post.schema.ts',
		outputStrategy: overrides.outputStrategy ?? 'output',
		fields: inputFields,
		allFields,
		relations: overrides.relations ?? model.relations,
		fieldVisibility: overrides.fieldVisibility ?? undefined,
		action: overrides.action ?? 'create',
		model,
	};
}

// ============================================================================
// Tests
// ============================================================================

describe('generateSchemaFile', () => {
	// --------------------------------------------------------------------------
	// 1. Basic .output() schema structure
	// --------------------------------------------------------------------------
	it('generates a valid .output() schema with z.object and correct imports', () => {
		const plan = makePlan({ model: postModel });
		const output = generateSchemaFile(plan);

		expect(output).toContain("import { z } from 'zod';");
		expect(output).toContain('export const PostSchema = z.object({');
		expect(output).toContain('export const CreatePostSchema = z.object({');
		expect(output).toContain('export const UpdatePostSchema = z.object({');
		expect(output).toContain('export const ListPostsSchema = z.object({');
	});

	// --------------------------------------------------------------------------
	// 2. Prisma type mapping
	// --------------------------------------------------------------------------
	it('maps Prisma types to correct Zod schemas', () => {
		const model: SyncModelInfo = {
			name: 'Article',
			fields: [
				idField,
				titleField,
				viewCountField,
				publishedField,
				createdAtField,
				metadataField,
				ratingField,
			],
			relations: [],
			isJoinTable: false,
			hasTimestamps: true,
			uniqueConstraints: [],
		};

		const plan = makePlan({ model });
		const output = generateSchemaFile(plan);

		// String -> z.string()
		expect(output).toContain('title: z.string(),');
		// Int -> z.number().int()
		expect(output).toContain('viewCount: z.number().int(),');
		// Boolean -> z.boolean()
		expect(output).toContain('published: z.boolean(),');
		// DateTime -> z.date()
		expect(output).toContain('createdAt: z.date(),');
		// Json -> z.record(z.string(), z.unknown())
		expect(output).toContain('metadata: z.record(z.string(), z.unknown()),');
		// Float -> z.number()
		expect(output).toContain('rating: z.number(),');
	});

	// --------------------------------------------------------------------------
	// 3. UUID id field
	// --------------------------------------------------------------------------
	it('generates z.string().uuid() for id fields with uuid() default', () => {
		const plan = makePlan({ model: postModel });
		const output = generateSchemaFile(plan);

		expect(output).toContain('id: z.string().uuid(),');
	});

	// --------------------------------------------------------------------------
	// 4. Email field
	// --------------------------------------------------------------------------
	it('generates z.string().email() for unique email fields', () => {
		const plan = makePlan({ model: userModel });
		const output = generateSchemaFile(plan);

		expect(output).toContain('email: z.string().email(),');
	});

	// --------------------------------------------------------------------------
	// 5. Nullable fields
	// --------------------------------------------------------------------------
	it('appends .nullable() for optional fields in base schema', () => {
		const plan = makePlan({ model: postModel });
		const output = generateSchemaFile(plan);

		expect(output).toContain('wallId: z.string().nullable(),');
	});

	// --------------------------------------------------------------------------
	// 6. CreateSchema excludes auto-managed fields
	// --------------------------------------------------------------------------
	it('excludes auto-managed fields (id, createdAt, updatedAt) from CreateSchema', () => {
		const plan = makePlan({ model: postModel });
		const output = generateSchemaFile(plan);

		// Extract CreateSchema block
		const createStart = output.indexOf('export const CreatePostSchema');
		const createEnd = output.indexOf('});', createStart) + 3;
		const createBlock = output.slice(createStart, createEnd);

		expect(createBlock).not.toContain('id:');
		expect(createBlock).not.toContain('createdAt:');
		expect(createBlock).not.toContain('updatedAt:');
	});

	// --------------------------------------------------------------------------
	// 7. CreateSchema excludes user FK fields
	// --------------------------------------------------------------------------
	it('excludes user foreign key fields from CreateSchema', () => {
		const plan = makePlan({ model: postModel });
		const output = generateSchemaFile(plan);

		const createStart = output.indexOf('export const CreatePostSchema');
		const createEnd = output.indexOf('});', createStart) + 3;
		const createBlock = output.slice(createStart, createEnd);

		expect(createBlock).not.toContain('authorId');
	});

	// --------------------------------------------------------------------------
	// 8. CreateSchema includes non-user FK fields
	// --------------------------------------------------------------------------
	it('includes non-user foreign key fields in CreateSchema', () => {
		const model: SyncModelInfo = {
			name: 'Comment',
			fields: [
				idField,
				contentField,
				categoryIdField,
				authorIdField,
				createdAtField,
			],
			relations: [],
			isJoinTable: false,
			hasTimestamps: true,
			uniqueConstraints: [],
		};

		const plan = makePlan({ model });
		const output = generateSchemaFile(plan);

		const createStart = output.indexOf('export const CreateCommentSchema');
		const createEnd = output.indexOf('});', createStart) + 3;
		const createBlock = output.slice(createStart, createEnd);

		expect(createBlock).toContain('categoryId');
		expect(createBlock).not.toContain('authorId');
	});

	// --------------------------------------------------------------------------
	// 9. UpdateSchema: all fields are optional
	// --------------------------------------------------------------------------
	it('makes all fields optional in UpdateSchema', () => {
		const model: SyncModelInfo = {
			name: 'Post',
			fields: [
				idField,
				contentField,
				field({ name: 'wallId', type: 'String', isOptional: true }),
				createdAtField,
			],
			relations: [],
			isJoinTable: false,
			hasTimestamps: true,
			uniqueConstraints: [],
		};

		const plan = makePlan({ model });
		const output = generateSchemaFile(plan);

		const updateStart = output.indexOf('export const UpdatePostSchema');
		const updateEnd = output.indexOf('});', updateStart) + 3;
		const updateBlock = output.slice(updateStart, updateEnd);

		// Non-nullable field should have .optional()
		expect(updateBlock).toContain('content: z.string().min(1).optional(),');
		// Nullable field should have .nullable().optional()
		expect(updateBlock).toContain('wallId: z.string().nullable().optional(),');
	});

	// --------------------------------------------------------------------------
	// 10. ListSchema has page and perPage with defaults
	// --------------------------------------------------------------------------
	it('generates ListSchema with page and perPage defaults', () => {
		const plan = makePlan({ model: postModel });
		const output = generateSchemaFile(plan);

		expect(output).toContain('export const ListPostsSchema = z.object({');
		expect(output).toContain('page: z.number().int().positive().optional().default(1),');
		expect(output).toContain('perPage: z.number().int().min(1).max(100).optional().default(20),');
	});

	// --------------------------------------------------------------------------
	// 11. WithRelationsSchema generated when relations exist (output strategy)
	// --------------------------------------------------------------------------
	it('generates WithRelationsSchema when relations exist with output strategy', () => {
		const plan = makePlan({ model: postModel });
		const output = generateSchemaFile(plan);

		expect(output).toContain('export const PostWithRelationsSchema = PostSchema.extend({');
		// belongsTo -> z.object
		expect(output).toContain('author: z.object({ id: z.string() }),');
		// hasMany -> z.array
		expect(output).toContain('comments: z.array(z.object({ id: z.string() })),');
	});

	// --------------------------------------------------------------------------
	// 12. No WithRelationsSchema when no relations
	// --------------------------------------------------------------------------
	it('does not generate WithRelationsSchema when model has no relations', () => {
		const model: SyncModelInfo = {
			name: 'Tag',
			fields: [idField, field({ name: 'label', type: 'String' })],
			relations: [],
			isJoinTable: false,
			hasTimestamps: false,
			uniqueConstraints: [],
		};

		const plan = makePlan({ model });
		const output = generateSchemaFile(plan);

		expect(output).not.toContain('WithRelationsSchema');
	});

	// --------------------------------------------------------------------------
	// 13. Resource schema imports resourceSchema from @veloxts/router
	// --------------------------------------------------------------------------
	it('imports resourceSchema from @veloxts/router for resource strategy', () => {
		const plan = makePlan({
			model: postModel,
			outputStrategy: 'resource',
			fieldVisibility: new Map([
				['id', 'public'],
				['content', 'authenticated'],
				['authorId', 'admin'],
			]),
		});
		const output = generateSchemaFile(plan);

		expect(output).toContain("import { resourceSchema } from '@veloxts/router';");
	});

	// --------------------------------------------------------------------------
	// 14. Resource schema uses builder with visibility tiers
	// --------------------------------------------------------------------------
	it('generates resource schema using builder pattern with visibility levels', () => {
		const visibility = new Map<string, 'public' | 'authenticated' | 'admin'>([
			['id', 'public'],
			['content', 'authenticated'],
			['authorId', 'admin'],
			['wallId', 'public'],
			['createdAt', 'public'],
			['updatedAt', 'public'],
		]);

		const plan = makePlan({
			model: postModel,
			outputStrategy: 'resource',
			fieldVisibility: visibility,
		});
		const output = generateSchemaFile(plan);

		expect(output).toContain("export const PostSchema = resourceSchema()");
		expect(output).toContain(".public('id', z.string().uuid())");
		expect(output).toContain(".authenticated('content', z.string())");
		expect(output).toContain(".admin('authorId', z.string())");
	});

	// --------------------------------------------------------------------------
	// 15. Resource schema ends with .build()
	// --------------------------------------------------------------------------
	it('terminates resource schema with .build()', () => {
		const plan = makePlan({
			model: postModel,
			outputStrategy: 'resource',
			fieldVisibility: new Map([['id', 'public']]),
		});
		const output = generateSchemaFile(plan);

		expect(output).toContain('.build();');
	});

	// --------------------------------------------------------------------------
	// 16. Sensitive fields excluded from base schema
	// --------------------------------------------------------------------------
	it('excludes sensitive fields (e.g., password) from the base schema', () => {
		const plan = makePlan({ model: userModel });
		const output = generateSchemaFile(plan);

		// password should not appear anywhere in the base schema
		const baseStart = output.indexOf('export const UserSchema = z.object({');
		const baseEnd = output.indexOf('});', baseStart) + 3;
		const baseBlock = output.slice(baseStart, baseEnd);

		expect(baseBlock).not.toContain('password');
	});

	// --------------------------------------------------------------------------
	// Additional: resource strategy does not generate WithRelationsSchema
	// --------------------------------------------------------------------------
	it('does not generate WithRelationsSchema for resource strategy', () => {
		const plan = makePlan({
			model: postModel,
			outputStrategy: 'resource',
			fieldVisibility: new Map([['id', 'public']]),
		});
		const output = generateSchemaFile(plan);

		expect(output).not.toContain('WithRelationsSchema');
	});

	// --------------------------------------------------------------------------
	// Additional: fields with no visibility map default to public
	// --------------------------------------------------------------------------
	it('defaults fields to public visibility when no visibility map provided', () => {
		const plan = makePlan({
			model: postModel,
			outputStrategy: 'resource',
			fieldVisibility: undefined,
		});
		const output = generateSchemaFile(plan);

		// All fields should use .public()
		expect(output).toContain(".public('id',");
		expect(output).toContain(".public('content',");
		expect(output).not.toContain('.authenticated(');
		expect(output).not.toContain('.admin(');
	});

	// --------------------------------------------------------------------------
	// Additional: output strategy does not import resourceSchema
	// --------------------------------------------------------------------------
	it('does not import resourceSchema for output strategy', () => {
		const plan = makePlan({ model: postModel, outputStrategy: 'output' });
		const output = generateSchemaFile(plan);

		expect(output).not.toContain('resourceSchema');
	});

	// --------------------------------------------------------------------------
	// Additional: nullable fields in Create schema get .nullable().optional()
	// --------------------------------------------------------------------------
	it('generates .nullable().optional() for nullable fields in CreateSchema', () => {
		const plan = makePlan({ model: postModel });
		const output = generateSchemaFile(plan);

		const createStart = output.indexOf('export const CreatePostSchema');
		const createEnd = output.indexOf('});', createStart) + 3;
		const createBlock = output.slice(createStart, createEnd);

		expect(createBlock).toContain('wallId: z.string().nullable().optional(),');
	});

	// --------------------------------------------------------------------------
	// Additional: BigInt and Decimal map to z.number()
	// --------------------------------------------------------------------------
	it('maps BigInt and Decimal to z.number()', () => {
		const model: SyncModelInfo = {
			name: 'Payment',
			fields: [
				idField,
				field({ name: 'amount', type: 'Decimal' }),
				field({ name: 'bigValue', type: 'BigInt' }),
			],
			relations: [],
			isJoinTable: false,
			hasTimestamps: false,
			uniqueConstraints: [],
		};

		const plan = makePlan({ model });
		const output = generateSchemaFile(plan);

		expect(output).toContain('amount: z.number(),');
		expect(output).toContain('bigValue: z.number(),');
	});

	// --------------------------------------------------------------------------
	// Additional: hasOne relation generates z.object (not z.array)
	// --------------------------------------------------------------------------
	it('generates z.object for hasOne relations in WithRelationsSchema', () => {
		const model: SyncModelInfo = {
			name: 'User',
			fields: [idField, field({ name: 'name', type: 'String' })],
			relations: [relation('profile', 'Profile', 'hasOne')],
			isJoinTable: false,
			hasTimestamps: false,
			uniqueConstraints: [],
		};

		const plan = makePlan({ model });
		const output = generateSchemaFile(plan);

		expect(output).toContain('profile: z.object({ id: z.string() }),');
		expect(output).not.toContain('z.array(z.object({ id: z.string() }))');
	});

	// --------------------------------------------------------------------------
	// Additional: String fields in Create get .min(1) but not for id/email
	// --------------------------------------------------------------------------
	it('adds .min(1) to non-id non-email string fields in CreateSchema', () => {
		const plan = makePlan({ model: postModel });
		const output = generateSchemaFile(plan);

		const createStart = output.indexOf('export const CreatePostSchema');
		const createEnd = output.indexOf('});', createStart) + 3;
		const createBlock = output.slice(createStart, createEnd);

		expect(createBlock).toContain('content: z.string().min(1),');
	});
});
