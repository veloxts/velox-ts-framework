# @veloxts/mail Guide

## Drivers

### Log Driver (default)

Logs emails to console. Best for development.

```typescript
import { mailPlugin } from '@veloxts/mail';

app.use(mailPlugin({ driver: 'log' }));
```

### SMTP Driver

Send via any SMTP server.

```typescript
app.use(mailPlugin({
  driver: 'smtp',
  config: {
    host: 'smtp.example.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  },
  from: { name: 'My App', email: 'noreply@myapp.com' },
}));
```

### Resend Driver

Send via Resend API.

```bash
npm install resend
```

```typescript
app.use(mailPlugin({
  driver: 'resend',
  config: {
    apiKey: process.env.RESEND_API_KEY,
  },
  from: { name: 'My App', email: 'noreply@myapp.com' },
}));
```

## Defining Email Templates

Using React Email components:

```typescript
import { defineMail } from '@veloxts/mail';
import { Html, Head, Body, Container, Text, Button } from '@react-email/components';

export const WelcomeEmail = defineMail({
  name: 'welcome',
  schema: z.object({
    user: z.object({ name: z.string() }),
    activationUrl: z.string().url(),
  }),
  subject: ({ user }) => `Welcome, ${user.name}!`,
  template: ({ user, activationUrl }) => (
    <Html>
      <Head />
      <Body>
        <Container>
          <Text>Hello {user.name}, welcome to our app!</Text>
          <Button href={activationUrl}>Activate Account</Button>
        </Container>
      </Body>
    </Html>
  ),
});
```

## Sending Emails

```typescript
// Send immediately
await ctx.mail.send(WelcomeEmail, {
  to: 'user@example.com',
  data: { user, activationUrl },
});

// With CC/BCC
await ctx.mail.send(WelcomeEmail, {
  to: 'user@example.com',
  cc: ['manager@example.com'],
  bcc: ['archive@example.com'],
  data: { user, activationUrl },
});

// With attachments
await ctx.mail.send(InvoiceEmail, {
  to: 'user@example.com',
  data: { invoice },
  attachments: [
    { filename: 'invoice.pdf', content: pdfBuffer },
  ],
});
```

## Bulk Sending

```typescript
const results = await ctx.mail.sendBulk(WelcomeEmail, [
  { to: 'a@example.com', data: { user: userA, activationUrl: urlA } },
  { to: 'b@example.com', data: { user: userB, activationUrl: urlB } },
]);
```

## Preview Emails

Render without sending (useful for testing):

```typescript
const { html, text, subject } = await ctx.mail.render(WelcomeEmail, {
  data: { user, activationUrl },
});
```

## CLI Commands

```bash
velox make mail WelcomeEmail     # Generate email template
```

## Standalone Usage

Use mail outside of Fastify request context (CLI commands, background jobs):

```typescript
import { getMail, closeMail } from '@veloxts/mail';

// Get standalone mail instance
const mail = await getMail({
  driver: 'log',
  from: { email: 'noreply@example.com' },
});

await mail.send(WelcomeEmail, { to: 'user@example.com', data: {...} });

// Clean up when done
await closeMail();
```
