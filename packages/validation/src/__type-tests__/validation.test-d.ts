/**
 * Type tests for @veloxts/validation
 *
 * These tests verify that type inference works correctly for Zod schemas,
 * Schema wrappers, and utility types.
 */

import { expectAssignable, expectType } from 'tsd';
import { z } from 'zod';

// Import from the compiled dist folder directly
import type {
  AnySchema,
  AnyZodSchema,
  InferInput,
  InferOutput,
  NoInput,
  PaginatedResponse,
  PaginationInput,
  PaginationMeta,
  ResolveInput,
  ResolveOutput,
  SafeParseError,
  SafeParseResult,
  SafeParseSuccess,
  Schema,
  SchemaLike,
  UnknownOutput,
  ValidationIssue,
} from '../../dist/index.js';
import {
  createPaginatedResponseSchema,
  createValidator,
  isSchema,
  isZodSchema,
  type paginationInputSchema,
  parse,
  safeParse,
  wrapSchema,
} from '../../dist/index.js';

// ============================================================================
// InferOutput Type Tests
// ============================================================================

// Basic Zod schema inference
const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
});

type User = InferOutput<typeof UserSchema>;
expectType<User>({
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Test',
  email: 'test@example.com',
});

// Complex nested types
const ComplexSchema = z.object({
  user: z.object({
    id: z.string(),
    profile: z.object({
      bio: z.string().optional(),
      avatar: z.string().url().nullable(),
    }),
  }),
  tags: z.array(z.string()),
  metadata: z.record(z.unknown()),
});

type Complex = InferOutput<typeof ComplexSchema>;
expectType<{
  user: {
    id: string;
    profile: {
      bio?: string | undefined;
      avatar: string | null;
    };
  };
  tags: string[];
  metadata: Record<string, unknown>;
}>({} as Complex);

// ============================================================================
// InferInput Type Tests
// ============================================================================

// Schema with transform - input differs from output
const DateSchema = z.string().transform((s) => new Date(s));

type DateInput = InferInput<typeof DateSchema>;
type DateOutput = InferOutput<typeof DateSchema>;

expectType<string>({} as DateInput);
expectType<Date>({} as DateOutput);

// Object with transform
const TransformSchema = z.object({
  dateStr: z.string().transform((s) => new Date(s)),
  count: z.string().transform((s) => parseInt(s, 10)),
});

type TransformInput = InferInput<typeof TransformSchema>;
type TransformOutput = InferOutput<typeof TransformSchema>;

expectType<{ dateStr: string; count: string }>({} as TransformInput);
expectType<{ dateStr: Date; count: number }>({} as TransformOutput);

// ============================================================================
// Schema Wrapper Type Tests
// ============================================================================

// wrapSchema preserves types
const WrappedUser = wrapSchema(UserSchema);
expectAssignable<Schema<User>>({} as typeof WrappedUser);

// Schema has parse and safeParse methods with correct types
expectType<User>(WrappedUser.parse({ id: '123', name: 'Test', email: 'test@example.com' }));
expectType<SafeParseResult<User>>(WrappedUser.safeParse({ id: '123' }));

// Schema with transform preserves both input and output types
const WrappedDate = wrapSchema(DateSchema);
expectAssignable<Schema<Date, string>>({} as typeof WrappedDate);

// ============================================================================
// SafeParseResult Type Tests
// ============================================================================

// SafeParseSuccess type
const success: SafeParseSuccess<User> = { success: true, data: {} as User };
expectType<true>(success.success);
expectType<User>(success.data);

// SafeParseError type
const error: SafeParseError = { success: false, error: [] };
expectType<false>(error.success);
expectType<ValidationIssue[]>(error.error);

// SafeParseResult discriminated union
declare const safeResult: SafeParseResult<User>;
if (safeResult.success) {
  expectType<SafeParseSuccess<User>>(safeResult);
  expectType<User>(safeResult.data);
} else {
  expectType<SafeParseError>(safeResult);
  expectType<ValidationIssue[]>(safeResult.error);
}

// ============================================================================
// ValidationIssue Type Tests
// ============================================================================

const issue: ValidationIssue = {
  path: ['user', 'email'],
  message: 'Invalid email',
  code: 'invalid_string',
};

expectType<readonly (string | number)[]>(issue.path);
expectType<string>(issue.message);
expectType<string>(issue.code);

// ============================================================================
// Type Guard Tests
// ============================================================================

// isSchema type narrowing
declare const maybeSchema: unknown;
if (isSchema(maybeSchema)) {
  expectType<AnySchema>(maybeSchema);
  expectType<(input: unknown) => unknown>(maybeSchema.parse);
  expectType<(input: unknown) => SafeParseResult<unknown>>(maybeSchema.safeParse);
}

// isZodSchema type narrowing
declare const maybeZodSchema: unknown;
if (isZodSchema(maybeZodSchema)) {
  expectType<AnyZodSchema>(maybeZodSchema);
}

// ============================================================================
// SchemaLike Type Tests
// ============================================================================

// SchemaLike accepts both Zod schemas and wrapped schemas
const zodSchema: AnyZodSchema = z.string();
const wrappedSchema: AnySchema = wrapSchema(z.string());

expectAssignable<SchemaLike>(zodSchema);
expectAssignable<SchemaLike>(wrappedSchema);

