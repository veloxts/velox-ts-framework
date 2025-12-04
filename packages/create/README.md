# create-velox-app

Interactive project scaffolder for the VeloxTS framework.

## Usage

Create a new VeloxTS project with a single command:

```bash
# Using npx (recommended)
npx create-velox-app my-app

# Using pnpm
pnpm create velox-app my-app

# Using npm
npm create velox-app my-app

# Using yarn
yarn create velox-app my-app
```

## Interactive Mode

Run without a project name for interactive setup:

```bash
npx create-velox-app
```

You'll be prompted for:
- **Project name** - Must use lowercase letters, numbers, and hyphens only

The scaffolder automatically detects your package manager (npm, pnpm, or yarn) based on which command you used.

## What Gets Created

The scaffolder generates a complete, ready-to-run VeloxTS application with:

### Project Structure

```
my-app/
├── src/
│   ├── config/
│   │   ├── app.ts           # Application configuration
│   │   └── index.ts         # Config exports
│   ├── database/
│   │   ├── index.ts         # Database plugin setup
│   │   └── prisma.ts        # Prisma client initialization
│   ├── procedures/
│   │   ├── health.ts        # Health check endpoint
│   │   ├── users.ts         # Example user CRUD procedures
│   │   └── index.ts         # Procedure exports
│   ├── schemas/
│   │   ├── user.ts          # User validation schemas
│   │   └── index.ts         # Schema exports
│   └── index.ts             # Application entry point
├── prisma/
│   └── schema.prisma        # Database schema
├── public/
│   └── index.html           # Welcome page
├── .env.example             # Environment variables template
├── .gitignore               # Git ignore rules
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── tsup.config.ts           # Build configuration
└── README.md                # Project documentation
```

### Included Features

**Core Setup:**
- VeloxTS framework with all core packages (@veloxts/core, @veloxts/router, @veloxts/validation, @veloxts/orm)
- TypeScript configuration with strict mode
- Build setup using tsup (fast esbuild-based bundler)
- Hot reload development server via `velox dev`

**Database Integration:**
- Prisma ORM with example User model
- SQLite database (zero configuration for development)
- Database migrations ready to run
- Example CRUD procedures

**Example Code:**
- Health check endpoint (`GET /health`)
- Complete user CRUD API:
  - `GET /users/:id` - Get user by ID
  - `GET /users` - List users with pagination
  - `POST /users` - Create new user
  - `GET /users/search` - Search users by name/email
- Type-safe validation with Zod schemas
- Context-based database access

**Developer Experience:**
- Pre-configured scripts for development, build, and migrations
- Environment variable template (.env.example)
- Git initialization with .gitignore
- Welcome page at root URL
- Comprehensive README with getting started instructions

## Generated Scripts

The scaffolded project includes these npm scripts:

```bash
# Development
npm run dev              # Start development server with hot reload (default: port 3210)

# Build
npm run build            # Build for production
npm run start            # Start production server

# Database
npm run db:migrate       # Run database migrations
npm run db:generate      # Generate Prisma client after schema changes

# Type checking
npm run type-check       # Run TypeScript type checker
```

## Quick Start After Scaffolding

Once your project is created:

```bash
# Navigate to project directory
cd my-app

# Set up database (creates SQLite file and applies schema)
npm run db:migrate

# Start development server
npm run dev
```

Your VeloxTS app will be running at `http://localhost:3210`

Test the endpoints:

```bash
# Health check
curl http://localhost:3210/health

# Create a user
curl -X POST http://localhost:3210/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com"}'

# List users
curl http://localhost:3210/users

# Get user by ID
curl http://localhost:3210/users/{id}

# Search users
curl http://localhost:3210/users/search?q=alice
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and customize:

```env
# Application
NODE_ENV=development
PORT=3210
HOST=localhost

