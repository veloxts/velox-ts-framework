# @veloxts/cli

Command-line interface for VeloxTS Framework.

## Installation

Automatically installed when creating a new VeloxTS project:

```bash
npx create-velox-app my-app
```

Or add to an existing project:

```bash
npm install -D @veloxts/cli
```

## Commands

### velox dev

Start development server with Hot Module Replacement (HMR):

```bash
velox dev                # Start with HMR (default port: 3030)
velox dev --port 4000    # Custom port
velox dev --no-hmr       # Disable HMR
velox dev --verbose      # Enable debug output
```

HMR features:
- Fast, efficient reloads with sub-second restart times
- Precise timing metrics (startup, reload, total uptime)
- Smart error classification with actionable suggestions
- Automatic `velox:ready` IPC integration

Configure HMR boundaries in `package.json`:

```json
{
  "hotHook": {
    "boundaries": [
      "src/procedures/**/*.ts",
      "src/schemas/**/*.ts",
      "src/handlers/**/*.ts"
    ]
  }
}
```

Add server ready signal for accurate timing:

```typescript
await app.start();

// Send ready signal to CLI
if (process.send) {
  process.send({ type: 'velox:ready' });
}
```

### velox migrate

Run database migrations using Prisma:

```bash
velox migrate           # Apply pending migrations
velox migrate --force   # Force push schema (dev only)
velox migrate --deploy  # Deploy migrations (production)
```

### velox db:seed

Seed database with test or initial data:

```bash
velox db:seed              # Run all seeders
velox db:seed UserSeeder   # Run specific seeder
velox db:seed --fresh      # Truncate tables first
velox db:seed --dry-run    # Preview without executing
velox db:seed --verbose    # Show debug output
```

### velox make

Generate code from templates:

```bash
velox make procedure users  # Scaffold procedure
velox make schema user      # Scaffold Zod schema
velox make seeder user      # Scaffold database seeder
velox make factory user     # Scaffold model factory
```

### velox mcp init

Set up Model Context Protocol (MCP) server for Claude Desktop:

```bash
velox mcp init             # Configure Claude Desktop for VeloxTS
velox mcp init --dry-run   # Preview configuration changes
velox mcp init --force     # Overwrite existing configuration
velox mcp init --json      # Output as JSON for scripting
```

The MCP server exposes your VeloxTS project's context to Claude Desktop and other AI assistants that support the Model Context Protocol. After running this command, restart Claude Desktop to activate the integration.

Supported platforms:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

### velox openapi generate

Generate OpenAPI 3.0.3 specification from procedure definitions:

```bash
# Basic usage - JSON to ./openapi.json
velox openapi generate

# YAML output (auto-detected from extension)
velox openapi generate -o ./docs/api.yaml

# Full configuration
velox openapi generate \
  --path ./src/procedures \
  --output ./docs/openapi.json \
  --title "My API" \
  --version "2.0.0" \
  --description "Production API documentation" \
  --server "http://localhost:3030|Development" \
  --server "https://api.example.com|Production" \
  --prefix /api \
  --recursive \
  --pretty
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --path <path>` | Procedures directory | `./src/procedures` |
| `-o, --output <file>` | Output file path | `./openapi.json` |
| `-f, --format <format>` | Output format: `json` or `yaml` | Auto-detected from extension |
| `-t, --title <title>` | API title | `VeloxTS API` |
| `-V, --version <version>` | API version | `1.0.0` |
| `-d, --description <desc>` | API description | None |
| `-s, --server <url>` | Server URL (repeatable, format: `url\|description`) | None |
| `--prefix <prefix>` | API route prefix | `/api` |
| `-r, --recursive` | Scan subdirectories for procedures | `false` |
| `--pretty` / `--no-pretty` | Pretty-print or minify output | `true` |
| `--validate` / `--no-validate` | Validate generated spec for issues | `true` |
| `-q, --quiet` | Suppress output except errors | `false` |

**Server URL Format:**

You can specify multiple server URLs using the `url|description` format:

