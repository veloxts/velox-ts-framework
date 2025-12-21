/**
 * Service Template
 *
 * Generates service class files for VeloxTS applications.
 */

import type { ProjectContext, TemplateContext, TemplateFunction } from '../types.js';

// ============================================================================
// Template Options
// ============================================================================

export interface ServiceOptions {
  /** Generate CRUD service */
  crud: boolean;
  /** Include caching layer */
  cache: boolean;
  /** Include event emitter */
  events: boolean;
  /** Generate injectable service (DI) */
  injectable: boolean;
}

// ============================================================================
// Path Helpers
// ============================================================================

/**
 * Get the path for a service file
 */
export function getServicePath(entityName: string, _project: ProjectContext): string {
  return `src/services/${entityName.toLowerCase()}.ts`;
}

// ============================================================================
// Templates
// ============================================================================

/**
 * Generate CRUD service
 */
function generateCrudService(ctx: TemplateContext<ServiceOptions>): string {
  const { entity, options } = ctx;

  const injectableDecorator = options.injectable
    ? `import { Injectable, Inject } from '@veloxts/core';
import { DatabaseToken } from '@/di/tokens';

@Injectable()
`
    : '';

  const dbInjection = options.injectable
    ? `  constructor(@Inject(DatabaseToken) private readonly db: PrismaClient) {}`
    : `  constructor(private readonly db: PrismaClient) {}`;

  const cacheImports = options.cache
    ? `
// Simple in-memory cache (use Redis in production)
const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute
`
    : '';

  const cacheHelpers = options.cache
    ? `

  /**
   * Get from cache
   */
  private getFromCache<T>(key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  /**
   * Set in cache
   */
  private setInCache(key: string, data: unknown): void {
    cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
  }

  /**
   * Invalidate cache
   */
  private invalidateCache(pattern?: string): void {
    if (pattern) {
      for (const key of cache.keys()) {
        if (key.startsWith(pattern)) {
          cache.delete(key);
        }
      }
    } else {
      cache.clear();
    }
  }`
    : '';

  const findByIdWithCache = options.cache
    ? `
    const cacheKey = \`${entity.camel}:\${id}\`;
    const cached = this.getFromCache<${entity.pascal}>(cacheKey);
    if (cached) return cached;

    const result = await this.db.${entity.camel}.findUnique({ where: { id } });
    if (result) this.setInCache(cacheKey, result);
    return result;`
    : `
    return this.db.${entity.camel}.findUnique({ where: { id } });`;

  const createWithCache = options.cache
    ? `
    const result = await this.db.${entity.camel}.create({ data });
    this.invalidateCache('${entity.plural}:list');
    return result;`
    : `
    return this.db.${entity.camel}.create({ data });`;

  const updateWithCache = options.cache
    ? `
    const result = await this.db.${entity.camel}.update({ where: { id }, data });
    this.invalidateCache(\`${entity.camel}:\${id}\`);
    this.invalidateCache('${entity.plural}:list');
    return result;`
    : `
    return this.db.${entity.camel}.update({ where: { id }, data });`;

  const deleteWithCache = options.cache
    ? `
    await this.db.${entity.camel}.delete({ where: { id } });
    this.invalidateCache(\`${entity.camel}:\${id}\`);
    this.invalidateCache('${entity.plural}:list');`
    : `
    await this.db.${entity.camel}.delete({ where: { id } });`;

  return `/**
 * ${entity.pascal} Service
 *
 * Business logic for ${entity.humanReadable} operations.
 */

import type { PrismaClient } from '@prisma/client';
${injectableDecorator ? injectableDecorator : ''}${cacheImports}
// ============================================================================
// Types
// ============================================================================

interface ${entity.pascal} {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Create${entity.pascal}Input {
  name: string;
  // TODO: Add fields
}

interface Update${entity.pascal}Input {
  name?: string;
  // TODO: Add fields
}

interface List${entity.pascalPlural}Options {
  page?: number;
  limit?: number;
  orderBy?: 'createdAt' | 'name';
  order?: 'asc' | 'desc';
}

// ============================================================================
// Service
// ============================================================================

/**
 * ${entity.pascal} service
 *
 * Encapsulates business logic for ${entity.humanReadable} CRUD operations.
 */
${injectableDecorator}export class ${entity.pascal}Service {
${dbInjection}

  /**
   * Find ${entity.humanReadable} by ID
   */
  async findById(id: string): Promise<${entity.pascal} | null> {${findByIdWithCache}
  }

  /**
   * Find ${entity.humanReadable} by ID or throw
   */
  async findByIdOrThrow(id: string): Promise<${entity.pascal}> {
    const ${entity.camel} = await this.findById(id);
    if (!${entity.camel}) {
      throw new Error(\`${entity.pascal} not found: \${id}\`);
    }
    return ${entity.camel};
  }

  /**
   * List ${entity.humanReadablePlural} with pagination
   */
  async list(options: List${entity.pascalPlural}Options = {}): Promise<{
    data: ${entity.pascal}[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, orderBy = 'createdAt', order = 'desc' } = options;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.db.${entity.camel}.findMany({
        skip,
        take: limit,
        orderBy: { [orderBy]: order },
      }),
      this.db.${entity.camel}.count(),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Create ${entity.humanReadable}
   */
  async create(data: Create${entity.pascal}Input): Promise<${entity.pascal}> {${createWithCache}
  }

  /**
   * Update ${entity.humanReadable}
   */
  async update(id: string, data: Update${entity.pascal}Input): Promise<${entity.pascal}> {${updateWithCache}
  }

  /**
   * Delete ${entity.humanReadable}
   */
  async delete(id: string): Promise<void> {${deleteWithCache}
  }

  /**
   * Check if ${entity.humanReadable} exists
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.db.${entity.camel}.count({ where: { id } });
    return count > 0;
  }
${cacheHelpers}
}
`;
}

