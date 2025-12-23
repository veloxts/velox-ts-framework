/**
 * Mail Template
 *
 * Generates email template files for VeloxTS applications.
 */

import type { ProjectContext, TemplateContext, TemplateFunction } from '../types.js';

// ============================================================================
// Template Options
// ============================================================================

export interface MailOptions {
  /** Plain text email (no React) */
  text: boolean;
  /** Email with attachment support */
  attachment: boolean;
}

// ============================================================================
// Path Helpers
// ============================================================================

/**
 * Get the path for a mail template file
 */
export function getMailPath(
  entityName: string,
  _project: ProjectContext,
  options: MailOptions
): string {
  const extension = options.text ? 'ts' : 'tsx';
  return `src/mail/${entityName.toLowerCase()}.${extension}`;
}

// ============================================================================
// Templates
// ============================================================================

/**
 * Generate plain text email template
 */
function generateTextMail(ctx: TemplateContext<MailOptions>): string {
  const { entity } = ctx;

  return `/**
 * ${entity.pascal} Email (Plain Text)
 *
 * Plain text email template for ${entity.humanReadable}.
 */

import { defineMail } from '@veloxts/mail';
import { z } from 'zod';

// ============================================================================
// Schema
// ============================================================================

const ${entity.pascal}EmailSchema = z.object({
  name: z.string(),
  // TODO: Add your email data fields
});

export type ${entity.pascal}EmailData = z.infer<typeof ${entity.pascal}EmailSchema>;

// ============================================================================
// Email Definition
// ============================================================================

/**
 * ${entity.pascal} email template
 *
 * Plain text email for ${entity.humanReadable}.
 *
 * @example
 * \`\`\`typescript
 * import { ${entity.camel}Email } from '@/mail/${entity.kebab}';
 * import { mail } from '@/mail';
 *
 * await mail.send(${entity.camel}Email, {
 *   to: 'user@example.com',
 *   data: { name: 'John' },
 * });
 * \`\`\`
 */
export const ${entity.camel}Email = defineMail({
  name: '${entity.kebab}',
  schema: ${entity.pascal}EmailSchema,
  subject: ({ name }) => \`${entity.humanReadable}: \${name}\`,
  text: ({ name }) => \`
Hello \${name},

This is your ${entity.humanReadable} email.

TODO: Add your email content here.

Best regards,
The Team
  \`.trim(),
  template: () => {
    throw new Error('Text-only email - template should not be called');
  },
});
`;
}

/**
 * Generate email with attachment support
 */
function generateAttachmentMail(ctx: TemplateContext<MailOptions>): string {
  const { entity } = ctx;

  return `/**
 * ${entity.pascal} Email
 *
 * Email template for ${entity.humanReadable} with attachment support.
 */

import { defineMail } from '@veloxts/mail';
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components';
import { z } from 'zod';

// ============================================================================
// Schema
// ============================================================================

const ${entity.pascal}EmailSchema = z.object({
  name: z.string(),
  downloadUrl: z.string().url(),
  // TODO: Add your email data fields
});

export type ${entity.pascal}EmailData = z.infer<typeof ${entity.pascal}EmailSchema>;

// ============================================================================
// Email Definition
// ============================================================================

/**
 * ${entity.pascal} email template
 *
 * Sends ${entity.humanReadable} with downloadable attachment.
 *
 * @example
 * \`\`\`typescript
 * import { ${entity.camel}Email } from '@/mail/${entity.kebab}';
 * import { mail } from '@/mail';
 *
 * await mail.send(${entity.camel}Email, {
 *   to: 'user@example.com',
 *   data: { name: 'John', downloadUrl: 'https://...' },
 *   attachments: [{
 *     filename: 'document.pdf',
 *     content: pdfBuffer,
 *     contentType: 'application/pdf',
 *   }],
 * });
 * \`\`\`
 */
export const ${entity.camel}Email = defineMail({
  name: '${entity.kebab}',
  schema: ${entity.pascal}EmailSchema,
  subject: ({ name }) => \`${entity.humanReadable} for \${name}\`,
  template: ({ name, downloadUrl }) => (
    <Html>
      <Head />
      <Preview>${entity.humanReadable} is ready to download</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Hello, {name}!</Heading>

          <Text style={text}>
            Your ${entity.humanReadable} is ready. Click the button below to download it.
          </Text>

          <Button href={downloadUrl} style={button}>
            Download Now
          </Button>

          <Text style={text}>
            Or copy and paste this URL into your browser:
            <br />
            {downloadUrl}
          </Text>

          <Text style={footer}>
            This email was sent automatically. Please do not reply.
          </Text>
        </Container>
      </Body>
    </Html>
  ),
});

// ============================================================================
// Styles
// ============================================================================

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
};

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0',
  textAlign: 'center' as const,
};

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  textAlign: 'center' as const,
};

const button = {
  backgroundColor: '#5469d4',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '16px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  width: '200px',
  padding: '12px',
  margin: '24px auto',
};

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  textAlign: 'center' as const,
  marginTop: '32px',
};
`;
}

