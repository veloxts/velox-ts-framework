# create-velox-app

**Pre-Alpha Notice:** This framework is in early development (v0.5.x). APIs are subject to change. Not recommended for production use.

## What is this?

Interactive project scaffolder for the VeloxTS Framework, creating production-ready applications with a single command.

## Part of @veloxts/velox

This package is part of the VeloxTS Framework. Visit [@veloxts/velox](https://www.npmjs.com/package/@veloxts/velox) for the complete framework documentation.

## Usage

Create a new VeloxTS project with:

```bash
npx create-velox-app my-app
```

Or run interactively:

```bash
npx create-velox-app
```

## Documentation

For detailed documentation, usage examples, and customization options, see [GUIDE.md](./GUIDE.md).

## What Gets Created

- Complete VeloxTS application with TypeScript strict mode
- Prisma ORM with example models and migrations
- REST API endpoints with example CRUD procedures
- Development server with hot reload
- Build configuration using tsup
- Environment variable template

## Quick Start After Scaffolding

```bash
cd my-app
npm run db:migrate
npm run dev
```

## Learn More

- [Full Documentation](./GUIDE.md)
- [VeloxTS Framework](https://www.npmjs.com/package/@veloxts/velox)
- [GitHub Repository](https://github.com/veloxts/velox-ts-framework)

## License

MIT
