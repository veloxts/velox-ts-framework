/**
 * Prisma Schema Parser and Injector
 *
 * Parses Prisma schema files to find models/enums and enables safe injection
 * of new definitions without breaking existing code.
 */

import { existsSync, readFileSync } from 'node:fs';

import { GeneratorError, GeneratorErrorCode } from '../types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Parsed information about a single field in a Prisma model
 */
export interface PrismaFieldInfo {
  /** Field name (e.g., 'author', 'posts') */
  readonly name: string;
  /** Base type without modifiers (e.g., 'User', 'Post') */
  readonly type: string;
  /** Whether this field is a relation to another model */
  readonly isRelation: boolean;
  /** Whether this is an array relation (e.g., Post[]) */
  readonly isArray: boolean;
  /** The related model name, if this is a relation field */
  readonly relatedModel: string | undefined;
}

/**
 * Detailed information about a Prisma model including its fields
 */
export interface PrismaModelInfo {
  /** Model name (PascalCase) */
  readonly name: string;
  /** All parsed fields */
  readonly fields: readonly PrismaFieldInfo[];
  /** Only the relation fields (convenience accessor) */
  readonly relationFields: readonly PrismaFieldInfo[];
}

/**
 * Relation info categorized for code generation
 */
export interface ModelRelations {
  /** Single-object relations (e.g., author User) */
  readonly hasOne: readonly string[];
  /** Array relations (e.g., posts Post[]) */
  readonly hasMany: readonly string[];
}

/**
 * Represents a parsed Prisma schema
 */
export interface PrismaSchemaAnalysis {
  /** Original file content */
  readonly content: string;
  /** File path */
  readonly filePath: string;
  /** All model names found */
  readonly models: Set<string>;
  /** All enum names found */
  readonly enums: Set<string>;
  /** Position after last model block */
  readonly lastModelEnd: number;
  /** Position after last enum block */
  readonly lastEnumEnd: number;
  /** Position where models start (after datasource/generator blocks) */
  readonly modelSectionStart: number;
  /** Detailed model info with field-level data */
  readonly modelDetails: Map<string, PrismaModelInfo>;
}

/**
 * Model definition to inject
 */
export interface PrismaModelDefinition {
  /** Model name (PascalCase) */
  readonly name: string;
  /** Full Prisma model content (including `model Name { ... }`) */
  readonly content: string;
}

/**
 * Enum definition to inject
 */
export interface PrismaEnumDefinition {
  /** Enum name (PascalCase) */
  readonly name: string;
  /** Full Prisma enum content (including `enum Name { ... }`) */
  readonly content: string;
}

/**
 * Result of injecting into schema
 */
export interface SchemaInjectionResult {
  /** Modified schema content */
  readonly content: string;
  /** Models that were added */
  readonly addedModels: string[];
  /** Enums that were added */
  readonly addedEnums: string[];
  /** Models that were skipped (already exist) */
  readonly skippedModels: string[];
  /** Enums that were skipped (already exist) */
  readonly skippedEnums: string[];
}

// ============================================================================
// Schema Parsing
// ============================================================================

/**
 * Find the Prisma schema file in a project
 */
