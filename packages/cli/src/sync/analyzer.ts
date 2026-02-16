/**
 * Sync Analyzer
 *
 * Reads a Prisma schema and produces rich `SyncModelInfo[]` metadata
 * for every model. This is stage 1 of the `velox sync` pipeline.
 *
 * The analyzer re-parses the raw schema text (rather than relying solely
 * on the existing `analyzePrismaSchema` helper) because the helper skips
 * relation fields that carry `@relation(fields: [...])` -- exactly the
 * ones we need to classify belongsTo relations and detect foreign keys.
 */

import { readFileSync } from 'node:fs';

import { findPrismaSchema, analyzePrismaSchema } from '../generators/utils/prisma-schema.js';

import type { SyncFieldInfo, SyncModelInfo, SyncRelationInfo } from './types.js';

// ============================================================================
// Constants
// ============================================================================

/** Field names considered auto-managed by the framework */
const AUTO_MANAGED_NAMES = new Set(['id', 'createdAt', 'updatedAt', 'deletedAt']);

/** Field names considered sensitive (checked case-insensitively) */
const SENSITIVE_PATTERNS = [
  'password',
  'passwordhash',
  'secret',
  'secretkey',
  'token',
  'hash',
  'apikey',
];

// ============================================================================
// Public API
// ============================================================================

/**
 * Analyze a Prisma schema and produce sync metadata for every model.
 *
 * @param projectRoot - Absolute path to the project root directory
 * @returns Array of `SyncModelInfo` objects, one per Prisma model
 * @throws If no Prisma schema can be found
 */
export function analyzeSchema(projectRoot: string): SyncModelInfo[] {
  const schemaPath = findPrismaSchema(projectRoot);
  if (!schemaPath) {
    throw new Error(
      'Prisma schema not found. Ensure prisma/schema.prisma exists in your project.'
    );
  }

  // Use the existing parser to discover model names
  const analysis = analyzePrismaSchema(schemaPath);
  const modelNames = analysis.models;

  // Read the raw schema content for our own deeper parsing
  const content = readFileSync(schemaPath, 'utf-8');

  // Extract raw model bodies keyed by model name
  const modelBodies = extractModelBodies(content);

  const results: SyncModelInfo[] = [];

  for (const modelName of modelNames) {
    const body = modelBodies.get(modelName);
    if (!body) continue;

    const rawLines = parseRawLines(body);
    const fields = buildFieldInfos(rawLines, modelNames);
    const relations = buildRelationInfos(rawLines, modelNames);
    const uniqueConstraints = parseUniqueConstraints(body);

    // Detect user foreign keys: for every belongsTo pointing to 'User',
    // mark the corresponding FK scalar field.
    const userFkNames = new Set<string>();
    for (const rel of relations) {
      if (rel.kind === 'belongsTo' && rel.relatedModel === 'User' && rel.foreignKey) {
        userFkNames.add(rel.foreignKey);
      }
    }

    // Patch isUserForeignKey on fields
    const patchedFields = fields.map((f): SyncFieldInfo =>
      userFkNames.has(f.name) ? { ...f, isUserForeignKey: true } : f
    );

    // Collect FK field names from all belongsTo relations
    const fkFieldNames = new Set<string>();
    for (const rel of relations) {
      if (rel.kind === 'belongsTo' && rel.foreignKey) {
        fkFieldNames.add(rel.foreignKey);
      }
    }

    const isJoinTable = detectJoinTable(patchedFields, fkFieldNames, uniqueConstraints);

    const hasCreatedAt = patchedFields.some((f) => f.name === 'createdAt');
    const hasUpdatedAt = patchedFields.some((f) => f.name === 'updatedAt');

    results.push({
      name: modelName,
      fields: patchedFields,
      relations,
      isJoinTable,
      hasTimestamps: hasCreatedAt && hasUpdatedAt,
      uniqueConstraints,
    });
  }

  return results;
}

// ============================================================================
// Internal: Raw line parsing
// ============================================================================

/** A single parsed line from a model body (before classification). */
interface RawFieldLine {
  readonly name: string;
  readonly baseType: string;
  readonly isArray: boolean;
  readonly isOptional: boolean;
  readonly rawLine: string;
}

/**
 * Extract the body text for each model in the schema.
 * Returns a Map from model name to the text between `{` and `}`.
 */
function extractModelBodies(content: string): Map<string, string> {
  const bodies = new Map<string, string>();
  const modelRegex = /^model\s+(\w+)\s*\{/gm;

  for (const match of content.matchAll(modelRegex)) {
    const modelName = match[1];
    const openBrace = content.indexOf('{', match.index ?? 0);
    const closeBrace = findClosingBrace(content, openBrace);
    bodies.set(modelName, content.slice(openBrace + 1, closeBrace));
  }

  return bodies;
}

/**
 * Find the matching closing `}` for an opening `{`.
 */
function findClosingBrace(content: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < content.length; i++) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return content.length;
}

/**
 * Parse every field-like line from a model body into `RawFieldLine` objects.
 * Skips blank lines, comments, and `@@` directives.
 */
