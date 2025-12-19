/**
 * Server Action Template
 *
 * Generates server action files for VeloxTS full-stack applications.
 */

import type { TemplateContext, TemplateFunction } from '../types.js';

// ============================================================================
// Template Options
// ============================================================================

export interface ActionOptions {
  /** Include form action handler */
  form: boolean;
  /** Include authentication requirement */
  auth: boolean;
  /** Generate CRUD-style actions */
  crud: boolean;
  /** Use tRPC bridge for type safety */
  trpc: boolean;
}

// ============================================================================
// Path Helpers
// ============================================================================

/**
 * Get the path for an action file
 */
export function getActionPath(entityName: string, project: { actionsDir?: string }): string {
  const actionsDir = project.actionsDir ?? 'app/actions';
  return `${actionsDir}/${entityName.toLowerCase()}.ts`;
}

// ============================================================================
// Templates
// ============================================================================

/**
 * Generate a simple action file
 */
function generateSimpleAction(ctx: TemplateContext<ActionOptions>): string {
  const { entity, options } = ctx;

  const imports = options.auth
    ? `import { createH3Action, createH3AuthAdapter } from '@veloxts/web';
import { z } from 'zod';

// Configure auth adapter
const authAdapter = createH3AuthAdapter({
  userLoader: async (ctx) => {
    const token = ctx.getCookie('session');
    if (!token) return null;
    // TODO: Validate token and return user
    return null;
  },
});
`
    : `import { createAction } from '@veloxts/web';
import { z } from 'zod';
`;

  const actionFn = options.auth ? 'createH3Action' : 'createAction';
  const authParam = options.auth ? 'authAdapter, ' : '';
  const requireAuth = options.auth ? '  requireAuth: true,' : '';

  return `'use server';

${imports}
/**
 * ${entity.pascal} Actions
 */

/**
 * Get ${entity.humanReadable} action
 */
export const get${entity.pascal} = ${actionFn}(${authParam}{
  input: z.object({ id: z.string().uuid() }),${requireAuth}
}, async (input, ctx) => {
  // TODO: Implement get ${entity.humanReadable} logic
  return {
    id: input.id,
    name: '${entity.humanReadable}',
    createdAt: new Date().toISOString(),
  };
});

/**
 * Create ${entity.humanReadable} action
 */
export const create${entity.pascal} = ${actionFn}(${authParam}{
  input: z.object({
    name: z.string().min(1),
    // TODO: Add more fields
  }),${requireAuth}
}, async (input, ctx) => {
  // TODO: Implement create ${entity.humanReadable} logic
  return {
    id: crypto.randomUUID(),
    name: input.name,
    createdAt: new Date().toISOString(),
  };
});
`;
}

/**
 * Generate form action
 */
function generateFormAction(ctx: TemplateContext<ActionOptions>): string {
  const { entity, options } = ctx;

  const authImport = options.auth
    ? `import { createH3AuthAdapter, createH3Context } from '@veloxts/web';

const authAdapter = createH3AuthAdapter({
  userLoader: async (ctx) => {
    const token = ctx.getCookie('session');
    if (!token) return null;
    return null;
  },
});
`
    : '';

  const authCheck = options.auth
    ? `
  // Check authentication
  const authCtx = await authAdapter.getAuthenticatedContext();
  if (!authCtx) {
    return { success: false, error: 'Unauthorized' };
  }
`
    : '';

  return `'use server';

import { createFormAction } from '@veloxts/web';
import { z } from 'zod';
${authImport}
/**
 * ${entity.pascal} Form Schema
 */
const ${entity.camel}FormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  // TODO: Add more fields
});

/**
 * Submit ${entity.humanReadable} Form Action
 *
 * Handles form submissions with validation and processing.
 */
export const submit${entity.pascal}Form = createFormAction(async (formData, ctx) => {${authCheck}
  // Parse form data
  const rawData = {
    name: formData.get('name'),
    email: formData.get('email'),
    // TODO: Extract more fields
  };

  // Validate with Zod
  const result = ${entity.camel}FormSchema.safeParse(rawData);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.flatten().fieldErrors,
    };
  }

  // TODO: Process the validated data
  // Example: await db.${entity.camel}.create({ data: result.data });

  return {
    success: true,
    message: '${entity.humanReadable} submitted successfully!',
  };
});

/**
 * Delete ${entity.humanReadable} Action
 */
export const delete${entity.pascal} = createFormAction(async (formData, ctx) => {${authCheck}
  const id = formData.get('id');

  if (!id || typeof id !== 'string') {
    return { success: false, error: 'ID is required' };
  }

  // TODO: Delete the ${entity.humanReadable}
  // Example: await db.${entity.camel}.delete({ where: { id } });

  return { success: true };
});
`;
}

/**
 * Generate tRPC bridge actions
 */