export function findPrismaSchema(projectRoot: string): string | null {
  const possiblePaths = [
    `${projectRoot}/prisma/schema.prisma`,
    `${projectRoot}/schema.prisma`,
    `${projectRoot}/prisma/schema/schema.prisma`,
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  return null;
}

/**
 * Parse a Prisma schema file
 */
export function analyzePrismaSchema(filePath: string): PrismaSchemaAnalysis {
  if (!existsSync(filePath)) {
    throw new GeneratorError(
      GeneratorErrorCode.PROJECT_STRUCTURE,
      `Prisma schema not found: ${filePath}`,
      'Ensure prisma/schema.prisma exists in your project.'
    );
  }

  const content = readFileSync(filePath, 'utf-8');

  const models = new Set<string>();
  const enums = new Set<string>();

  let lastModelEnd = 0;
  let lastEnumEnd = 0;
  let modelSectionStart = 0;

  // Find all models
  const modelRegex = /^model\s+(\w+)\s*\{/gm;

  for (const match of content.matchAll(modelRegex)) {
    models.add(match[1]);
    const blockEnd = findBlockEnd(content, match.index ?? 0);
    lastModelEnd = Math.max(lastModelEnd, blockEnd);

    // Track where models section starts
    if (modelSectionStart === 0) {
      modelSectionStart = match.index ?? 0;
    }
  }

  // Find all enums
  const enumRegex = /^enum\s+(\w+)\s*\{/gm;

  for (const match of content.matchAll(enumRegex)) {
    enums.add(match[1]);
    const blockEnd = findBlockEnd(content, match.index ?? 0);
    lastEnumEnd = Math.max(lastEnumEnd, blockEnd);

    // Enums typically come before models, update section start if earlier
    const matchIndex = match.index ?? 0;
    if (matchIndex < modelSectionStart || modelSectionStart === 0) {
      modelSectionStart = matchIndex;
    }
  }

  // If no models/enums found, put section start after generator/datasource blocks
  if (modelSectionStart === 0) {
    modelSectionStart = findEndOfConfigBlocks(content);
  }

  // Parse field-level details for each model
  const modelDetails = parseModelDetails(content, models);

  return {
    content,
    filePath,
    models,
    enums,
    lastModelEnd,
    lastEnumEnd,
    modelSectionStart,
    modelDetails,
  };
}

/**
 * Find the end of a Prisma block (matching closing brace)
 */
function findBlockEnd(content: string, startIndex: number): number {
  let braceCount = 0;
  let inBlock = false;

  for (let i = startIndex; i < content.length; i++) {
    const char = content[i];

    if (char === '{') {
      braceCount++;
      inBlock = true;
    } else if (char === '}') {
      braceCount--;
      if (inBlock && braceCount === 0) {
        return i + 1; // Position after closing brace
      }
    }
  }

  return content.length;
}

/**
 * Find the end of datasource/generator config blocks
 */
function findEndOfConfigBlocks(content: string): number {
  // Find the last generator or datasource block
  const generatorRegex = /^generator\s+\w+\s*\{/gm;
  const datasourceRegex = /^datasource\s+\w+\s*\{/gm;

  let lastEnd = 0;

  for (const match of content.matchAll(generatorRegex)) {
    const blockEnd = findBlockEnd(content, match.index ?? 0);
    lastEnd = Math.max(lastEnd, blockEnd);
  }

  for (const match of content.matchAll(datasourceRegex)) {
    const blockEnd = findBlockEnd(content, match.index ?? 0);
    lastEnd = Math.max(lastEnd, blockEnd);
  }

  return lastEnd;
}

// ============================================================================
// Field-Level Parsing
// ============================================================================

/**
 * Parse detailed field information for all models in the schema
 */
function parseModelDetails(content: string, modelNames: Set<string>): Map<string, PrismaModelInfo> {
  const details = new Map<string, PrismaModelInfo>();
  const modelRegex = /^model\s+(\w+)\s*\{/gm;

  for (const match of content.matchAll(modelRegex)) {
    const modelName = match[1];
    const blockStart = content.indexOf('{', match.index ?? 0);
    const blockEnd = findBlockEnd(content, match.index ?? 0);
    const body = content.slice(blockStart + 1, blockEnd - 1);

    const fields = parseModelFields(body, modelNames);
    details.set(modelName, {
      name: modelName,
      fields,
      relationFields: fields.filter((f) => f.isRelation),
    });
  }

  return details;
}

/**
 * Parse individual fields from a model body string
 *
 * Detects relation fields by checking if the field type matches a known model name.
 * Skips back-reference fields (those with @relation(...) that are the inverse side).
 */
function parseModelFields(body: string, modelNames: Set<string>): PrismaFieldInfo[] {
  const fields: PrismaFieldInfo[] = [];
  const lines = body.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines, comments, and directives (@@map, @@unique, etc.)
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) {
      continue;
    }

    // Parse field: name Type[?][] [@annotations...]
    // Match: fieldName  TypeName  optional modifiers
    const fieldMatch = trimmed.match(/^(\w+)\s+(\w+)(\[\])?\??/);
    if (!fieldMatch) continue;

    const name = fieldMatch[1];
    const baseType = fieldMatch[2];
    const isArray = fieldMatch[3] === '[]';

    // Check if this is a relation field (type matches a known model)
    const isRelation = modelNames.has(baseType);

    if (!isRelation) {
      fields.push({
        name,
        type: baseType,
        isRelation: false,
        isArray: false,
        relatedModel: undefined,
      });
      continue;
    }

    // For relation fields, skip back-references (inverse side with @relation)
    // Back-references typically have @relation and reference back to the parent
    // We detect them by the presence of `fields:` and `references:` in @relation
    const hasRelationWithForeignKey = /@relation\([^)]*fields:\s*\[/.test(trimmed);
    if (hasRelationWithForeignKey) {
      continue;
    }

    fields.push({
      name,
      type: baseType,
      isRelation: true,
      isArray,
      relatedModel: baseType,
    });
  }

  return fields;
}

/**
 * Get categorized relations for a model
 *
 * Returns hasOne (single-object) and hasMany (array) relation field names
 */
export function getModelRelations(
  analysis: PrismaSchemaAnalysis,
  modelName: string
): ModelRelations {
  const modelInfo = analysis.modelDetails.get(modelName);
  if (!modelInfo) {
    return { hasOne: [], hasMany: [] };
  }

  const hasOne: string[] = [];
  const hasMany: string[] = [];

  for (const field of modelInfo.relationFields) {
    if (field.isArray) {
      hasMany.push(field.name);
    } else {
      hasOne.push(field.name);
    }
  }

  return { hasOne, hasMany };
}

// ============================================================================
// Schema Modification
// ============================================================================

/**
 * Check if a model exists in the schema
 */
export function hasModel(analysis: PrismaSchemaAnalysis, modelName: string): boolean {
  return analysis.models.has(modelName);
}

/**
 * Check if an enum exists in the schema
 */
export function hasEnum(analysis: PrismaSchemaAnalysis, enumName: string): boolean {
  return analysis.enums.has(enumName);
}

/**
 * Inject models and enums into a Prisma schema
 *
 * - Enums are added before models (Prisma convention)
 * - Models are added at the end of the file
 * - Existing models/enums are skipped (not duplicated)
 */
export function injectIntoSchema(
  analysis: PrismaSchemaAnalysis,
  models: PrismaModelDefinition[],
  enums: PrismaEnumDefinition[] = []
): SchemaInjectionResult {
  const addedModels: string[] = [];
  const addedEnums: string[] = [];
  const skippedModels: string[] = [];
  const skippedEnums: string[] = [];

  // Prepare content modifications
  const modifications: Array<{ position: number; content: string }> = [];

  // Process enums (add before models)
  for (const enumDef of enums) {
    if (hasEnum(analysis, enumDef.name)) {
      skippedEnums.push(enumDef.name);
      continue;
    }

    // Insert enum before first model, or at model section start
    const insertPos =
      analysis.lastEnumEnd > 0
        ? analysis.lastEnumEnd
        : analysis.modelSectionStart > 0
          ? analysis.modelSectionStart
          : analysis.content.length;

    modifications.push({
      position: insertPos,
      content: `\n${enumDef.content}\n`,
    });

    addedEnums.push(enumDef.name);
  }

  // Process models (add at end)
  for (const model of models) {
    if (hasModel(analysis, model.name)) {
      skippedModels.push(model.name);
      continue;
    }

    // Insert model at end of file (or after last model)
    const insertPos = analysis.lastModelEnd > 0 ? analysis.lastModelEnd : analysis.content.length;

    modifications.push({
      position: insertPos,
      content: `\n${model.content}\n`,
    });

    addedModels.push(model.name);
  }

  // Apply modifications (sort by position descending to avoid offset issues)
  let modifiedContent = analysis.content;
  modifications.sort((a, b) => b.position - a.position);

  for (const mod of modifications) {
    modifiedContent =
      modifiedContent.slice(0, mod.position) + mod.content + modifiedContent.slice(mod.position);
  }

  return {
    content: modifiedContent,
    addedModels,
    addedEnums,
    skippedModels,
    skippedEnums,
  };
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate that required models/enums don't already exist
 *
 * Throws if any model or enum already exists (prevents accidental overwrites)
 */
export function validateNoConflicts(
  analysis: PrismaSchemaAnalysis,
  models: PrismaModelDefinition[],
  enums: PrismaEnumDefinition[] = []
): void {
  for (const model of models) {
    if (hasModel(analysis, model.name)) {
      throw new GeneratorError(
        GeneratorErrorCode.FILE_ALREADY_EXISTS,
        `Model "${model.name}" already exists in Prisma schema`,
        `Use a different entity name or remove the existing model from prisma/schema.prisma`
      );
    }
  }

  for (const enumDef of enums) {
    if (hasEnum(analysis, enumDef.name)) {
      throw new GeneratorError(
        GeneratorErrorCode.FILE_ALREADY_EXISTS,
        `Enum "${enumDef.name}" already exists in Prisma schema`,
        `Use a different enum name or remove the existing enum from prisma/schema.prisma`
      );
    }
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate a minimal Prisma model string
 */
export function generatePrismaModel(name: string, fields: string[], tableName?: string): string {
  const mapDirective = tableName ? `\n  @@map("${tableName}")` : '';
  const fieldsString = fields.map((f) => `  ${f}`).join('\n');

  return `model ${name} {
${fieldsString}${mapDirective}
}`;
}

/**
 * Generate a Prisma enum string
 */
export function generatePrismaEnum(name: string, values: string[]): string {
  const valuesString = values.map((v) => `  ${v}`).join('\n');

  return `enum ${name} {
${valuesString}
}`;
}