# Database
DATABASE_URL="file:./dev.db"
```

### Database Provider

The default template uses SQLite for zero-configuration development. To use PostgreSQL or MySQL:

1. Update `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"  // or "mysql"
  url      = env("DATABASE_URL")
}
```

2. Update `DATABASE_URL` in `.env`:

```env
# PostgreSQL
DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"

# MySQL
DATABASE_URL="mysql://user:password@localhost:3306/mydb"
```

3. Regenerate Prisma client:

```bash
npm run db:generate
npm run db:migrate
```

## Project Templates

The current v0.1.0 release includes a single default template with:
- REST API endpoints
- Prisma database integration
- Example CRUD operations
- TypeScript strict mode

Future versions will include additional templates:
- Minimal template (barebone setup)
- Full-stack template (with frontend React app)
- Microservice template (optimized for containers)

## Development

### Building the Scaffolder

```bash
# Clone the VeloxTS repository
git clone https://github.com/zzal/velox-framework.git
cd velox-framework

# Install dependencies
pnpm install

# Build create-velox-app
cd packages/create
pnpm build

# Test locally
node dist/cli.js my-test-app
```

### Smoke Testing

The scaffolder includes a smoke test script that validates the generated project:

```bash
pnpm smoke-test
```

This creates a temporary project, installs dependencies, runs type checking, and cleans up.

## Command-Line Options

```bash
npx create-velox-app [project-name] [options]
```

**Arguments:**
- `project-name` - Name of the project to create (optional, will prompt if not provided)

**Options:**
- `-h, --help` - Display help message
- `-v, --version` - Display version number

**Examples:**

```bash
# Create with explicit name
npx create-velox-app my-awesome-app

# Interactive mode (prompts for name)
npx create-velox-app

# Show help
npx create-velox-app --help

# Show version
npx create-velox-app --version
```

## Naming Rules

Project names must follow these rules:
- Use lowercase letters only
- Numbers are allowed
- Hyphens (-) are allowed for word separation
- No spaces, underscores, or special characters

**Valid names:**
- `my-app`
- `blog-api`
- `project123`
- `user-management-service`

**Invalid names:**
- `MyApp` (uppercase)
- `my_app` (underscore)
- `my app` (space)
- `my.app` (special character)

## Troubleshooting

### Directory Already Exists

```
Error: Directory my-app already exists
```

**Solution:** Choose a different project name or remove the existing directory.

### Permission Denied

```
Error: EACCES: permission denied
```

**Solution:** Check directory permissions or run with appropriate permissions. Avoid using `sudo` with npm.

### Installation Failed

```
Error: npm install failed
```

**Solution:** Try clearing npm cache and running again:

```bash
npm cache clean --force
npx create-velox-app my-app
```

### Prisma Generation Failed

```
Error: Prisma schema validation failed
```

**Solution:** Ensure `DATABASE_URL` is set correctly in `.env`. For SQLite, the default `file:./dev.db` should work.

## What's Next?

After creating your project:

1. **Explore the generated code** - Check `src/procedures/users.ts` to see how procedures work
2. **Modify the database schema** - Edit `prisma/schema.prisma` and run migrations
3. **Add new procedures** - Create additional API endpoints following the user example
4. **Connect a frontend** - Use `@veloxts/client` for type-safe API calls
5. **Read the documentation** - Visit the [VeloxTS documentation](https://github.com/zzal/velox-framework) for guides

## Learn More

- [VeloxTS Framework Documentation](https://github.com/zzal/velox-framework)
- [@veloxts/core](../core) - Core framework concepts
- [@veloxts/router](../router) - Procedure-based routing
- [@veloxts/validation](../validation) - Schema validation with Zod
- [@veloxts/orm](../orm) - Prisma integration
- [@veloxts/client](../client) - Type-safe frontend client

## Contributing

Found a bug or want to improve the scaffolder? Contributions are welcome!

1. Report issues at [GitHub Issues](https://github.com/zzal/velox-framework/issues)
2. Submit pull requests with improvements
3. Share feedback on the generated project structure

## License

MIT
