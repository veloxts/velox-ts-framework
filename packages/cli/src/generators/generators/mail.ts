/**
 * Mail Generator
 *
 * Scaffolds email template files for VeloxTS applications.
 *
 * Usage:
 *   velox make mail <name> [options]
 *
 * Examples:
 *   velox make mail welcome                # React Email template
 *   velox make mail password-reset         # React Email template
 *   velox make mail notification --text    # Plain text email
 *   velox make mail invoice --attachment   # Email with attachments
 */

import { BaseGenerator } from '../base.js';
import {
  getMailInstructions,
  getMailPath,
  type MailOptions,
  mailTemplate,
} from '../templates/mail.js';
import type {
  GeneratedFile,
  GeneratorConfig,
  GeneratorMetadata,
  GeneratorOption,
  GeneratorOutput,
} from '../types.js';

// ============================================================================
// Generator Implementation
// ============================================================================

/**
 * Mail generator - creates email template files
 */
export class MailGenerator extends BaseGenerator<MailOptions> {
  readonly metadata: GeneratorMetadata = {
    name: 'mail',
    description: 'Generate email templates with React Email',
    longDescription: `
Scaffold email templates for VeloxTS applications using React Email.

Email templates use React components to build beautiful, responsive emails
with type-safe data validation via Zod schemas.

Examples:
  velox make mail welcome                # React Email template
  velox make mail password-reset         # React Email template
  velox make mail notification --text    # Plain text email
  velox make mail invoice --attachment   # Email with attachment support
`,
    aliases: ['email', 'm'],
    category: 'infrastructure',
  };

  readonly options: ReadonlyArray<GeneratorOption> = [
    {
      name: 'text',
      short: 't',
      description: 'Generate plain text email (no React)',
      type: 'boolean',
      default: false,
    },
    {
      name: 'attachment',
      short: 'a',
      description: 'Generate email with attachment support',
      type: 'boolean',
      default: false,
    },
  ];

  /**
   * Validate and transform raw options
   */
  validateOptions(raw: Record<string, unknown>): MailOptions {
    return {
      text: Boolean(raw.text ?? false),
      attachment: Boolean(raw.attachment ?? false),
    };
  }

  /**
   * Generate mail template files
   */
  async generate(config: GeneratorConfig<MailOptions>): Promise<GeneratorOutput> {
    const context = this.createContext(config);
    const files: GeneratedFile[] = [];

    // Generate mail template file
    const mailContent = mailTemplate(context);
    files.push({
      path: getMailPath(config.entityName, config.project, config.options),
      content: mailContent,
    });

    return {
      files,
      postInstructions: getMailInstructions(config.entityName, config.options),
    };
  }
}

/**
 * Factory function for creating a MailGenerator instance
 */
export function createMailGenerator(): MailGenerator {
  return new MailGenerator();
}
