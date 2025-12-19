/**
 * Prompt Templates
 *
 * Reusable prompt templates for common VeloxTS tasks.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Prompt template definition
 */
export interface PromptTemplate {
  /** Unique identifier for the prompt */
  name: string;
  /** Human-readable description */
  description: string;
  /** Template arguments */
  arguments?: PromptArgument[];
  /** The prompt content */
  content: string;
}

/**
 * Prompt argument definition
 */
export interface PromptArgument {
  /** Argument name */
  name: string;
  /** Argument description */
  description: string;
  /** Whether the argument is required */
  required?: boolean;
}

// ============================================================================
// Templates
// ============================================================================

/**
 * Create procedure template
 */
export const CREATE_PROCEDURE: PromptTemplate = {
  name: 'create-procedure',
  description: 'Guide for creating a new VeloxTS procedure',
  arguments: [
    { name: 'entity', description: 'Entity name (e.g., User, Post)', required: true },
    {
      name: 'operations',
      description: 'Operations to include (get, list, create, update, delete)',
    },
  ],
  content: `# Creating a VeloxTS Procedure

## Steps

1. **Define the Zod schema** in \`src/schemas/{entity}.ts\`:
   \`\`\`typescript
   import { z } from '@veloxts/velox';

   export const {Entity}Schema = z.object({
     id: z.string().uuid(),
     // Add your fields here
     createdAt: z.date(),
     updatedAt: z.date(),
   });

   export type {Entity} = z.infer<typeof {Entity}Schema>;

   export const Create{Entity}Schema = {Entity}Schema.omit({
     id: true,
     createdAt: true,
     updatedAt: true,
   });

   export type Create{Entity} = z.infer<typeof Create{Entity}Schema>;
   \`\`\`

2. **Create the procedure** in \`src/procedures/{entities}.ts\`:
   \`\`\`typescript
   import { defineProcedures, procedure, z } from '@veloxts/velox';
   import { {Entity}Schema, Create{Entity}Schema } from '../schemas/{entity}.js';

   export const {entity}Procedures = defineProcedures('{entities}', {
     get{Entity}: procedure()
       .input(z.object({ id: z.string().uuid() }))
       .output({Entity}Schema)
       .query(async ({ input, ctx }) => {
         return ctx.db.{entity}.findUnique({ where: { id: input.id } });
       }),

     list{Entities}: procedure()
       .output(z.array({Entity}Schema))
       .query(async ({ ctx }) => {
         return ctx.db.{entity}.findMany();
       }),

     create{Entity}: procedure()
       .input(Create{Entity}Schema)
       .output({Entity}Schema)
       .mutation(async ({ input, ctx }) => {
         return ctx.db.{entity}.create({ data: input });
       }),
   });
   \`\`\`

3. **Register in index** at \`src/procedures/index.ts\`:
   \`\`\`typescript
   export { {entity}Procedures } from './{entities}.js';
   \`\`\`

## Naming Conventions

| Procedure Name | HTTP Method | Route |
|----------------|-------------|-------|
| get{Entity} | GET | /{entities}/:id |
| list{Entities} | GET | /{entities} |
| create{Entity} | POST | /{entities} |
| update{Entity} | PUT | /{entities}/:id |
| delete{Entity} | DELETE | /{entities}/:id |
`,
};

/**
 * Add validation template
 */