```bash
velox openapi generate \
  -s "http://localhost:3030|Local development" \
  -s "https://staging.example.com|Staging environment" \
  -s "https://api.example.com|Production"
```

**Output:**

The command generates a complete OpenAPI 3.0.3 specification including:
- Auto-generated paths from procedure naming conventions
- Request/response schemas from Zod definitions
- Security schemes from guards (JWT, API keys, etc.)
- Deprecation warnings from `.deprecated()` procedures
- Field descriptions from Zod `.describe()` calls

### velox openapi serve

Start a local Swagger UI server to preview OpenAPI documentation:

```bash
# Serve with default settings
velox openapi serve

# Custom spec file and port
velox openapi serve -f ./docs/api.yaml --port 9000

# Enable hot-reload on file changes
velox openapi serve --watch

# Bind to all interfaces (accessible from network)
velox openapi serve --host 0.0.0.0
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-f, --file <file>` | OpenAPI spec file (JSON or YAML) | `./openapi.json` |
| `--port <port>` | Server port | `8080` |
| `--host <host>` | Host to bind | `localhost` |
| `-w, --watch` | Watch for file changes and hot-reload | `false` |

**Features:**
- Interactive Swagger UI interface
- Try out API endpoints directly from the browser
- Auto-reload when spec file changes (with `--watch`)
- CORS enabled for development

The server provides two endpoints:
- `/` - Swagger UI interface
- `/openapi.json` - Raw OpenAPI specification (always JSON, regardless of source format)

## Database Seeding

### Creating Seeders

```bash
velox make seeder user
```

Creates `src/database/seeders/UserSeeder.ts`:

```typescript
import type { Seeder, SeederContext } from '@veloxts/cli';

export const UserSeeder: Seeder = {
  name: 'UserSeeder',
  dependencies: [],
  environments: ['development', 'test'],

  async run({ db, factory, log }) {
    log.info('Seeding users...');

    await db.user.createMany({
      data: [
        { email: 'admin@example.com', name: 'Admin', role: 'admin' },
        { email: 'user@example.com', name: 'User', role: 'user' },
      ],
    });

    log.success('Created 2 users');
  },

  async truncate({ db, log }) {
    await db.user.deleteMany();
  },
};
```

### Creating Factories

```bash
velox make factory user
```

Creates `src/database/factories/UserFactory.ts`:

```typescript
import { BaseFactory, type PrismaClientLike } from '@veloxts/cli';
import { faker } from '@faker-js/faker';

export class UserFactory extends BaseFactory<UserInput> {
  readonly modelName = 'user';

  constructor(prisma: PrismaClientLike) {
    super(prisma);

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

Usage in seeders:

```typescript
async run({ factory, log }) {
  // Create 50 users
  await factory.get(UserFactory).createMany(50);

  // Create 5 admins
  await factory.get(UserFactory)
    .state('admin')
    .createMany(5);
}
```

### Seeder Dependencies

Ensure correct execution order:

```typescript
export const PostSeeder: Seeder = {
  name: 'PostSeeder',
  dependencies: ['UserSeeder'], // Runs after UserSeeder

  async run({ db, factory, log }) {
    const users = await db.user.findMany();

    for (const user of users) {
      await factory.get(PostFactory).createMany(5, {
        authorId: user.id,
      });
    }
  },
};
```

## HMR Configuration

Add to `package.json`:

```json
{
  "hotHook": {
    "boundaries": [
      "src/procedures/**/*.ts",
      "src/schemas/**/*.ts",
      "src/config/**/*.ts"
    ]
  }
}
```

Add graceful shutdown:

```typescript
const shutdown = async () => {
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

## Learn More

- [@veloxts/core](https://www.npmjs.com/package/@veloxts/core) - Application framework
- [@veloxts/router](https://www.npmjs.com/package/@veloxts/router) - Procedures
- [@veloxts/orm](https://www.npmjs.com/package/@veloxts/orm) - Database
- [VeloxTS Framework](https://www.npmjs.com/package/@veloxts/velox) - Complete framework

## License

MIT
