# @veloxts/validation

Type-safe validation using Zod schemas for VeloxTS Framework.

## Installation

```bash
npm install @veloxts/validation
```

## Quick Start

```typescript
import { z, parse } from '@veloxts/validation';

const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
});

const user = parse(UserSchema, untrustedData);
// user is validated and typed
```

## Validation Functions

### parse()

Parse and validate data, throwing `ValidationError` if invalid:

```typescript
import { parse, ValidationError } from '@veloxts/validation';

try {
  const user = parse(UserSchema, data);
} catch (error) {
  if (error instanceof ValidationError) {
    console.log(error.fields); // Field-specific errors
  }
}
```

### safeParse()

Validate without throwing, returns result object:

```typescript
import { safeParse } from '@veloxts/validation';

const result = safeParse(UserSchema, data);

if (result.success) {
  console.log(result.data);
} else {
  console.log(result.error.issues);
}
```

## Common Schemas

Pre-built schemas for common use cases:

```typescript
import {
  uuidSchema,
  emailSchema,
  urlSchema,
  nonEmptyStringSchema,
  datetimeSchema,
  idParamSchema,
} from '@veloxts/validation';

const id = parse(uuidSchema, '123e4567-...');
const email = parse(emailSchema, 'user@example.com');
const url = parse(urlSchema, 'https://example.com');
const name = parse(nonEmptyStringSchema, '  Alice  '); // "Alice"
```

## Pagination

Built-in pagination support:

```typescript
import {
  paginationInputSchema,
  createPaginatedResponseSchema,
  calculatePaginationMeta,
} from '@veloxts/validation';

const input = parse(paginationInputSchema, {
  page: 1,
  limit: 20, // Default: 10, max: 100
});

const UserListSchema = createPaginatedResponseSchema(UserSchema);

const meta = calculatePaginationMeta({
  page: 1,
  limit: 10,
  total: 95,
});
// { page: 1, limit: 10, total: 95, totalPages: 10, hasNext: true, hasPrev: false }
```

## Schema Utilities

Manipulate schemas:

```typescript
import { pickFields, omitFields, makePartial, partialExcept } from '@veloxts/validation';

const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  password: z.string(),
});

const PublicUserSchema = pickFields(UserSchema, ['id', 'name', 'email']);
const SafeUserSchema = omitFields(UserSchema, ['password']);
const PartialUserSchema = makePartial(UserSchema);
const UpdateSchema = partialExcept(UserSchema, ['id']);
```

## String Coercion

Parse string inputs to other types:

```typescript
import {
  numberStringSchema,
  integerStringSchema,
  booleanStringSchema,
} from '@veloxts/validation';

const age = parse(numberStringSchema, '25'); // 25 (number)
const count = parse(integerStringSchema, '42'); // 42 (number)
const enabled = parse(booleanStringSchema, 'true'); // true (boolean)
```

## Type Inference

Extract TypeScript types from schemas:

```typescript
import { InferInput, InferOutput } from '@veloxts/validation';

const UserSchema = z.object({
  email: z.string().email(),
  age: z.number().transform((n) => n + 1),
});

type UserInput = InferInput<typeof UserSchema>;
// { email: string; age: number }

type UserOutput = InferOutput<typeof UserSchema>;
// { email: string; age: number } (after transform)
```

## Using with Procedures

Validation integrates seamlessly with VeloxTS procedures:

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
      // input is validated and typed
      return ctx.db.user.create({ data: input });
    }),
});
```

## Error Handling

Validation errors include field-level details:

```typescript
import { ValidationError, parse } from '@veloxts/validation';

try {
  parse(UserSchema, invalidData);
} catch (error) {
  if (error instanceof ValidationError) {
    console.log(error.statusCode); // 400
    console.log(error.fields);
    // {
    //   name: "String must contain at least 2 character(s)",
    //   email: "Invalid email"
    // }
  }
}
```

## Learn More

- [@veloxts/core](https://www.npmjs.com/package/@veloxts/core) - Error classes
- [@veloxts/router](https://www.npmjs.com/package/@veloxts/router) - Procedure definitions
- [@veloxts/client](https://www.npmjs.com/package/@veloxts/client) - Type-safe client
- [VeloxTS Framework](https://www.npmjs.com/package/@veloxts/velox) - Complete framework

## License

MIT