/**
 * Generate simple React Email template
 */
function generateReactMail(ctx: TemplateContext<MailOptions>): string {
  const { entity } = ctx;

  return `/**
 * ${entity.pascal} Email
 *
 * Email template for ${entity.humanReadable}.
 */

import { defineMail } from '@veloxts/mail';
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components';
import { z } from 'zod';

// ============================================================================
// Schema
// ============================================================================

const ${entity.pascal}EmailSchema = z.object({
  name: z.string(),
  actionUrl: z.string().url(),
  // TODO: Add your email data fields
});

export type ${entity.pascal}EmailData = z.infer<typeof ${entity.pascal}EmailSchema>;

// ============================================================================
// Email Definition
// ============================================================================

/**
 * ${entity.pascal} email template
 *
 * Sends ${entity.humanReadable} notification to users.
 *
 * @example
 * \`\`\`typescript
 * import { ${entity.camel}Email } from '@/mail/${entity.kebab}';
 * import { mail } from '@/mail';
 *
 * await mail.send(${entity.camel}Email, {
 *   to: 'user@example.com',
 *   data: {
 *     name: 'John Doe',
 *     actionUrl: 'https://example.com/action',
 *   },
 * });
 * \`\`\`
 */
export const ${entity.camel}Email = defineMail({
  name: '${entity.kebab}',
  schema: ${entity.pascal}EmailSchema,
  subject: ({ name }) => \`${entity.humanReadable} for \${name}\`,
  template: ({ name, actionUrl }) => (
    <Html>
      <Head />
      <Preview>${entity.humanReadable} notification</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Hello, {name}!</Heading>

          <Text style={text}>
            TODO: Add your email content here.
          </Text>

          <Button href={actionUrl} style={button}>
            Take Action
          </Button>

          <Text style={footer}>
            If you did not expect this email, you can safely ignore it.
          </Text>
        </Container>
      </Body>
    </Html>
  ),
  text: ({ name }) => \`
Hello \${name},

TODO: Add your plain text email content here.

Best regards,
The Team
  \`.trim(),
});

// ============================================================================
// Styles
// ============================================================================

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
};

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0',
  textAlign: 'center' as const,
};

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  textAlign: 'center' as const,
};

const button = {
  backgroundColor: '#5469d4',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '16px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  width: '200px',
  padding: '12px',
  margin: '24px auto',
};

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  textAlign: 'center' as const,
  marginTop: '32px',
};
`;
}

// ============================================================================
// Main Template
// ============================================================================

/**
 * Mail template function
 */
export const mailTemplate: TemplateFunction<MailOptions> = (ctx) => {
  if (ctx.options.text) {
    return generateTextMail(ctx);
  }
  if (ctx.options.attachment) {
    return generateAttachmentMail(ctx);
  }
  return generateReactMail(ctx);
};

// ============================================================================
// Post-generation Instructions
// ============================================================================

export function getMailInstructions(entityName: string, options: MailOptions): string {
  const lines = [`Your ${entityName} email template has been created.`, '', 'Next steps:'];

  lines.push('  1. Update the Zod schema with your email data fields');
  lines.push('  2. Customize the email content and styling');
  lines.push('  3. Send the email from your procedures:');
  lines.push('');
  lines.push("     import { mail } from '@/mail';");
  lines.push(`     import { ${entityName}Email } from '@/mail/${entityName.toLowerCase()}';`);
  lines.push('');
  lines.push(`     await mail.send(${entityName}Email, {`);
  lines.push("       to: 'user@example.com',");
  lines.push("       data: { name: '...' },");
  lines.push('     });');

  if (options.text) {
    lines.push('');
    lines.push('  4. This is a plain text email - no HTML rendering');
  } else if (options.attachment) {
    lines.push('');
    lines.push('  4. Add attachments when sending:');
    lines.push("     attachments: [{ filename: '...', content: buffer }]");
  } else {
    lines.push('');
    lines.push('  4. Preview your email: npx react-email dev');
  }

  return lines.join('\n');
}
