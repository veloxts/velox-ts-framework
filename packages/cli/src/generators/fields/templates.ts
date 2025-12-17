/**
 * Field Templates for Quick Resource Generation
 *
 * Pre-built field configurations for common use cases.
 * Templates provide a quick way to add multiple related fields at once.
 */

import type { FieldDefinition } from './types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * A field template containing pre-configured fields
 */
export interface FieldTemplate {
  /** Unique identifier for the template */
  id: string;
  /** Display name shown in the menu */
  name: string;
  /** Short description of what the template provides */
  description: string;
  /** Pre-configured fields included in this template */
  fields: FieldDefinition[];
}

// ============================================================================
// Built-in Templates
// ============================================================================

/**
 * Blog Post template - common fields for blog posts
 */
const blogPostTemplate: FieldTemplate = {
  id: 'blog-post',
  name: 'Blog Post Fields',
  description: 'title, slug, content, excerpt, publishedAt, status',
  fields: [
    {
      name: 'title',
      type: 'string',
      attributes: { optional: false, unique: false, hasDefault: false },
    },
    {
      name: 'slug',
      type: 'string',
      attributes: { optional: false, unique: true, hasDefault: false },
    },
    {
      name: 'content',
      type: 'text',
      attributes: { optional: false, unique: false, hasDefault: false },
    },
    {
      name: 'excerpt',
      type: 'text',
      attributes: { optional: true, unique: false, hasDefault: false },
    },
    {
      name: 'publishedAt',
      type: 'datetime',
      attributes: { optional: true, unique: false, hasDefault: false },
    },
    {
      name: 'status',
      type: 'enum',
      attributes: { optional: false, unique: false, hasDefault: true, defaultValue: 'DRAFT' },
      enumDef: { name: 'PostStatus', values: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] },
    },
  ],
};

/**
 * User Profile template - basic user profile fields
 */
const userProfileTemplate: FieldTemplate = {
  id: 'user-profile',
  name: 'User Profile Fields',
  description: 'name, email, username, bio, avatar, emailVerified',
  fields: [
    {
      name: 'name',
      type: 'string',
      attributes: { optional: false, unique: false, hasDefault: false },
    },
    {
      name: 'email',
      type: 'string',
      attributes: { optional: false, unique: true, hasDefault: false },
    },
    {
      name: 'username',
      type: 'string',
      attributes: { optional: false, unique: true, hasDefault: false },
    },
    {
      name: 'bio',
      type: 'text',
      attributes: { optional: true, unique: false, hasDefault: false },
    },
    {
      name: 'avatar',
      type: 'string',
      attributes: { optional: true, unique: false, hasDefault: false },
    },
    {
      name: 'emailVerified',
      type: 'boolean',
      attributes: { optional: false, unique: false, hasDefault: true, defaultValue: 'false' },
    },
  ],
};

/**
 * Product template - e-commerce product fields
 */
const productTemplate: FieldTemplate = {
  id: 'product',
  name: 'Product Fields',
  description: 'name, description, sku, price, inStock, stockQuantity',
  fields: [
    {
      name: 'name',
      type: 'string',
      attributes: { optional: false, unique: false, hasDefault: false },
    },
    {
      name: 'description',
      type: 'text',
      attributes: { optional: false, unique: false, hasDefault: false },
    },
    {
      name: 'sku',
      type: 'string',
      attributes: { optional: false, unique: true, hasDefault: false },
    },
    {
      name: 'price',
      type: 'float',
      attributes: { optional: false, unique: false, hasDefault: false },
    },
    {
      name: 'compareAtPrice',
      type: 'float',
      attributes: { optional: true, unique: false, hasDefault: false },
    },
    {
      name: 'inStock',
      type: 'boolean',
      attributes: { optional: false, unique: false, hasDefault: true, defaultValue: 'true' },
    },
    {
      name: 'stockQuantity',
      type: 'int',
      attributes: { optional: false, unique: false, hasDefault: true, defaultValue: '0' },
    },
  ],
};

/**
 * Order template - e-commerce order fields
 */
const orderTemplate: FieldTemplate = {
  id: 'order',
  name: 'E-commerce Order Fields',
  description: 'orderNumber, total, subtotal, tax, shippingAddress, status',
  fields: [
    {
      name: 'orderNumber',
      type: 'string',
      attributes: { optional: false, unique: true, hasDefault: false },
    },
    {
      name: 'total',
      type: 'float',
      attributes: { optional: false, unique: false, hasDefault: false },
    },
    {
      name: 'subtotal',
      type: 'float',
      attributes: { optional: false, unique: false, hasDefault: false },
    },
    {
      name: 'tax',
      type: 'float',
      attributes: { optional: false, unique: false, hasDefault: false },
    },
    {
      name: 'shippingAddress',
      type: 'json',
      attributes: { optional: false, unique: false, hasDefault: false },
    },
    {
      name: 'status',
      type: 'enum',
      attributes: { optional: false, unique: false, hasDefault: true, defaultValue: 'PENDING' },
      enumDef: {
        name: 'OrderStatus',
        values: ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
      },
    },
  ],
};

// ============================================================================
// Template Registry
// ============================================================================

/**
 * All available field templates
 */
export const FIELD_TEMPLATES: readonly FieldTemplate[] = [
  blogPostTemplate,
  userProfileTemplate,
  productTemplate,
  orderTemplate,
] as const;

// ============================================================================
// Template Functions
// ============================================================================

/**
 * Get a template by its ID
 */
export function getTemplate(id: string): FieldTemplate | undefined {
  return FIELD_TEMPLATES.find((t) => t.id === id);
}

/**
 * Format a template for display in a select prompt
 */
export function formatTemplateOption(template: FieldTemplate): {
  value: string;
  label: string;
  hint: string;
} {
  return {
    value: template.id,
    label: template.name,
    hint: template.description,
  };
}

/**
 * Get all templates formatted for select prompt options
 */
export function getTemplateOptions(): Array<{ value: string; label: string; hint: string }> {
  return FIELD_TEMPLATES.map(formatTemplateOption);
}

/**
 * Clone template fields (deep copy to avoid mutations)
 */
export function cloneTemplateFields(template: FieldTemplate): FieldDefinition[] {
  return template.fields.map((field) => ({
    name: field.name,
    type: field.type,
    attributes: { ...field.attributes },
    enumDef: field.enumDef
      ? { name: field.enumDef.name, values: [...field.enumDef.values] }
      : undefined,
  }));
}
