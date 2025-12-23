# @veloxts/mail

> **Early Preview** - APIs may change before v1.0.

Email sending with React Email templates and multiple transport drivers.

## Installation

```bash
npm install @veloxts/mail
```

## Quick Start

```typescript
import { mailPlugin, defineMail } from '@veloxts/mail';

app.use(mailPlugin({ driver: 'log' }));

const WelcomeEmail = defineMail({
  subject: ({ name }) => `Welcome, ${name}!`,
  template: ({ name }) => <Text>Hello {name}, welcome to our app!</Text>,
});

await ctx.mail.send(WelcomeEmail, { to: 'user@example.com', data: { name: 'John' } });
```

See [GUIDE.md](./GUIDE.md) for detailed documentation.

## License

MIT
