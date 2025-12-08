# @veloxts/client

**Pre-Alpha Notice:** This framework is in early development (v0.4.x). APIs are subject to change. Not recommended for production use.

## What is this?

Type-safe frontend API client for the VeloxTS Framework, with zero code generation and full type inference from backend procedures.

## Part of @veloxts/velox

This package is part of the VeloxTS Framework. For the complete framework experience, install:

```bash
npm install @veloxts/velox
```

Visit [@veloxts/velox](https://www.npmjs.com/package/@veloxts/velox) for the complete framework documentation.

## Standalone Installation

```bash
npm install @veloxts/client
```

## Documentation

For detailed documentation, usage examples, and API reference, see [GUIDE.md](./GUIDE.md).

## Quick Example

```typescript
import { createClient } from '@veloxts/client';
import type { userProcedures } from '../server/procedures';

const api = createClient<{ users: typeof userProcedures }>({
  baseUrl: '/api',
});

const user = await api.users.getUser({ id: '123' });
// user is fully typed from backend schema
```

## Learn More

- [Full Documentation](./GUIDE.md)
- [VeloxTS Framework](https://www.npmjs.com/package/@veloxts/velox)
- [GitHub Repository](https://github.com/veloxts/velox-ts-framework)

## License

MIT
