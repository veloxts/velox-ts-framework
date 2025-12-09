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

- `-p, --port <port>` - Port to listen on (default: 3210)
- `-H, --host <host>` - Host to bind to (default: localhost)
- `-e, --entry <file>` - Entry point file (auto-detected if not specified)

**Examples:**

```bash
# Start on default port 3210
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

### `velox generate`

Generate code files from templates.

```bash
velox generate <type> <name> [options]
velox g <type> <name> [options]
```

**Available generators:**

- `procedure` (alias: `p`) - Generate a procedure file
- `model` (alias: `m`) - Generate a Prisma model
- `migration` - Generate a migration file
- `schema` (alias: `s`) - Generate a Zod schema
- `test` (alias: `t`) - Generate a test file
- `resource` (alias: `r`) - Generate full resource (model + procedure + schema + test)
- `seeder` (alias: `seed`) - Generate a database seeder
- `factory` (alias: `f`) - Generate a model factory

**Examples:**

```bash
# Generate a procedure
velox generate procedure users
velox g p users --crud

# Generate a resource (all files)
velox generate resource post

# Generate a seeder
velox generate seeder user
velox g seed user --factory

# Generate a factory
velox generate factory user
```

## Database Seeding

### Overview

The seeding system allows you to populate your database with initial or test data using seeders and factories.

### Creating Seeders

Generate a new seeder:

```bash
velox generate seeder user
```

This creates `src/database/seeders/UserSeeder.ts`:

```typescript
import type { Seeder, SeederContext } from '@veloxts/cli';

export const UserSeeder: Seeder = {
  name: 'UserSeeder',
  dependencies: [],  // Seeders that must run first

  async run({ db, factory, log }) {
    log.info('Seeding users...');

    await db.user.createMany({
      data: [
        { email: 'admin@example.com', name: 'Admin' },
        { email: 'user@example.com', name: 'User' },
      ],
    });

    log.success('Created 2 users');
  },

  async truncate({ db, log }) {
    log.info('Truncating users table...');
    await db.user.deleteMany();
  },
};
```

### Creating Factories

Generate a factory for creating fake data:

```bash
velox generate factory user
```

This creates `src/database/factories/UserFactory.ts`:

```typescript
import { BaseFactory, type PrismaClientLike } from '@veloxts/cli';
import { faker } from '@faker-js/faker';

export interface UserInput {
  email: string;
  name: string;
  role: 'admin' | 'user';
}

export class UserFactory extends BaseFactory<UserInput> {
  readonly modelName = 'user';

  constructor(prisma: PrismaClientLike) {
    super(prisma);

    // Register named states
    this.registerState('admin', (attrs) => ({
      ...attrs,
      role: 'admin',
    }));
  }

  definition(): UserInput {
    return {
      email: faker.internet.email(),
      name: faker.person.fullName(),
      role: 'user',
    };
  }
}
```

### Using Factories in Seeders

```typescript
import type { Seeder, SeederContext } from '@veloxts/cli';
import { UserFactory } from '../factories/UserFactory.js';

export const UserSeeder: Seeder = {
  name: 'UserSeeder',

  async run({ factory, log }) {
    // Create 10 random users
    await factory.get(UserFactory).createMany(10);

    // Create an admin user
    await factory.get(UserFactory).state('admin').create();

    // Create user with specific attributes
    await factory.get(UserFactory).create({
      email: 'specific@example.com',
    });

    log.success('Created users');
  },
};
```

### Seeder Dependencies

Seeders can depend on other seeders:

```typescript
export const PostSeeder: Seeder = {
  name: 'PostSeeder',
  dependencies: ['UserSeeder'],  // UserSeeder runs first

  async run({ db, log }) {
    // Users already exist
    const users = await db.user.findMany();
    // Create posts...
  },
};
```

### Environment-Specific Seeders

```typescript
export const TestDataSeeder: Seeder = {
  name: 'TestDataSeeder',
  environments: ['development', 'test'],  // Skip in production

  async run({ factory, log }) {
    await factory.get(UserFactory).createMany(100);
    log.success('Created test data');
  },
};
```

### Running Seeders

```bash
# Run all seeders
velox db:seed

# Run specific seeder (includes dependencies)
velox db:seed UserSeeder

# Fresh seed (truncate first)
velox db:seed --fresh

# Dry run - see what would execute
velox db:seed --dry-run
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
Error: Port 3210 is already in use
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