export const ADD_VALIDATION: PromptTemplate = {
  name: 'add-validation',
  description: 'Guide for adding Zod validation to procedures',
  content: `# Adding Validation with Zod

## Common Validation Patterns

### String Validation
\`\`\`typescript
z.string()
  .min(1, 'Required')
  .max(255, 'Too long')
  .email('Invalid email')
  .url('Invalid URL')
  .uuid('Invalid UUID')
  .regex(/pattern/, 'Invalid format')
\`\`\`

### Number Validation
\`\`\`typescript
z.number()
  .int('Must be integer')
  .positive('Must be positive')
  .min(0, 'Must be >= 0')
  .max(100, 'Must be <= 100')
\`\`\`

### Object Validation
\`\`\`typescript
z.object({
  required: z.string(),
  optional: z.string().optional(),
  nullable: z.string().nullable(),
  defaulted: z.string().default('value'),
})
\`\`\`

### Array Validation
\`\`\`typescript
z.array(z.string())
  .min(1, 'At least one item')
  .max(10, 'Too many items')
  .nonempty('Cannot be empty')
\`\`\`

### Enum Validation
\`\`\`typescript
z.enum(['active', 'inactive', 'pending'])
z.nativeEnum(StatusEnum)
\`\`\`

### Union & Intersection
\`\`\`typescript
// Union: one of multiple types
z.union([z.string(), z.number()])

// Discriminated union
z.discriminatedUnion('type', [
  z.object({ type: z.literal('a'), value: z.string() }),
  z.object({ type: z.literal('b'), count: z.number() }),
])
\`\`\`

### Transform & Refine
\`\`\`typescript
// Transform input
z.string().transform(s => s.toLowerCase())

// Custom validation
z.string().refine(
  (val) => isValidSlug(val),
  { message: 'Invalid slug format' }
)
\`\`\`

## Best Practices

1. **Reuse schemas** - Create base schemas and derive others
2. **Use .omit()/.pick()** - Create partial schemas from complete ones
3. **Add error messages** - Always provide clear validation messages
4. **Export types** - Use \`z.infer<typeof Schema>\` for type exports
`,
};

/**
 * Setup authentication template
 */
export const SETUP_AUTH: PromptTemplate = {
  name: 'setup-auth',
  description: 'Guide for setting up authentication in VeloxTS',
  content: `# Setting Up Authentication

## JWT Authentication

### 1. Environment Variables
\`\`\`bash
# .env
JWT_SECRET=<64+ character secret>
JWT_REFRESH_SECRET=<64+ character secret>
\`\`\`

Generate secrets:
\`\`\`bash
openssl rand -base64 64
\`\`\`

### 2. Configure Auth Plugin
\`\`\`typescript
import { authPlugin, jwtManager } from '@veloxts/auth';

const jwt = jwtManager({
  secret: process.env.JWT_SECRET!,
  refreshSecret: process.env.JWT_REFRESH_SECRET!,
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
});

await app.register(authPlugin(jwt));
\`\`\`

### 3. Protect Procedures with Guards
\`\`\`typescript
import { authenticated, hasRole, hasPermission } from '@veloxts/auth';

// Require authentication
const getProfile = procedure()
  .guard(authenticated)
  .query(({ ctx }) => ctx.user);

// Require specific role
const adminDashboard = procedure()
  .guard(hasRole('admin'))
  .query(({ ctx }) => { /* ... */ });

// Require permission
const deletePost = procedure()
  .guard(hasPermission('posts.delete'))
  .mutation(({ ctx, input }) => { /* ... */ });
\`\`\`

### 4. Auth Endpoints
\`\`\`typescript
export const authProcedures = defineProcedures('auth', {
  register: procedure()
    .input(RegisterSchema)
    .output(UserSchema)
    .mutation(async ({ input, ctx }) => {
      const hashedPassword = await hash(input.password);
      return ctx.db.user.create({
        data: { ...input, password: hashedPassword },
      });
    }),

  login: procedure()
    .input(LoginSchema)
    .output(TokensSchema)
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.db.user.findUnique({
        where: { email: input.email },
      });
      if (!user || !await verify(input.password, user.password)) {
        throw VeloxError.unauthorized('Invalid credentials');
      }
      return jwt.generateTokens(user);
    }),
});
\`\`\`

## Available Guards

| Guard | Description |
|-------|-------------|
| \`authenticated\` | Requires logged-in user |
| \`emailVerified\` | Requires verified email |
| \`hasRole(role)\` | Checks user role |
| \`hasPermission(perm)\` | Checks user permission |
| \`allOf(guards)\` | All guards must pass |
| \`anyOf(guards)\` | Any guard must pass |
| \`not(guard)\` | Inverts guard result |
`,
};

/**
 * Error handling template
 */