function generateTrpcBridgeAction(ctx: TemplateContext<ActionOptions>): string {
  const { entity, options } = ctx;

  const authOption = options.auth ? ', requireAuth: true' : '';

  return `'use server';

import { createTrpcBridge, createActions } from '@veloxts/web';
import type { AppRouter } from '@/trpc/router';

/**
 * tRPC Bridge for ${entity.pascal} Actions
 *
 * Wraps tRPC procedures as server actions with full type safety.
 */
const bridge = createTrpcBridge<AppRouter>();

/**
 * Get ${entity.humanReadable} Action
 */
export const get${entity.pascal} = bridge.createAction('${entity.plural}.get${entity.pascal}'${authOption});

/**
 * List ${entity.pascalPlural} Action
 */
export const list${entity.pascalPlural} = bridge.createAction('${entity.plural}.list${entity.pascalPlural}'${authOption});

/**
 * Create ${entity.humanReadable} Action
 */
export const create${entity.pascal} = bridge.createAction('${entity.plural}.create${entity.pascal}'${authOption});

/**
 * Update ${entity.humanReadable} Action
 */
export const update${entity.pascal} = bridge.createAction('${entity.plural}.update${entity.pascal}'${authOption});

/**
 * Delete ${entity.humanReadable} Action
 */
export const delete${entity.pascal} = bridge.createAction('${entity.plural}.delete${entity.pascal}'${authOption});

/**
 * Batch Actions Export
 *
 * Alternative: create all actions at once
 */
export const ${entity.camel}Actions = createActions({
  get: '${entity.plural}.get${entity.pascal}',
  list: '${entity.plural}.list${entity.pascalPlural}',
  create: '${entity.plural}.create${entity.pascal}',
  update: '${entity.plural}.update${entity.pascal}',
  delete: '${entity.plural}.delete${entity.pascal}',
});
`;
}

/**
 * Generate CRUD actions
 */
function generateCrudAction(ctx: TemplateContext<ActionOptions>): string {
  const { entity, options } = ctx;

  const imports = options.auth
    ? `import { createH3Action, createH3AuthAdapter } from '@veloxts/web';
import { z } from 'zod';

const authAdapter = createH3AuthAdapter({
  userLoader: async (ctx) => {
    const token = ctx.getCookie('session');
    if (!token) return null;
    return null;
  },
});
`
    : `import { createAction } from '@veloxts/web';
import { z } from 'zod';
`;

  const actionFn = options.auth ? 'createH3Action' : 'createAction';
  const authParam = options.auth ? 'authAdapter, ' : '';
  const requireAuth = options.auth ? '  requireAuth: true,' : '';

  return `'use server';

${imports}
/**
 * ${entity.pascal} Schema
 */
const ${entity.pascal}Schema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const Create${entity.pascal}Schema = z.object({
  name: z.string().min(1),
  // TODO: Add more fields
});

const Update${entity.pascal}Schema = Create${entity.pascal}Schema.partial();

/**
 * ${entity.pascal} CRUD Actions
 */

export const get${entity.pascal} = ${actionFn}(${authParam}{
  input: z.object({ id: z.string().uuid() }),${requireAuth}
}, async (input, ctx) => {
  // TODO: return ctx.db.${entity.camel}.findUnique({ where: { id: input.id } });
  throw new Error('Not implemented');
});

export const list${entity.pascalPlural} = ${actionFn}(${authParam}{
  input: z.object({
    page: z.number().default(1),
    limit: z.number().default(20),
  }).optional(),${requireAuth}
}, async (input, ctx) => {
  const { page = 1, limit = 20 } = input ?? {};
  // TODO: Implement pagination
  throw new Error('Not implemented');
});

export const create${entity.pascal} = ${actionFn}(${authParam}{
  input: Create${entity.pascal}Schema,${requireAuth}
}, async (input, ctx) => {
  // TODO: return ctx.db.${entity.camel}.create({ data: input });
  throw new Error('Not implemented');
});

export const update${entity.pascal} = ${actionFn}(${authParam}{
  input: z.object({
    id: z.string().uuid(),
    data: Update${entity.pascal}Schema,
  }),${requireAuth}
}, async (input, ctx) => {
  // TODO: return ctx.db.${entity.camel}.update({ where: { id: input.id }, data: input.data });
  throw new Error('Not implemented');
});

export const delete${entity.pascal} = ${actionFn}(${authParam}{
  input: z.object({ id: z.string().uuid() }),${requireAuth}
}, async (input, ctx) => {
  // TODO: await ctx.db.${entity.camel}.delete({ where: { id: input.id } });
  throw new Error('Not implemented');
});
`;
}

// ============================================================================
// Main Template
// ============================================================================

/**
 * Action template function
 */
export const actionTemplate: TemplateFunction<ActionOptions> = (ctx) => {
  if (ctx.options.trpc) {
    return generateTrpcBridgeAction(ctx);
  }
  if (ctx.options.form) {
    return generateFormAction(ctx);
  }
  if (ctx.options.crud) {
    return generateCrudAction(ctx);
  }
  return generateSimpleAction(ctx);
};

// ============================================================================
// Post-generation Instructions
// ============================================================================

export function getActionInstructions(entityName: string, options: ActionOptions): string {
  const lines = [`Your ${entityName} actions have been created.`, '', 'Next steps:'];

  if (options.trpc) {
    lines.push('  1. Ensure your tRPC router has matching procedures');
    lines.push('  2. Import and use actions in your page components');
  } else if (options.form) {
    lines.push('  1. Update the form schema with your fields');
    lines.push('  2. Use the action with <form action={submitForm}>');
    lines.push('  3. Handle the response in your component');
  } else {
    lines.push('  1. Implement the action logic');
    lines.push('  2. Import and call actions from your components');
  }

  if (options.auth) {
    lines.push('  • Configure userLoader in the auth adapter');
  }

  return lines.join('\n');
}
