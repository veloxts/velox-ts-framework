# @veloxts/cli

> **Alpha Release** - This framework is in early development. APIs may change between versions. Not recommended for production use yet.

Command-line interface for the VeloxTS Framework.

## Installation

The CLI is installed automatically when you create a new VeloxTS project:

```bash
npx create-velox-app my-app
cd my-app
```

Or add it to an existing project:

```bash
npm install -D @veloxts/cli
# or
pnpm add -D @veloxts/cli
```

## Commands

### `velox dev`

Start the development server with hot reload.

```bash
velox dev
```

**Options:**

- `-p, --port <port>` - Port to listen on (default: 3030)
- `-H, --host <host>` - Host to bind to (default: localhost)
- `-e, --entry <file>` - Entry point file (auto-detected if not specified)

**Examples:**

```bash
# Start on default port 3030
velox dev

# Start on custom port
velox dev --port 8080

# Specify custom entry point
velox dev --entry src/main.ts
```

### `velox migrate`

Run database migrations using Prisma.

```bash
velox migrate <subcommand>
```

**Subcommands:**

- `velox migrate status` - Show migration status
- `velox migrate run` - Run pending migrations
- `velox migrate rollback` - Rollback migrations
- `velox migrate fresh` - Drop all tables and re-run migrations
- `velox migrate reset` - Rollback all then re-run migrations

**Examples:**

```bash
# Check migration status
velox migrate status

# Run pending migrations
velox migrate run

# Development mode (create migration from schema changes)
velox migrate run --dev

# Rollback last migration
velox migrate rollback

# Rollback last 3 migrations
velox migrate rollback --step 3

# Fresh start (drop all, re-migrate)
velox migrate fresh
```

### `velox db:seed`

Run database seeders to populate your database with initial or test data.

```bash
velox db:seed [seeder]
```

**Options:**

- `--fresh` - Truncate tables before seeding
- `--class <name>` - Run specific seeder class
- `--force` - Run in production without confirmation
- `--dry-run` - Show what would run without executing
- `--verbose` - Show detailed output
- `--json` - Output as JSON

**Examples:**

```bash
# Run all seeders
velox db:seed

# Run specific seeder
velox db:seed UserSeeder

# Truncate and re-seed
velox db:seed --fresh

# Preview what would run
velox db:seed --dry-run
```

### `velox make`

Scaffold code files from templates.

```bash
velox make <type> <name> [options]
velox m <type> <name> [options]
```

**Available generators:**

- `procedure` (alias: `p`) - Scaffold a procedure file
- `model` - Scaffold a Prisma model
- `migration` - Scaffold a migration file
- `schema` (alias: `s`) - Scaffold a Zod schema
- `test` (alias: `t`) - Scaffold a test file
- `resource` (alias: `r`) - Scaffold full resource (model + procedure + schema + test)
- `seeder` (alias: `seed`) - Scaffold a database seeder
- `factory` (alias: `f`) - Scaffold a model factory

**Examples:**

```bash
# Scaffold a procedure
velox make procedure users
velox m p users --crud

# Scaffold a resource (all files)
velox make resource post

# Scaffold a seeder
velox make seeder user
velox m seed user --factory

# Scaffold a factory
velox make factory user
```

## Database Seeding

### Overview

Database seeding is a mechanism for populating your database with initial or test data. VeloxTS provides a powerful seeding system with two key abstractions:

- **Seeders**: Classes that contain logic for inserting data into your database
- **Factories**: Reusable fake data generators with state management

Use seeders for:
- Setting up initial application data (default roles, admin users)
- Populating development databases with realistic test data
- Creating consistent test fixtures for automated testing
- Generating demo data for presentations or examples

The seeding system features:
- Dependency resolution (seeders run in the correct order)
- Environment filtering (development-only or production-safe seeders)
- Type-safe factory API with fluent state modifiers
- Automatic seeder discovery from the filesystem
- Truncation support for fresh seeding

### Creating Seeders

Scaffold a new seeder using the CLI:

```bash
velox make seeder user
```

This creates `src/database/seeders/UserSeeder.ts`:

```typescript
import type { Seeder, SeederContext } from '@veloxts/cli';

export const UserSeeder: Seeder = {
  name: 'UserSeeder',

  // Seeders that must run before this one
  dependencies: [],

  // Environments to run in (omit to run in all)
  environments: ['development', 'test'],

  async run({ db, factory, log }) {
    log.info('Seeding users...');

    // Insert data using Prisma
    await db.user.createMany({
      data: [
        { email: 'admin@example.com', name: 'Admin User', role: 'admin' },
        { email: 'user@example.com', name: 'Regular User', role: 'user' },
      ],
    });

    log.success('Created 2 users');
  },

  // Optional: Truncate tables before seeding (for --fresh flag)
  async truncate({ db, log }) {
    log.info('Truncating users table...');
    await db.user.deleteMany();
  },
};
```