function parseRawLines(body: string): RawFieldLine[] {
  const lines: RawFieldLine[] = [];

  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;

    const fieldMatch = trimmed.match(/^(\w+)\s+(\w+)(\[\])?\??/);
    if (!fieldMatch) continue;

    const name = fieldMatch[1];
    const baseType = fieldMatch[2];
    const isArray = fieldMatch[3] === '[]';
    // Optional `?` can appear after `[]` or directly after type
    const isOptional = /^\w+\s+\w+(\[\])?\?/.test(trimmed);

    lines.push({ name, baseType, isArray, isOptional, rawLine: trimmed });
  }

  return lines;
}

// ============================================================================
// Internal: Field classification
// ============================================================================

/**
 * Build `SyncFieldInfo[]` for all scalar (non-relation) fields.
 */
function buildFieldInfos(rawLines: RawFieldLine[], modelNames: Set<string>): SyncFieldInfo[] {
  const fields: SyncFieldInfo[] = [];

  for (const line of rawLines) {
    // Skip relation fields (type matches a known model name)
    if (modelNames.has(line.baseType)) continue;

    const hasDefault = /@default\(/.test(line.rawLine) || /@updatedAt/.test(line.rawLine);
    const isId = /@id\b/.test(line.rawLine);
    const isUnique = /@unique\b/.test(line.rawLine);
    const defaultValue = extractDefaultValue(line.rawLine);

    fields.push({
      name: line.name,
      type: line.baseType,
      isOptional: line.isOptional,
      isId,
      isUnique,
      hasDefault,
      defaultValue,
      isAutoManaged: AUTO_MANAGED_NAMES.has(line.name),
      isSensitive: SENSITIVE_PATTERNS.includes(line.name.toLowerCase()),
      isUserForeignKey: false, // patched later
    });
  }

  return fields;
}

/**
 * Extract the value string from `@default(VALUE)`.
 * Handles nested parentheses like `@default(uuid())`.
 * Returns `undefined` when there is no `@default(...)`.
 */
function extractDefaultValue(rawLine: string): string | undefined {
  const marker = '@default(';
  const start = rawLine.indexOf(marker);
  if (start === -1) return undefined;

  const valueStart = start + marker.length;
  let depth = 1;
  let i = valueStart;

  while (i < rawLine.length && depth > 0) {
    if (rawLine[i] === '(') depth++;
    else if (rawLine[i] === ')') depth--;
    if (depth > 0) i++;
  }

  return rawLine.slice(valueStart, i);
}

// ============================================================================
// Internal: Relation classification
// ============================================================================

/**
 * Build `SyncRelationInfo[]` for all relation fields.
 *
 * Unlike the existing parser, this does NOT skip `@relation(fields: [...])`
 * lines -- those are classified as `belongsTo`.
 */
function buildRelationInfos(
  rawLines: RawFieldLine[],
  modelNames: Set<string>
): SyncRelationInfo[] {
  const relations: SyncRelationInfo[] = [];

  for (const line of rawLines) {
    if (!modelNames.has(line.baseType)) continue;

    const hasFkRelation = /@relation\([^)]*fields:\s*\[/.test(line.rawLine);

    if (hasFkRelation) {
      // belongsTo: this model owns the FK
      const fkMatch = line.rawLine.match(/@relation\([^)]*fields:\s*\[(\w+)\]/);
      const foreignKey = fkMatch ? fkMatch[1] : undefined;

      relations.push({
        name: line.name,
        relatedModel: line.baseType,
        kind: 'belongsTo',
        foreignKey,
      });
    } else if (line.isArray) {
      // hasMany
      relations.push({
        name: line.name,
        relatedModel: line.baseType,
        kind: 'hasMany',
        foreignKey: undefined,
      });
    } else {
      // hasOne (non-array, no FK annotation)
      relations.push({
        name: line.name,
        relatedModel: line.baseType,
        kind: 'hasOne',
        foreignKey: undefined,
      });
    }
  }

  return relations;
}

// ============================================================================
// Internal: Unique constraints & join table detection
// ============================================================================

/**
 * Parse `@@unique([field1, field2])` directives from a model body.
 */
function parseUniqueConstraints(body: string): readonly (readonly string[])[] {
  const constraints: (readonly string[])[] = [];
  const regex = /@@unique\(\[([^\]]+)\]\)/g;

  for (const match of body.matchAll(regex)) {
    const fieldNames = match[1]
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    constraints.push(fieldNames);
  }

  return constraints;
}

/**
 * Determine if a model is a many-to-many join table.
 *
 * A model is a join table when:
 * 1. Every non-auto-managed scalar field is a foreign key
 * 2. There is at least one `@@unique` compound constraint
 */
function detectJoinTable(
  fields: readonly SyncFieldInfo[],
  fkFieldNames: Set<string>,
  uniqueConstraints: readonly (readonly string[])[]
): boolean {
  if (uniqueConstraints.length === 0) return false;

  const nonAutoManagedScalars = fields.filter((f) => !f.isAutoManaged);
  if (nonAutoManagedScalars.length === 0) return false;

  return nonAutoManagedScalars.every((f) => fkFieldNames.has(f.name));
}
