# VeloxTS Generators Guide

## Decision Tree: Which Generator?

```
Do you need a new database entity?
├── YES → Is this a completely new entity?
│         ├── YES → velox make resource [RECOMMENDED]
│         │         Creates: Prisma model + Schema + Procedures + Tests
│         │
│         └── NO (existing Prisma model) → velox make namespace
│                   Creates: Schema + Procedures (no Prisma injection)
│
└── NO → What do you need?
         ├── Single API endpoint → velox make procedure
         ├── Validation schema only → velox make schema
         ├── Database model only → velox make model
         ├── Background job → velox make job
         ├── Email template → velox make mail
         ├── Auth guard → velox make guard
         ├── Auth policy → velox make policy
         ├── Middleware → velox make middleware
         ├── Service class → velox make service
         ├── Custom exception → velox make exception
         └── Scheduled task → velox make task
```

## Generator Comparison

| Generator | Creates | Use When |
|-----------|---------|----------|
| `resource` | Prisma + Schema + Procedures + Tests | **New database entity** (recommended default) |
| `namespace` | Schema + Procedures | Existing model or external API |
| `procedure` | Procedures (inline schemas) | Single endpoint, quick prototype |
| `schema` | Zod schema file | Standalone validation |
| `model` | Prisma model | Database-only change |

## Resource Generator [RECOMMENDED]

The full-stack generator for new entities. Like Laravel's `make:model -a`.

```bash
# Basic usage
velox make resource Post

# Full CRUD with pagination
velox make resource Post --crud --paginated

# Interactive field definition
velox make resource Product -i

# With soft delete
velox make resource Comment --soft-delete

# Auto-run migration
velox make resource Order --auto-migrate

# Preview without writing
velox make resource Post --dry-run
```

### What It Creates

```
src/
├── procedures/
│   ├── posts.ts              # CRUD procedures
│   └── __tests__/
│       └── posts.test.ts     # Unit tests
├── schemas/
│   └── post.schema.ts        # Zod validation
└── models/
    └── post.prisma           # Injected into schema.prisma
```

### Options

| Option | Short | Description |
|--------|-------|-------------|
| `--crud` | `-c` | Generate full CRUD operations |
| `--paginated` | `-P` | Include pagination for list |
| `--soft-delete` | `-s` | Add soft delete support |
| `--timestamps` | `-t` | Include timestamps (default: true) |
| `--with-tests` | `-W` | Generate tests (default: true) |
| `--interactive` | `-i` | Define fields interactively |
| `--skip-registration` | | Don't auto-register in router |
| `--auto-migrate` | | Run migration automatically |
| `--dry-run` | `-d` | Preview changes only |
| `--force` | `-f` | Overwrite existing files |

## Namespace Generator

For existing Prisma models or external data sources.

```bash
# Empty namespace (add procedures manually)
velox make namespace products

# With example CRUD
velox make namespace orders --example

# Short form
velox m ns inventory -e
```

### What It Creates

```
src/
├── procedures/
│   └── products.ts           # Procedure namespace
└── schemas/
    └── product.ts            # Zod schema
```

### When to Use

- You already have a Prisma model defined
- You're calling an external API (no database)
- You want separate schema files (not inline)
- You don't need Prisma model injection

### Options

| Option | Short | Description |
|--------|-------|-------------|
| `--example` | `-e` | Include example CRUD procedures |
| `--skip-registration` | `-S` | Don't auto-register in router |

## Procedure Generator

For single procedures or quick prototypes.

```bash
# Simple single procedure
velox make procedure health

# CRUD with inline schemas
velox make procedure users --crud

# With pagination
velox make procedure posts --crud --paginated
```

### What It Creates

```
src/
└── procedures/
    └── users.ts              # Procedures with inline schemas
```

### When to Use

- Adding a single endpoint (health check, webhook)
- Quick prototyping
- Self-contained procedure with inline schemas

### Options

| Option | Short | Description |
|--------|-------|-------------|
| `--crud` | `-c` | Generate full CRUD operations |
| `--paginated` | `-P` | Include pagination |
| `--skip-registration` | `-S` | Don't auto-register |

## Other Generators

### Schema Generator

```bash
velox make schema User
velox make schema Post --crud    # With input schemas
```

### Model Generator

```bash
velox make model User
velox make model Post --timestamps
```

### Job Generator (Background Tasks)

```bash
velox make job SendWelcomeEmail
velox make job ProcessOrder --queue
```

### Mail Generator

```bash
velox make mail WelcomeEmail
velox make mail OrderConfirmation --react   # React Email template
```

### Guard Generator (Authentication)

```bash
velox make guard admin           # Role-based
velox make guard verified        # Custom logic
```

### Policy Generator (Authorization)

```bash
velox make policy PostPolicy
velox make policy CommentPolicy --crud
```

### Middleware Generator

```bash
velox make middleware logging
velox make middleware rate-limit
```

### Service Generator

```bash
velox make service PaymentService
velox make service EmailService --injectable
```

### Exception Generator

```bash
velox make exception PaymentFailed
velox make exception ValidationFailed --http
```

### Task Generator (Scheduled)

```bash
velox make task CleanupExpiredSessions
velox make task SendDailyDigest --cron="0 9 * * *"
```

## Common Workflows

### New Feature: Blog Posts

```bash
# 1. Generate complete resource
velox make resource Post --crud --paginated -i

# 2. (Optional) Add related resources
velox make resource Comment --crud
velox make resource Tag --crud

# 3. Run migration
pnpm db:push

# 4. Seed sample data
velox make seeder PostSeeder
pnpm velox db seed
```

### Adding to Existing Model

```bash
# Model already exists in Prisma
velox make namespace Order --example

# Or just add schema
velox make schema Order --crud
```

### Quick Utility Endpoint

```bash
# Health check
velox make procedure health

# Then customize the generated file
```

### Background Processing

```bash
# Create job
velox make job SendWelcomeEmail

# Create mail template
velox make mail WelcomeEmail --react

# Use in procedure
createUser: procedure()
  .input(CreateUserSchema)
  .mutation(async ({ ctx, input }) => {
    const user = await ctx.db.user.create({ data: input });
    await dispatch(SendWelcomeEmail, { userId: user.id });
    return user;
  }),
```

## Generator Aliases

| Full Command | Alias |
|--------------|-------|
| `velox make resource` | `velox m r` |
| `velox make namespace` | `velox m ns` |
| `velox make procedure` | `velox m p` |
| `velox make schema` | `velox m s` |
| `velox make model` | `velox m mod` |
| `velox make job` | `velox m j` |
| `velox make mail` | `velox m em` |
| `velox make guard` | `velox m g` |
| `velox make policy` | `velox m pol` |
| `velox make middleware` | `velox m mw` |
| `velox make service` | `velox m svc` |
| `velox make exception` | `velox m ex` |
| `velox make task` | `velox m task` |