#### Seeder Interface

All seeders must implement the `Seeder` interface:

```typescript
interface Seeder {
  /** Unique seeder name (e.g., 'UserSeeder') */
  readonly name: string;

  /** Seeders that must run before this one */
  readonly dependencies?: ReadonlyArray<string>;

  /** Environments this seeder runs in (omit to run in all) */
  readonly environments?: ReadonlyArray<'development' | 'production' | 'test'>;

  /** Populate data */
  run(context: SeederContext): Promise<void>;

  /** Optional: Truncate tables before seeding */
  truncate?(context: SeederContext): Promise<void>;
}
```

#### Seeder Context

The `run()` and `truncate()` methods receive a context object with:

```typescript
interface SeederContext {
  /** Prisma client for database operations */
  readonly db: PrismaClientLike;

  /** Factory registry for creating fake data */
  readonly factory: FactoryRegistry;

  /** Current environment (development, production, test) */
  readonly environment: Environment;

  /** Logger for seeder output */
  readonly log: SeederLogger;

  /** Run another seeder (for composition) */
  runSeeder(seeder: Seeder): Promise<void>;
}
```

**Logger methods:**
- `log.info(message)` - Informational message
- `log.success(message)` - Success message (with checkmark)
- `log.warning(message)` - Warning message (with warning icon)
- `log.error(message)` - Error message (with X icon)
- `log.debug(message)` - Debug message (only shown with --verbose)

### Creating Factories

Factories generate fake data using the `@faker-js/faker` library. Scaffold a factory with:

```bash
velox make factory user
```

This creates `src/database/factories/UserFactory.ts`:

```typescript
import { BaseFactory, type PrismaClientLike } from '@veloxts/cli';
import { faker } from '@faker-js/faker';

// Define input type matching your Prisma model
export interface UserInput {
  email: string;
  name: string;
  role: 'admin' | 'user';
  emailVerified: Date | null;
}

export class UserFactory extends BaseFactory<UserInput> {
  // Model name must match Prisma schema (lowercase)
  readonly modelName = 'user';

  constructor(prisma: PrismaClientLike) {
    super(prisma);

    // Register named states for variations
    this.registerState('admin', (attrs) => ({
      ...attrs,
      role: 'admin',
    }));

    this.registerState('verified', (attrs) => ({
      ...attrs,
      emailVerified: new Date(),
    }));

    this.registerState('unverified', (attrs) => ({
      ...attrs,
      emailVerified: null,
    }));
  }

  // Define default attributes
  definition(): UserInput {
    return {
      email: faker.internet.email(),
      name: faker.person.fullName(),
      role: 'user',
      emailVerified: faker.date.recent(),
    };
  }
}
```

#### Factory API

The `BaseFactory` class provides a fluent API for creating data:

**Creating Records:**
```typescript
// Create a single record in the database
const user = await factory.get(UserFactory).create();

// Create with overrides
const admin = await factory.get(UserFactory).create({
  email: 'admin@example.com',
  role: 'admin',
});

// Create multiple records
const users = await factory.get(UserFactory).createMany(10);

// Create multiple with overrides
const admins = await factory.get(UserFactory).createMany(3, {
  role: 'admin',
});
```

**Making Records (without persisting):**
```typescript
// Generate attributes without saving to database
const userData = factory.get(UserFactory).make();

// Make with overrides
const adminData = factory.get(UserFactory).make({
  role: 'admin',
});

// Make multiple
const usersData = factory.get(UserFactory).makeMany(5);
```

**Using States:**
```typescript
// Apply a named state
const admin = await factory.get(UserFactory).state('admin').create();

// Chain multiple states
const verifiedAdmin = await factory.get(UserFactory)
  .state('admin')
  .state('verified')
  .create();

// States with createMany
const admins = await factory.get(UserFactory)
  .state('admin')
  .createMany(5);
```

#### State Modifiers

States modify attributes to create variations of the base definition:

```typescript
class PostFactory extends BaseFactory<PostInput> {
  readonly modelName = 'post';

  constructor(prisma: PrismaClientLike) {
    super(prisma);

    // Published state
    this.registerState('published', (attrs) => ({
      ...attrs,
      status: 'published',
      publishedAt: new Date(),
    }));

    // Draft state
    this.registerState('draft', (attrs) => ({
      ...attrs,
      status: 'draft',
      publishedAt: null,
    }));

    // Featured state
    this.registerState('featured', (attrs) => ({
      ...attrs,
      featured: true,
    }));
  }

  definition(): PostInput {
    return {
      title: faker.lorem.sentence(),
      content: faker.lorem.paragraphs(3),
      status: 'draft',
      publishedAt: null,
      featured: false,
      authorId: '', // Set via override or relationship
    };
  }
}

// Usage: Create a published featured post
const post = await factory.get(PostFactory)
  .state('published')
  .state('featured')
  .create({ authorId: user.id });
```

States are applied in order, and overrides are applied last:

```
definition() → state('admin') → state('verified') → create({ email: '...' })
```

### Using Factories in Seeders

Factories shine when creating large amounts of realistic data:

```typescript
import type { Seeder, SeederContext } from '@veloxts/cli';
import { UserFactory } from '../factories/UserFactory.js';
import { PostFactory } from '../factories/PostFactory.js';

export const UserSeeder: Seeder = {
  name: 'UserSeeder',

  async run({ factory, log }) {
    // Create 50 regular users
    const users = await factory.get(UserFactory).createMany(50);
    log.success('Created 50 regular users');

    // Create 5 admin users
    const admins = await factory.get(UserFactory)
      .state('admin')
      .createMany(5);
    log.success('Created 5 admin users');

    // Create specific user with factory defaults
    const specificUser = await factory.get(UserFactory).create({
      email: 'john@example.com',
      name: 'John Doe',
    });
    log.success('Created specific user');

    // Create posts for each user
    for (const user of users.slice(0, 10)) {
      await factory.get(PostFactory)
        .state('published')
        .createMany(3, { authorId: user.id });
    }
    log.success('Created posts for 10 users');
  },
};
```

### Seeder Dependencies

Seeders often depend on data from other seeders. Use the `dependencies` array to ensure correct execution order:

```typescript
// src/database/seeders/UserSeeder.ts
export const UserSeeder: Seeder = {
  name: 'UserSeeder',
  dependencies: [], // No dependencies

  async run({ factory, log }) {
    await factory.get(UserFactory).createMany(10);
    log.success('Created users');
  },
};

// src/database/seeders/PostSeeder.ts
export const PostSeeder: Seeder = {
  name: 'PostSeeder',
  dependencies: ['UserSeeder'], // Requires users to exist

  async run({ db, factory, log }) {
    // Users are guaranteed to exist
    const users = await db.user.findMany();

    for (const user of users) {
      await factory.get(PostFactory).createMany(5, {
        authorId: user.id,
      });
    }

    log.success(`Created posts for ${users.length} users`);
  },
};

// src/database/seeders/CommentSeeder.ts
export const CommentSeeder: Seeder = {
  name: 'CommentSeeder',
  dependencies: ['UserSeeder', 'PostSeeder'], // Requires both

  async run({ db, factory, log }) {
    const users = await db.user.findMany();
    const posts = await db.post.findMany();

    for (const post of posts) {
      const randomUser = users[Math.floor(Math.random() * users.length)];
      await factory.get(CommentFactory).createMany(3, {
        postId: post.id,
        authorId: randomUser.id,
      });
    }

    log.success('Created comments');
  },
};
```

The seeder runner uses **topological sorting** to determine execution order:
1. UserSeeder runs first (no dependencies)
2. PostSeeder runs second (depends on UserSeeder)
3. CommentSeeder runs last (depends on both)

If you run `velox db:seed PostSeeder`, the runner automatically includes UserSeeder.

### Environment-Specific Seeders

Use the `environments` array to control where seeders run:

```typescript
// Production-safe seeder (default roles, settings)
export const RoleSeeder: Seeder = {
  name: 'RoleSeeder',
  // Runs in all environments (no filter)

  async run({ db, log }) {
    await db.role.createMany({
      data: [
        { name: 'admin', permissions: ['*'] },
        { name: 'user', permissions: ['read'] },
      ],
    });
    log.success('Created default roles');
  },
};

// Development/test-only seeder (fake data)
export const TestDataSeeder: Seeder = {
  name: 'TestDataSeeder',
  environments: ['development', 'test'], // Skip in production
  dependencies: ['RoleSeeder', 'UserSeeder'],

  async run({ factory, log }) {
    // Create 1000 test users (too much for production)
    await factory.get(UserFactory).createMany(1000);
    log.success('Created test data');
  },
};

// Production-only seeder
export const ProductionSetupSeeder: Seeder = {
  name: 'ProductionSetupSeeder',
  environments: ['production'],

  async run({ db, log }) {
    // Production-specific initialization
    await db.settings.create({
      data: { maintenanceMode: false },
    });
    log.success('Production setup complete');
  },
};
```