/**
 * Generate service with events
 */
function generateEventService(ctx: TemplateContext<ServiceOptions>): string {
  const { entity, options } = ctx;

  const injectableDecorator = options.injectable
    ? `import { Injectable, Inject } from '@veloxts/core';
import { DatabaseToken } from '@/di/tokens';

@Injectable()
`
    : '';

  return `/**
 * ${entity.pascal} Service
 *
 * Business logic with event emission for ${entity.humanReadable} operations.
 */

import { EventEmitter } from 'node:events';
import type { PrismaClient } from '@prisma/client';
${injectableDecorator}
// ============================================================================
// Types
// ============================================================================

interface ${entity.pascal} {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Create${entity.pascal}Input {
  name: string;
}

interface Update${entity.pascal}Input {
  name?: string;
}

// ============================================================================
// Events
// ============================================================================

export type ${entity.pascal}Events = {
  '${entity.camel}:created': [${entity.pascal}];
  '${entity.camel}:updated': [${entity.pascal}, Update${entity.pascal}Input];
  '${entity.camel}:deleted': [string];
};

// ============================================================================
// Service
// ============================================================================

/**
 * ${entity.pascal} service with event emission
 */
${injectableDecorator ? injectableDecorator : ''}export class ${entity.pascal}Service extends EventEmitter {
  constructor(private readonly db: PrismaClient) {
    super();
  }

  /**
   * Emit typed event
   */
  private emit<K extends keyof ${entity.pascal}Events>(
    event: K,
    ...args: ${entity.pascal}Events[K]
  ): boolean {
    return super.emit(event, ...args);
  }

  /**
   * Listen for typed event
   */
  on<K extends keyof ${entity.pascal}Events>(
    event: K,
    listener: (...args: ${entity.pascal}Events[K]) => void
  ): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  /**
   * Find ${entity.humanReadable} by ID
   */
  async findById(id: string): Promise<${entity.pascal} | null> {
    return this.db.${entity.camel}.findUnique({ where: { id } });
  }

  /**
   * Create ${entity.humanReadable}
   */
  async create(data: Create${entity.pascal}Input): Promise<${entity.pascal}> {
    const ${entity.camel} = await this.db.${entity.camel}.create({ data });
    this.emit('${entity.camel}:created', ${entity.camel});
    return ${entity.camel};
  }

  /**
   * Update ${entity.humanReadable}
   */
  async update(id: string, data: Update${entity.pascal}Input): Promise<${entity.pascal}> {
    const ${entity.camel} = await this.db.${entity.camel}.update({ where: { id }, data });
    this.emit('${entity.camel}:updated', ${entity.camel}, data);
    return ${entity.camel};
  }

  /**
   * Delete ${entity.humanReadable}
   */
  async delete(id: string): Promise<void> {
    await this.db.${entity.camel}.delete({ where: { id } });
    this.emit('${entity.camel}:deleted', id);
  }
}

// ============================================================================
// Usage Example
// ============================================================================

/*
const service = new ${entity.pascal}Service(prisma);

// Listen for events
service.on('${entity.camel}:created', (${entity.camel}) => {
  console.log('New ${entity.humanReadable} created:', ${entity.camel}.id);
  // Send notification, update cache, etc.
});

service.on('${entity.camel}:deleted', (id) => {
  console.log('${entity.pascal} deleted:', id);
  // Cleanup related data
});

// Use the service
const ${entity.camel} = await service.create({ name: 'Example' });
*/
`;
}