export const ERROR_HANDLING: PromptTemplate = {
  name: 'error-handling',
  description: 'Guide for error handling in VeloxTS',
  content: `# Error Handling in VeloxTS

## Using VeloxError

VeloxTS provides structured errors with codes, messages, and fix suggestions.

### Factory Methods
\`\`\`typescript
import { VeloxError } from '@veloxts/core';

// Not found (404)
throw VeloxError.notFound('User', userId);

// Validation error (400)
throw VeloxError.validation('Invalid email format');

// Unauthorized (401)
throw VeloxError.unauthorized('Login required');

// Forbidden (403)
throw VeloxError.forbidden('Cannot access this resource');

// Conflict (409)
throw VeloxError.conflict('Email already registered');
\`\`\`

### Custom Errors
\`\`\`typescript
throw new VeloxError({
  code: 'E1006',
  message: 'Custom error message',
  fix: 'Suggested fix for the user',
  details: { additionalContext: 'value' },
});
\`\`\`

## Error Code Categories

| Range | Category |
|-------|----------|
| E1xxx | Core/Runtime |
| E2xxx | Generator |
| E3xxx | Seeding |
| E4xxx | Migration |
| E5xxx | Dev Server |
| E6xxx | Validation |
| E7xxx | Authentication |
| E8xxx | Database |
| E9xxx | Configuration |

## Error Handling Patterns

### In Procedures
\`\`\`typescript
const getUser = procedure()
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: input.id },
    });

    if (!user) {
      throw VeloxError.notFound('User', input.id);
    }

    return user;
  });
\`\`\`

### Global Error Handler
Fastify automatically catches errors and formats them based on the error type.

### JSON Error Response
\`\`\`json
{
  "success": false,
  "error": {
    "code": "E1001",
    "message": "User not found",
    "fix": "Check that the user ID is correct",
    "docsUrl": "https://veloxts.dev/errors/E1001"
  }
}
\`\`\`
`,
};

// ============================================================================
// Registry
// ============================================================================

/**
 * All available prompt templates
 */
export const PROMPT_TEMPLATES: PromptTemplate[] = [
  CREATE_PROCEDURE,
  ADD_VALIDATION,
  SETUP_AUTH,
  ERROR_HANDLING,
];

/**
 * Get a prompt template by name
 */
export function getPromptTemplate(name: string): PromptTemplate | undefined {
  return PROMPT_TEMPLATES.find((t) => t.name === name);
}

/**
 * Render a prompt template with argument substitution
 *
 * Supports the following placeholder transformations:
 * - {arg} - lowercase (e.g., "user")
 * - {Arg} - PascalCase (e.g., "User")
 * - {args} - lowercase plural (e.g., "users")
 * - {Args} - PascalCase plural (e.g., "Users")
 *
 * @param name - Template name
 * @param args - Argument values as key-value pairs
 * @returns Rendered content or undefined if template not found
 */
export function renderPromptTemplate(
  name: string,
  args: Record<string, string>
): string | undefined {
  const template = getPromptTemplate(name);
  if (!template) return undefined;

  let content = template.content;

  for (const [key, value] of Object.entries(args)) {
    // Skip empty values
    if (!value) continue;

    const lower = value.toLowerCase();
    const pascal = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
    // Simple pluralization (add 's' or 'es')
    const pluralize = (s: string) => {
      if (
        s.endsWith('s') ||
        s.endsWith('x') ||
        s.endsWith('z') ||
        s.endsWith('ch') ||
        s.endsWith('sh')
      ) {
        return `${s}es`;
      }
      return `${s}s`;
    };

    // Replace all variations of the placeholder
    // {key} - lowercase
    content = content.replace(new RegExp(`\\{${key}\\}`, 'g'), lower);
    // {Key} - PascalCase
    const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
    content = content.replace(new RegExp(`\\{${pascalKey}\\}`, 'g'), pascal);
    // {keys} - lowercase plural (when key ends without 's')
    content = content.replace(new RegExp(`\\{${key}s\\}`, 'g'), pluralize(lower));
    // {Keys} - PascalCase plural
    content = content.replace(new RegExp(`\\{${pascalKey}s\\}`, 'g'), pluralize(pascal));
  }

  return content;
}

/**
 * List all available prompts
 */
export function listPromptTemplates(): { name: string; description: string }[] {
  return PROMPT_TEMPLATES.map((t) => ({
    name: t.name,
    description: t.description,
  }));
}