The environment is detected from `NODE_ENV`:
- `NODE_ENV=production` → `'production'`
- `NODE_ENV=test` → `'test'`
- Otherwise → `'development'`

### Using the Factory Registry

The factory registry caches instances to avoid recreating them:

```typescript
async run({ factory, log }) {
  // Get or create factory instance (cached)
  const userFactory = factory.get(UserFactory);

  // Same instance returned on subsequent calls
  const sameFactory = factory.get(UserFactory);

  // Create records
  await userFactory.createMany(10);

  // Get different factory
  const postFactory = factory.get(PostFactory);
  await postFactory.create();
}
```

The registry is scoped to the seeder run, so each `velox db:seed` command gets fresh factory instances.

### Running Seeders

#### Basic Usage

```bash
# Run all seeders in dependency order
velox db:seed

# Run specific seeder (includes its dependencies)
velox db:seed UserSeeder

# Run multiple specific seeders
velox db:seed UserSeeder PostSeeder
```

#### Fresh Seeding

Truncate tables before seeding (calls `truncate()` method in reverse order):

```bash
# Fresh seed all
velox db:seed --fresh

# Fresh seed specific seeder
velox db:seed UserSeeder --fresh
```

**Important:** When using `--fresh`, truncation happens in **reverse dependency order** to handle foreign key constraints:
1. CommentSeeder.truncate() (depends on posts/users)
2. PostSeeder.truncate() (depends on users)
3. UserSeeder.truncate() (no dependencies)

Then seeding runs in normal order.

#### Other Options

```bash
# Dry run - show what would execute without running
velox db:seed --dry-run

# Verbose output (show debug logs)
velox db:seed --verbose

# Force run in production (skips confirmation)
velox db:seed --force

# JSON output (for scripting)
velox db:seed --json
```

### Error Handling

The seeding system uses structured errors with codes and helpful fixes:

#### Common Errors

**E3001: Seeder Not Found**
```
SeederError[E3001]: Seeder 'UserSeeder' not found.
Fix: Check that the seeder exists in src/database/seeders/ and is properly exported.
```

**E3002: Circular Dependency**
```
SeederError[E3002]: Circular dependency detected: UserSeeder -> PostSeeder -> UserSeeder
Fix: Review seeder dependencies and remove the circular reference.
```

**E3003: Execution Failed**
```
SeederError[E3003]: Seeder 'UserSeeder' failed: Unique constraint violation
Fix: Check the seeder implementation and database state.
```

**E3004: Truncation Failed**
```
SeederError[E3004]: Truncation failed for seeder 'PostSeeder': Foreign key constraint
Fix: Check for foreign key constraints that may prevent truncation.
```

**E3006: Dependency Not Found**
```
SeederError[E3006]: Seeder 'PostSeeder' depends on 'UserSeeder' which was not found.
Fix: Ensure 'UserSeeder' exists in src/database/seeders/ and is registered.
```

**E3011: State Not Found**
```
FactoryError[E3011]: State 'admin' not found on factory 'UserFactory'.
Fix: Available states: verified, unverified. Register states using registerState().
```

**E3012: Factory Create Failed**
```
FactoryError[E3012]: Failed to create 'user': Required field 'email' is missing
Fix: Check the factory definition and ensure all required fields are provided.
```

#### Catching Errors in Seeders

```typescript
export const RobustSeeder: Seeder = {
  name: 'RobustSeeder',

  async run({ db, log }) {
    try {
      await db.user.create({
        data: { email: 'test@example.com', name: 'Test' },
      });
      log.success('Created user');
    } catch (error) {
      if (error instanceof Error) {
        log.error(`Failed to create user: ${error.message}`);
      }
      throw error; // Re-throw to stop seeder execution
    }
  },
};
```

### Best Practices

#### 1. Organize Seeders by Feature

```
src/database/seeders/
├── RoleSeeder.ts          # Base data (no dependencies)
├── UserSeeder.ts          # Depends on RoleSeeder
├── PostSeeder.ts          # Depends on UserSeeder
├── CommentSeeder.ts       # Depends on UserSeeder, PostSeeder
└── TestDataSeeder.ts      # Development/test only
```

#### 2. Use Factories for Consistent Data

