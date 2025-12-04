# @veloxts/validation

Type-safe validation using Zod schemas for the VeloxTS framework.

## Installation

```bash
npm install @veloxts/validation
# or
pnpm add @veloxts/validation
```

Note: Zod is a peer dependency and will be installed automatically if not already present.

## Quick Start

```typescript
import { z, parse, InferOutput } from '@veloxts/validation';

// Define a schema
const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
});

// Infer the TypeScript type
type User = InferOutput<typeof UserSchema>;

// Parse and validate data
const user = parse(UserSchema, {
  id: '123e4567-e89b-012d-3456-426614174000',
  name: 'Alice',
  email: 'alice@example.com',
});
// user is typed as User and validated
```

## Core API

### Validation Functions

#### `parse(schema, data)`

Parses data against a schema and throws a `ValidationError` if invalid.

```typescript
import { parse, ValidationError } from '@veloxts/validation';

try {
  const user = parse(UserSchema, untrustedData);
  // user is valid and typed
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Validation failed:', error.fields);
    // error.fields contains field-specific error messages
  }
}
```

#### `safeParse(schema, data)`

Parses data and returns a result object instead of throwing.

```typescript
import { safeParse } from '@veloxts/validation';

const result = safeParse(UserSchema, untrustedData);

if (result.success) {
  console.log('Valid user:', result.data);
} else {
  console.log('Validation errors:', result.error.issues);
}
```

### Common Schemas

The package provides pre-built schemas for common use cases:

```typescript
import {
  uuidSchema,
  emailSchema,
  urlSchema,
  nonEmptyStringSchema,
  datetimeSchema,
  idParamSchema,
  timestampFieldsSchema,
} from '@veloxts/validation';

// UUID validation
const id = parse(uuidSchema, '123e4567-e89b-012d-3456-426614174000');

// Email validation
const email = parse(emailSchema, 'user@example.com');

// URL validation
const website = parse(urlSchema, 'https://example.com');

// Non-empty string (trimmed, min 1 char)
const name = parse(nonEmptyStringSchema, '  Alice  '); // "Alice"

// ISO datetime string
const timestamp = parse(datetimeSchema, '2025-01-01T00:00:00Z');

// Route parameter validation (e.g., /users/:id)
const params = parse(idParamSchema, { id: '123e4567-...' });

// Standard timestamp fields for entities
const EntitySchema = z.object({
  id: uuidSchema,
  name: nonEmptyStringSchema,
}).merge(timestampFieldsSchema);
```

### Pagination Schemas

Built-in support for offset-based and cursor-based pagination:

```typescript
import {
  paginationInputSchema,
  createPaginatedResponseSchema,
  calculatePaginationMeta,
  PAGINATION_DEFAULTS,
} from '@veloxts/validation';

// Input schema for pagination params
const input = parse(paginationInputSchema, {
  page: 1,
  limit: 20, // default: 10, max: 100
});

// Create a paginated response schema
const UserListSchema = createPaginatedResponseSchema(UserSchema);

// Calculate pagination metadata
const meta = calculatePaginationMeta({
  page: 1,
  limit: 10,
  total: 95,
});
// { page: 1, limit: 10, total: 95, totalPages: 10, hasNext: true, hasPrev: false }

// Use in procedure definitions
export const userProcedures = defineProcedures('users', {
  listUsers: procedure()
    .input(paginationInputSchema)
    .output(UserListSchema)
    .query(async ({ input, ctx }) => {
      const skip = (input.page - 1) * input.limit;
      const [data, total] = await Promise.all([
        ctx.db.user.findMany({ skip, take: input.limit }),
        ctx.db.user.count(),
      ]);

      return {
        data,
        meta: calculatePaginationMeta({
          page: input.page,
          limit: input.limit,
          total,
        }),
      };
    }),
});
```

### Schema Utilities

#### Field Manipulation

```typescript
import { pickFields, omitFields, makePartial, partialExcept } from '@veloxts/validation';

const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  password: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Pick specific fields
const UserPublicSchema = pickFields(UserSchema, ['id', 'name', 'email']);
// { id, name, email }

// Omit fields
const UserWithoutPassword = omitFields(UserSchema, ['password']);
// { id, name, email, createdAt, updatedAt }

// Make all fields optional
const PartialUserSchema = makePartial(UserSchema);
// All fields are optional

// Make all fields optional except specified ones
const UserUpdateSchema = partialExcept(UserSchema, ['id']);
// id is required, all other fields are optional
```

