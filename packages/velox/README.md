# @veloxts/velox

**Pre-Alpha Notice:** This framework is in early development (v0.4.x). APIs are subject to change. Not recommended for production use. Documentation may be incomplete or out of date.

## What is this?

Complete VeloxTS Framework umbrella package - batteries included for building type-safe, full-stack TypeScript applications.

## Installation

```bash
npm install @veloxts/velox
```

This single package includes everything you need to build VeloxTS applications.

## Documentation

For detailed documentation, usage examples, and API reference, see [GUIDE.md](./GUIDE.md).

## Quick Example

```typescript
import { veloxApp, procedure, defineProcedures, rest, z } from '@veloxts/velox';

const app = await veloxApp({ port: 3000 });

const greetProcedures = defineProcedures('greet', {
  sayHello: procedure()
    .input(z.object({ name: z.string() }))
    .query(({ input }) => `Hello, ${input.name}!`),
});

// Register procedures as REST endpoints
app.routes(rest([greetProcedures], { prefix: '/api' }));

await app.start();
// GET /api/greet/hello?name=World -> "Hello, World!"
```

## What's Included

This umbrella package includes:

- **@veloxts/core** - Application bootstrap, plugins, context, dependency injection
- **@veloxts/validation** - Zod integration and schema utilities
- **@veloxts/orm** - Database plugin and Prisma integration
- **@veloxts/router** - Procedure definitions, REST adapter, tRPC
- **@veloxts/auth** - Authentication and authorization

## Separate Packages

These packages are installed separately:

- **@veloxts/client** - Type-safe frontend API client
- **@veloxts/cli** - Developer tooling CLI
- **create-velox-app** - Project scaffolder

## Learn More

- [Full Documentation](./GUIDE.md)
- [Getting Started Guide](https://github.com/veloxts/velox-ts-framework#getting-started)
- [GitHub Repository](https://github.com/veloxts/velox-ts-framework)

## License

MIT
