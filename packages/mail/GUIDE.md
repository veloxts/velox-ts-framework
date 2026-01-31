# @veloxts/mail Guide

Email sending for VeloxTS applications with React Email templates, supporting SMTP and Resend.

## Installation

```bash
pnpm add @veloxts/mail

# For Resend (recommended for production)
pnpm add resend
```

## Quick Start

### Development (Log)

Logs emails to console instead of sending:

```typescript
import { velox } from '@veloxts/core';
import { mailPlugin } from '@veloxts/mail';

const app = velox();

app.register(mailPlugin({
  driver: 'log',
  from: { name: 'My App', email: 'noreply@myapp.com' },
}));

await app.start();
```

### Production (SMTP)

```typescript
import { velox } from '@veloxts/core';
import { mailPlugin } from '@veloxts/mail';

const app = velox();

app.register(mailPlugin({
  driver: 'smtp',
  config: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  },
  from: { name: 'My App', email: 'noreply@myapp.com' },
}));

await app.start();
```

### Production (Resend)

```typescript
import { velox } from '@veloxts/core';
import { mailPlugin } from '@veloxts/mail';

const app = velox();

app.register(mailPlugin({
  driver: 'resend',
  config: {
    apiKey: process.env.RESEND_API_KEY,
  },
  from: { name: 'My App', email: 'noreply@myapp.com' },
}));

await app.start();
```

**Environment Variables:**

```bash
# .env (SMTP)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-username
SMTP_PASS=your-password

# .env (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxx
```

## Defining Email Templates

Using React Email components:

```tsx
import { defineMail } from '@veloxts/mail';
import { z } from 'zod';
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

// Override subject
await ctx.mail.send(WelcomeEmail, {
  to: 'user@example.com',
  subject: 'Custom Subject',
  data: { user, activationUrl },
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

Render without sending (useful for testing or previews):

```typescript
const { html, text, subject } = await ctx.mail.render(WelcomeEmail, {
  data: { user, activationUrl },
});
```

## Production Deployment

### Choosing a Provider

| Provider | Best For |
|----------|----------|
| [Resend](https://resend.com) | Simple API, React Email native, generous free tier |
| [AWS SES](https://aws.amazon.com/ses/) | High volume, cost-effective |
| [SendGrid](https://sendgrid.com) | Enterprise features |
| [Postmark](https://postmarkapp.com) | Transactional email focus |

### Production Checklist

1. **Verify sending domain** - SPF, DKIM, DMARC records
2. **Use environment variables** - Never hardcode credentials
3. **Set proper From address** - Use verified domain email
4. **Handle bounces** - Configure bounce/complaint webhooks
5. **Queue emails** - Use `@veloxts/queue` for background sending

### Sending Emails in Background

For better performance, queue emails instead of sending synchronously:

```typescript
// Define a job for sending emails
const sendEmailJob = defineJob({
  name: 'email.send',
  schema: z.object({
    template: z.string(),
    to: z.string().email(),
    data: z.record(z.unknown()),
  }),
  handler: async ({ data, ctx }) => {
    const template = emailTemplates[data.template];
    await ctx.mail.send(template, { to: data.to, data: data.data });
  },
});

// Dispatch instead of sending directly
await ctx.queue.dispatch(sendEmailJob, {
  template: 'welcome',
  to: 'user@example.com',
  data: { user, activationUrl },
});
```

## Standalone Usage

Use mail outside of Fastify request context (CLI commands, background jobs):

```typescript
import { getMail, closeMail } from '@veloxts/mail';

// Get standalone mail instance
const mail = await getMail({
  driver: 'resend',
  config: { apiKey: process.env.RESEND_API_KEY },
  from: { email: 'noreply@example.com' },
});

await mail.send(WelcomeEmail, { to: 'user@example.com', data: {...} });

// Clean up when done
await closeMail();
```
