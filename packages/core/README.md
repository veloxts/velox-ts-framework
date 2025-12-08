# @veloxts/core

**Pre-Alpha Notice:** This framework is in early development (v0.4.x). APIs are subject to change. Not recommended for production use. Documentation may be incomplete or out of date.

## What is this?

Core foundation package for the VeloxTS Framework, providing the Fastify wrapper, plugin system, dependency injection container, and base context.

## Part of @veloxts/velox

This package is part of the VeloxTS Framework. For the complete framework experience, install:

```bash
npm install @veloxts/velox
```

Visit [@veloxts/velox](https://www.npmjs.com/package/@veloxts/velox) for the complete framework documentation.

## Standalone Installation

```bash
npm install @veloxts/core
```

## Documentation

For detailed documentation, usage examples, and API reference, see [GUIDE.md](./GUIDE.md).

## Quick Example

```typescript
import { veloxApp } from '@veloxts/core';

const app = await veloxApp({ port: 3210 });
await app.start();
console.log(`Server running on ${app.address}`);
```

## Learn More

- [Full Documentation](./GUIDE.md)
- [VeloxTS Framework](https://www.npmjs.com/package/@veloxts/velox)
- [GitHub Repository](https://github.com/veloxts/velox-ts-framework)

## License

MIT
