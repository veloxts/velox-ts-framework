# create-velox-app

Interactive project scaffolder for VeloxTS Framework.

## Usage

```bash
npx create-velox-app my-app
cd my-app
npm run db:migrate
npm run dev
```

Your app will be running at `http://localhost:3030`

## Templates

```bash
npx create-velox-app my-app              # Default REST API
npx create-velox-app my-app --auth       # With authentication
npx create-velox-app my-app --trpc       # tRPC-only setup
```

## Project Structure

```
my-app/
├── src/
│   ├── procedures/      # API endpoints
│   ├── schemas/         # Zod validation
│   └── index.ts         # Entry point
├── prisma/
│   └── schema.prisma    # Database schema
└── package.json
```

## Available Scripts

```bash
npm run dev          # Development server with HMR
npm run build        # Build for production
npm run db:migrate   # Run database migrations
```

## Test Endpoints

```bash
curl http://localhost:3030/api/health
curl http://localhost:3030/api/users
curl -X POST http://localhost:3030/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com"}'
```

## Learn More

See [@veloxts/velox](https://www.npmjs.com/package/@veloxts/velox) for complete documentation.
