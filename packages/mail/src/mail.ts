/**
 * Mail Definition
 *
 * Type-safe email template definitions with React Email.
 */

import type { z } from 'zod';

import type { MailDefinition, MailDefinitionConfig } from './types.js';
import { validateTemplateName } from './utils.js';

/**
 * Define a type-safe email template with React Email.
 *
 * @param config - Mail definition configuration
 * @returns Mail definition
 *
 * @example
 * ```typescript
 * import { defineMail } from '@veloxts/mail';
 * import { Html, Head, Body, Container, Heading, Text, Button } from '@react-email/components';
 * import { z } from 'zod';
 *
 * export const WelcomeEmail = defineMail({
 *   name: 'welcome',
 *   schema: z.object({
 *     user: z.object({ name: z.string(), email: z.string() }),
 *     activationUrl: z.string().url(),
 *   }),
 *   subject: ({ user }) => `Welcome to our app, ${user.name}!`,
 *   template: ({ user, activationUrl }) => (
 *     <Html>
 *       <Head />
 *       <Body>
 *         <Container>
 *           <Heading>Welcome, {user.name}!</Heading>
 *           <Text>Click below to activate your account:</Text>
 *           <Button href={activationUrl}>Activate Account</Button>
 *         </Container>
 *       </Body>
 *     </Html>
 *   ),
 * });
 * ```
 */
export function defineMail<TSchema extends z.ZodType>(
  config: MailDefinitionConfig<TSchema>
): MailDefinition<TSchema> {
  validateTemplateName(config.name);

  return {
    name: config.name,
    schema: config.schema,
    subject: config.subject,
    template: config.template,
    text: config.text,
    from: config.from,
  };
}

/**
 * Alias for defineMail.
 */
export const mail = defineMail;

// Re-export MailDefinition type
export type { MailDefinition } from './types.js';