#### Type Guards

```typescript
import { createTypeGuard } from '@veloxts/validation';

const isUser = createTypeGuard(UserSchema);

if (isUser(data)) {
  // data is typed as User
  console.log(data.name);
}
```

### String Coercion Schemas

Useful for parsing query parameters and form data:

```typescript
import {
  numberStringSchema,
  integerStringSchema,
  booleanStringSchema,
} from '@veloxts/validation';

// Parse string to number
const age = parse(numberStringSchema, '25'); // 25 (number)

// Parse string to integer
const count = parse(integerStringSchema, '42'); // 42 (number)

// Parse string to boolean
const enabled = parse(booleanStringSchema, 'true'); // true (boolean)
// Accepts: "true", "false", "1", "0", "yes", "no"
```

## Using with Procedures

Validation schemas integrate seamlessly with VeloxTS procedures:

```typescript
import { procedure, defineProcedures } from '@veloxts/router';
import { z, emailSchema, nonEmptyStringSchema } from '@veloxts/validation';

const CreateUserInput = z.object({
  name: nonEmptyStringSchema,
  email: emailSchema,
  age: z.number().int().min(18).optional(),
});

export const userProcedures = defineProcedures('users', {
  createUser: procedure()
    .input(CreateUserInput)
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      // input is automatically validated and typed
      // { name: string, email: string, age?: number }
      return ctx.db.user.create({ data: input });
    }),
});
```

## Type Inference

The package provides type inference utilities for extracting types from schemas:

```typescript
import { InferInput, InferOutput } from '@veloxts/validation';

const UserSchema = z.object({
  email: z.string().email(),
  age: z.number().transform((n) => n + 1),
});

// Input type (before transformation)
type UserInput = InferInput<typeof UserSchema>;
// { email: string; age: number }

// Output type (after transformation)
type UserOutput = InferOutput<typeof UserSchema>;
// { email: string; age: number } (age is transformed)
```

## Error Handling

Validation errors are automatically formatted with field-level details:

```typescript
import { ValidationError, parse } from '@veloxts/validation';

const UserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  age: z.number().min(18),
});

try {
  parse(UserSchema, {
    name: 'A', // too short
    email: 'invalid', // not an email
    age: 16, // too young
  });
} catch (error) {
  if (error instanceof ValidationError) {
    console.log(error.message); // "Validation failed"
    console.log(error.statusCode); // 400
    console.log(error.fields);
    // {
    //   name: "String must contain at least 2 character(s)",
    //   email: "Invalid email",
    //   age: "Number must be greater than or equal to 18"
    // }
  }
}
```

## Advanced Features

### Custom Validators

Create reusable validation functions:

```typescript
import { createValidator } from '@veloxts/validation';

const validateUser = createValidator(UserSchema);

// Use in middleware or handlers
const user = validateUser(request.body);
```

### Schema Composition

Build complex schemas from simpler ones:

```typescript
import { timestampFieldsSchema, baseEntitySchema } from '@veloxts/validation';
import { z } from 'zod';

const PostSchema = baseEntitySchema.extend({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  authorId: z.string().uuid(),
  published: z.boolean().default(false),
});

// baseEntitySchema includes: id (UUID), createdAt, updatedAt
```

## Configuration

### Pagination Defaults

Customize pagination defaults:

```typescript
import { PAGINATION_DEFAULTS } from '@veloxts/validation';

console.log(PAGINATION_DEFAULTS);
// {
//   page: 1,
//   limit: 10,
//   maxLimit: 100,
// }

// Create custom pagination schema
const customPaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(25), // custom max
});
```

## Best Practices

1. **Define schemas once, reuse everywhere**: Share schemas between frontend and backend for consistent validation.

2. **Use common schemas**: Leverage built-in schemas like `emailSchema`, `uuidSchema` for consistency.

3. **Compose schemas**: Build complex schemas from simpler ones using `.extend()`, `.merge()`, and `.pick()`.

4. **Validate early**: Use `input()` in procedures to validate at the API boundary.

5. **Type inference**: Use `InferOutput` to extract TypeScript types instead of manually defining them.

## Related Packages

- [@veloxts/core](/packages/core) - Core framework with error classes
- [@veloxts/router](/packages/router) - Procedure definitions using validation schemas
- [@veloxts/client](/packages/client) - Type-safe API client with inferred types

## TypeScript Support

All exports are fully typed with comprehensive JSDoc documentation. The package includes type definitions and declaration maps for excellent IDE support.

## License

MIT
