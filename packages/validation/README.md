# @veloxts/validation

**Pre-Alpha Notice:** This framework is in early development (v0.5.x). APIs are subject to change. Not recommended for production use.

## What is this?

Type-safe validation package for the VeloxTS Framework, providing Zod integration and validation utilities.

## Part of @veloxts/velox

This package is part of the VeloxTS Framework. For the complete framework experience, install:

```bash
npm install @veloxts/velox
```

Visit [@veloxts/velox](https://www.npmjs.com/package/@veloxts/velox) for the complete framework documentation.

## Standalone Installation

```bash
npm install @veloxts/validation
```

Note: Zod is a peer dependency and will be installed automatically if not already present.

## Documentation

For detailed documentation, usage examples, and API reference, see [GUIDE.md](./GUIDE.md).

## Quick Example

```typescript
import { z, parse } from '@veloxts/validation';

const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
});

const user = parse(UserSchema, {
  id: '123e4567-e89b-012d-3456-426614174000',
  name: 'Alice',
  email: 'alice@example.com',
});
```

## Learn More

- [Full Documentation](./GUIDE.md)
- [VeloxTS Framework](https://www.npmjs.com/package/@veloxts/velox)
- [GitHub Repository](https://github.com/veloxts/velox-ts-framework)

## License

MIT