```typescript
// Bad: Manual data creation (inconsistent, hard to maintain)
async run({ db }) {
  await db.user.create({
    data: {
      email: 'user1@test.com',
      name: 'User 1',
      role: 'user',
      createdAt: new Date(),
    },
  });
}

// Good: Factory-generated data (consistent, reusable)
async run({ factory }) {
  await factory.get(UserFactory).create();
}
```

#### 3. Handle Foreign Keys in Truncation

```typescript
// Bad: May fail due to foreign key constraints
async truncate({ db }) {
  await db.user.deleteMany(); // Fails if posts reference users
}

// Good: Delete dependents first
async truncate({ db }) {
  await db.post.deleteMany();  // Delete posts first
  await db.user.deleteMany();  // Then delete users
}

// Better: Use CASCADE in Prisma schema
model User {
  id    String @id @default(uuid())
  posts Post[] // ON DELETE CASCADE
}

model Post {
  id       String @id @default(uuid())
  authorId String
  author   User   @relation(fields: [authorId], references: [id], onDelete: Cascade)
}
```

#### 4. Use State Modifiers for Variations

```typescript
// Bad: Duplicate factories for each variation
class AdminUserFactory extends BaseFactory<UserInput> { ... }
class RegularUserFactory extends BaseFactory<UserInput> { ... }

// Good: One factory with states
class UserFactory extends BaseFactory<UserInput> {
  constructor(prisma: PrismaClientLike) {
    super(prisma);
    this.registerState('admin', (attrs) => ({ ...attrs, role: 'admin' }));
    this.registerState('regular', (attrs) => ({ ...attrs, role: 'user' }));
  }
}
```

#### 5. Log Progress for Long Seeders

```typescript
async run({ factory, log }) {
  const count = 1000;
  log.info(`Creating ${count} users...`);

  // Create in batches with progress
  const batchSize = 100;
  for (let i = 0; i < count; i += batchSize) {
    await factory.get(UserFactory).createMany(batchSize);
    log.debug(`Created ${Math.min(i + batchSize, count)}/${count} users`);
  }

  log.success(`Created ${count} users`);
}
```

#### 6. Make Seeders Idempotent

```typescript
// Bad: Fails on second run (duplicate email)
async run({ db }) {
  await db.user.create({
    data: { email: 'admin@example.com', name: 'Admin' },
  });
}

// Good: Idempotent (safe to run multiple times)
async run({ db }) {
  await db.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: { email: 'admin@example.com', name: 'Admin', role: 'admin' },
  });
}
```

#### 7. Use Transactions for Related Data

```typescript
async run({ db, factory, log }) {
  await db.$transaction(async (tx) => {
    const user = await factory.get(UserFactory).create();

    await factory.get(PostFactory).createMany(5, {
      authorId: user.id,
    });
  });

  log.success('Created user with posts atomically');
}
```

## Development

### Building

```bash
pnpm build
```

### Type Checking

```bash
pnpm type-check
```

### Testing

```bash
pnpm test
```

## Features

- Beautiful terminal output with colors and spinners
- Automatic entry point detection
- Graceful shutdown handling (Ctrl+C)
- Helpful error messages with suggestions
- Code generators for common patterns
- Database seeding with factories
- Built with Commander.js and Clack

## Architecture

The CLI is built with:

- **Commander.js** - Command-line parsing and routing
- **Clack** - Beautiful interactive prompts
- **picocolors** - Terminal colors without dependencies
- **tsx** - TypeScript execution with hot reload

## Troubleshooting

### Entry Point Not Found

If the CLI can't find your entry point:

```bash
velox dev --entry src/index.ts
```

Or ensure your project has one of these files:
- `src/index.ts`
- `src/main.ts`
- `index.ts`

### Port Already in Use

```
Error: Port 3030 is already in use
```

**Solution:** Use a different port:

```bash
velox dev --port 8080
```

### Module Resolution Errors

Ensure all dependencies are installed:

```bash
npm install
```

And that your `tsconfig.json` has correct module resolution settings.

### Seeder Not Found

Ensure seeders are in `src/database/seeders/` and export a valid `Seeder` object:

```typescript
// Must have name and run function
export const MySeeder: Seeder = {
  name: 'MySeeder',
  async run(ctx) { /* ... */ },
};
```

## Related Packages

- [@veloxts/core](/packages/core) - Core framework
- [@veloxts/router](/packages/router) - Procedure-based routing
- [@veloxts/orm](/packages/orm) - Prisma integration
- [create-velox-app](/packages/create) - Project scaffolder

## TypeScript Support

All exports are fully typed with comprehensive JSDoc documentation. The package includes type definitions and declaration maps for excellent IDE support.

## License

MIT