/**
 * Generate simple service template
 */
function generateSimpleService(ctx: TemplateContext<ServiceOptions>): string {
  const { entity, options } = ctx;

  const injectableImport = options.injectable
    ? `import { Injectable } from '@veloxts/core';

@Injectable()
`
    : '';

  return `/**
 * ${entity.pascal} Service
 *
 * Business logic for ${entity.humanReadable} operations.
 */
${injectableImport}
// ============================================================================
// Types
// ============================================================================

export interface ${entity.pascal}Data {
  id: string;
  name: string;
  // TODO: Add your fields
}

export interface Create${entity.pascal}Input {
  name: string;
  // TODO: Add creation fields
}

export interface Update${entity.pascal}Input {
  name?: string;
  // TODO: Add update fields
}

// ============================================================================
// Service
// ============================================================================

/**
 * ${entity.pascal} service
 *
 * Handles business logic for ${entity.humanReadable} operations.
 * Separate from procedures to allow reuse across different endpoints.
 */
${injectableImport ? '@Injectable()\n' : ''}export class ${entity.pascal}Service {
  /**
   * Process ${entity.humanReadable} data
   *
   * @example
   * const result = await ${entity.camel}Service.process(data);
   */
  async process(input: Create${entity.pascal}Input): Promise<${entity.pascal}Data> {
    // TODO: Implement processing logic
    return {
      id: crypto.randomUUID(),
      name: input.name,
    };
  }

  /**
   * Validate ${entity.humanReadable} data
   */
  validate(data: Partial<${entity.pascal}Data>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.name || data.name.trim().length === 0) {
      errors.push('Name is required');
    }

    // TODO: Add more validation rules

    return { valid: errors.length === 0, errors };
  }

  /**
   * Transform ${entity.humanReadable} for output
   */
  transform(data: ${entity.pascal}Data): Record<string, unknown> {
    return {
      id: data.id,
      name: data.name,
      // TODO: Transform for API response
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Singleton service instance
 *
 * Use this for simple cases without DI.
 */
export const ${entity.camel}Service = new ${entity.pascal}Service();
`;
}

// ============================================================================
// Main Template
// ============================================================================

/**
 * Service template function
 */
export const serviceTemplate: TemplateFunction<ServiceOptions> = (ctx) => {
  if (ctx.options.crud) {
    return generateCrudService(ctx);
  }
  if (ctx.options.events) {
    return generateEventService(ctx);
  }
  return generateSimpleService(ctx);
};

// ============================================================================
// Post-generation Instructions
// ============================================================================

export function getServiceInstructions(entityName: string, options: ServiceOptions): string {
  const lines = [`Your ${entityName} service has been created.`, '', 'Next steps:'];

  if (options.injectable) {
    lines.push('  1. Register the service in your DI container');
    lines.push('  2. Inject into procedures or other services');
  } else {
    lines.push('  1. Import the service in your procedures');
    lines.push(
      `     import { ${entityName}Service } from '@/services/${entityName.toLowerCase()}';`
    );
  }

  if (options.crud) {
    lines.push('  2. Update the Prisma model name if different');
  } else if (options.events) {
    lines.push('  2. Set up event listeners for side effects');
  } else {
    lines.push('  2. Implement the service methods');
  }

  if (options.cache) {
    lines.push('  3. Consider using Redis for production caching');
  }

  return lines.join('\n');
}
