# @veloxts/cli

Laravel-inspired command-line interface for the VeloxTS Framework.

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
velox migrate
```

**Options:**

- `--deploy` - Run migrations in production mode (prisma migrate deploy)
- `--force` - Force push schema without migration (development only)

**Examples:**

```bash
# Development: Sync schema with database
velox migrate

# Production: Apply pending migrations
velox migrate --deploy

# Force push schema changes (dev only)
velox migrate --force
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

## Features

- Beautiful terminal output with colors and spinners
- Automatic entry point detection
- Graceful shutdown handling (Ctrl+C)
- Helpful error messages with suggestions
- Laravel-inspired command design
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

## MVP Limitations

The current v0.1.0 release includes:

**Included:**
- `velox dev` - Development server with hot reload
- `velox migrate` - Database migrations (wraps Prisma)

**Deferred to v1.1+:**
- Code generators (`velox generate controller`, etc.)
- Database seeding command (`velox db:seed`)
- Migration rollback command
- Interactive project scaffolding
- Custom command plugins

## Related Packages

- [@veloxts/core](/packages/core) - Core framework
- [@veloxts/router](/packages/router) - Procedure-based routing
- [@veloxts/orm](/packages/orm) - Prisma integration
- [create-velox-app](/packages/create) - Project scaffolder

## TypeScript Support

All exports are fully typed with comprehensive JSDoc documentation. The package includes type definitions and declaration maps for excellent IDE support.

## License

MIT