// ============================================================================
// Utility Type Tests
// ============================================================================

// NoInput type is undefined
declare const noInputValue: NoInput;
expectType<undefined>(noInputValue);

// UnknownOutput type is unknown
declare const unknownOutputValue: UnknownOutput;
expectType<unknown>(unknownOutputValue);

// ResolveInput type - undefined resolves to NoInput (undefined)
type ResolvedUndefined = ResolveInput<undefined>;
type ResolvedUser = ResolveInput<typeof UserSchema>;

declare const resolvedUndefinedValue: ResolvedUndefined;
expectType<undefined>(resolvedUndefinedValue);
expectAssignable<User>({} as ResolvedUser);

// ResolveOutput type - undefined resolves to UnknownOutput (unknown)
type ResolvedOutputUndefined = ResolveOutput<undefined>;
type ResolvedOutputUser = ResolveOutput<typeof UserSchema>;

declare const resolvedOutputUndefinedValue: ResolvedOutputUndefined;
expectType<unknown>(resolvedOutputUndefinedValue);
expectAssignable<User>({} as ResolvedOutputUser);

// ============================================================================
// Middleware Function Types
// ============================================================================

// parse returns correctly typed output
const parsedUser = parse(UserSchema, { id: '123', name: 'Test', email: 'test@example.com' });
expectType<User>(parsedUser);

// safeParse returns SafeParseResult
const safeParsedResult = safeParse(UserSchema, {});
expectType<SafeParseResult<User>>(safeParsedResult);

// createValidator returns Validator with correct methods
const validator = createValidator(UserSchema);
expectType<User>(validator.parse({ id: '123', name: 'Test', email: 'test@example.com' }));
expectType<SafeParseResult<User>>(validator.safeParse({}));

// ============================================================================
// Pagination Types
// ============================================================================

// PaginationInput type - page and limit are optional with defaults
const paginationInput: PaginationInput = { page: 1, limit: 10 };
// Since defaults are applied, the inferred type includes the values
expectAssignable<number>(paginationInput.page);
expectAssignable<number>(paginationInput.limit);

// PaginatedResponse type
type PaginatedUsers = PaginatedResponse<User>;
const paginatedUsers: PaginatedUsers = {
  data: [],
  meta: { page: 1, limit: 10, total: 0, totalPages: 0, hasMore: false },
};
expectType<User[]>(paginatedUsers.data);
expectAssignable<PaginationMeta>(paginatedUsers.meta);

// Schema inference from pagination schemas
type InferredPaginationInput = InferOutput<typeof paginationInputSchema>;
expectAssignable<PaginationInput>({} as InferredPaginationInput);

// createPaginatedResponseSchema preserves item type
const userPaginatedSchema = createPaginatedResponseSchema(UserSchema);
type InferredPaginatedUsers = InferOutput<typeof userPaginatedSchema>;
expectAssignable<PaginatedResponse<User>>({} as InferredPaginatedUsers);

// ============================================================================
// Union and Literal Type Tests
// ============================================================================

// Union types
const StatusSchema = z.union([z.literal('active'), z.literal('inactive'), z.literal('pending')]);
type Status = InferOutput<typeof StatusSchema>;
expectType<'active' | 'inactive' | 'pending'>({} as Status);

// Enum types
const RoleSchema = z.enum(['admin', 'user', 'guest']);
type Role = InferOutput<typeof RoleSchema>;
expectType<'admin' | 'user' | 'guest'>({} as Role);

// Discriminated union
const EventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('click'), x: z.number(), y: z.number() }),
  z.object({ type: z.literal('keypress'), key: z.string() }),
]);
type Event = InferOutput<typeof EventSchema>;

declare const eventValue: Event;
if (eventValue.type === 'click') {
  expectType<number>(eventValue.x);
  expectType<number>(eventValue.y);
} else {
  expectType<string>(eventValue.key);
}

// ============================================================================
// Optional and Nullable Type Tests
// ============================================================================

const OptionalSchema = z.object({
  required: z.string(),
  optional: z.string().optional(),
  nullable: z.string().nullable(),
  optionalNullable: z.string().optional().nullable(),
  defaulted: z.string().default('default'),
});

type Optional = InferOutput<typeof OptionalSchema>;

// For the output type, nullable is required but can be null
const optionalValue: Optional = {
  required: 'required',
  nullable: null,
  defaulted: 'value',
};

expectType<string>(optionalValue.required);
expectType<string | undefined>(optionalValue.optional);
expectType<string | null>(optionalValue.nullable);
expectType<string | null | undefined>(optionalValue.optionalNullable);
expectType<string>(optionalValue.defaulted);

// ============================================================================
// Array and Record Type Tests
// ============================================================================

const ArraySchema = z.array(z.object({ id: z.string() }));
type ArrayType = InferOutput<typeof ArraySchema>;
expectType<{ id: string }[]>({} as ArrayType);

const RecordSchema = z.record(z.string(), z.number());
type RecordType = InferOutput<typeof RecordSchema>;
expectType<Record<string, number>>({} as RecordType);

const TupleSchema = z.tuple([z.string(), z.number(), z.boolean()]);
type TupleType = InferOutput<typeof TupleSchema>;
expectType<[string, number, boolean]>({} as TupleType);
