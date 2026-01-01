/**
 * Static TypeScript Analyzer
 *
 * Extracts procedure information from TypeScript source files without execution.
 * Uses TypeScript Compiler API in parse-only mode for accurate AST analysis.
 * Falls back to regex for edge cases.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import ts from 'typescript';

// ============================================================================
// Types
// ============================================================================

export interface StaticProcedureInfo {
  name: string;
  namespace: string;
  type: 'query' | 'mutation' | 'unknown';
  hasInputSchema: boolean;
  hasOutputSchema: boolean;
  hasGuards: boolean;
  hasMiddleware: boolean;
  route?: {
    method: string;
    path: string;
  };
  restOverride?: {
    method?: string;
    path?: string;
  };
}

export interface StaticAnalysisResult {
  procedures: StaticProcedureInfo[];
  namespaces: string[];
  files: string[];
  errors: string[];
}

interface ParsedCollection {
  namespace: string;
  procedures: ParsedProcedure[];
  filePath: string;
}

interface ParsedProcedure {
  name: string;
  type: 'query' | 'mutation' | 'unknown';
  hasInput: boolean;
  hasOutput: boolean;
  hasGuard: boolean;
  hasMiddleware: boolean;
  restOverride?: { method?: string; path?: string };
}

// ============================================================================
// Procedure Name to HTTP Method Mapping
// ============================================================================

const METHOD_PREFIXES: Record<string, { method: string; type: 'query' | 'mutation' }> = {
  get: { method: 'GET', type: 'query' },
  list: { method: 'GET', type: 'query' },
  find: { method: 'GET', type: 'query' },
  search: { method: 'GET', type: 'query' },
  create: { method: 'POST', type: 'mutation' },
  add: { method: 'POST', type: 'mutation' },
  update: { method: 'PUT', type: 'mutation' },
  edit: { method: 'PUT', type: 'mutation' },
  patch: { method: 'PATCH', type: 'mutation' },
  delete: { method: 'DELETE', type: 'mutation' },
  remove: { method: 'DELETE', type: 'mutation' },
};

// ============================================================================
// Main Analysis Functions
// ============================================================================

/**
 * Analyze a procedures directory statically
 */
export function analyzeDirectory(proceduresPath: string): StaticAnalysisResult {
  const result: StaticAnalysisResult = {
    procedures: [],
    namespaces: [],
    files: [],
    errors: [],
  };

  try {
    const entries = readdirSync(proceduresPath);

    for (const entry of entries) {
      const fullPath = join(proceduresPath, entry);

      try {
        const stat = statSync(fullPath);

        if (stat.isFile() && isTypeScriptFile(entry) && !isExcluded(entry)) {
          result.files.push(fullPath);

          try {
            const content = readFileSync(fullPath, 'utf-8');
            const collections = analyzeFileWithAST(fullPath, content);

            for (const collection of collections) {
              if (!result.namespaces.includes(collection.namespace)) {
                result.namespaces.push(collection.namespace);
              }

              for (const proc of collection.procedures) {
                const info = toProcedureInfo(proc, collection.namespace);
                result.procedures.push(info);
              }
            }
          } catch (err) {
            result.errors.push(
              `Error analyzing ${entry}: ${err instanceof Error ? err.message : String(err)}`
            );
          }
        }
      } catch (err) {
        result.errors.push(
          `Error accessing ${entry}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  } catch (err) {
    result.errors.push(
      `Error reading directory: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return result;
}

// ============================================================================
// TypeScript Compiler API Analysis
// ============================================================================

/**
 * Parse a TypeScript file and extract procedure information using the TS Compiler API.
 * Uses parse-only mode (no type checking) for speed and to avoid import resolution.
 */
function analyzeFileWithAST(filePath: string, content: string): ParsedCollection[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true, // setParentNodes - needed for tree traversal
    ts.ScriptKind.TS
  );

  const collections: ParsedCollection[] = [];

  // Visit all nodes looking for procedures() or defineProcedures() calls
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const collection = tryExtractProcedureCollection(node);
      if (collection) {
        collections.push({ ...collection, filePath });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  // If no collections found via AST, try regex fallback
  if (collections.length === 0) {
    const regexResult = analyzeFileWithRegex(filePath, content);
    if (regexResult) {
      collections.push(regexResult);
    }
  }

  return collections;
}

/**
 * Try to extract a procedure collection from a call expression.
 * Looks for: procedures('namespace', { ... }) or defineProcedures('namespace', { ... })
 */
function tryExtractProcedureCollection(
  node: ts.CallExpression
): Omit<ParsedCollection, 'filePath'> | null {
  // Check if this is a procedures() or defineProcedures() call
  const callee = node.expression;
  let functionName: string | undefined;

  if (ts.isIdentifier(callee)) {
    functionName = callee.text;
  }

  if (functionName !== 'procedures' && functionName !== 'defineProcedures') {
    return null;
  }

  // Extract namespace from first argument
  const [namespaceArg, proceduresArg] = node.arguments;

  if (!namespaceArg || !ts.isStringLiteral(namespaceArg)) {
    return null;
  }

  const namespace = namespaceArg.text;

  // Extract procedures from second argument (object literal)
  if (!proceduresArg || !ts.isObjectLiteralExpression(proceduresArg)) {
    return null;
  }

  const procedures: ParsedProcedure[] = [];

  for (const prop of proceduresArg.properties) {
    if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
      const procedureName = prop.name.text;
      const procedureInfo = extractProcedureInfo(prop.initializer);
      procedures.push({
        name: procedureName,
        ...procedureInfo,
      });
    }
  }

  return { namespace, procedures };
}

/**
 * Extract procedure information from a procedure builder chain.
 * Handles: procedure().input(...).output(...).guard(...).query/mutation(...)
 */
function extractProcedureInfo(node: ts.Node): Omit<ParsedProcedure, 'name'> {
  const info: Omit<ParsedProcedure, 'name'> = {
    type: 'unknown',
    hasInput: false,
    hasOutput: false,
    hasGuard: false,
    hasMiddleware: false,
  };

  // Walk the call chain
  function walkChain(n: ts.Node): void {
    if (!ts.isCallExpression(n)) return;

    const callee = n.expression;

    // Check for method calls on the chain
    if (ts.isPropertyAccessExpression(callee)) {
      const methodName = callee.name.text;

      switch (methodName) {
        case 'query':
          info.type = 'query';
          break;
        case 'mutation':
          info.type = 'mutation';
          break;
        case 'input':
          info.hasInput = true;
          break;
        case 'output':
          info.hasOutput = true;
          break;
        case 'guard':
          info.hasGuard = true;
          break;
        case 'use':
          info.hasMiddleware = true;
          break;
        case 'rest':
          info.restOverride = extractRestOverride(n.arguments[0]);
          break;
      }

      // Continue walking up the chain
      walkChain(callee.expression);
    }
  }

  walkChain(node);
  return info;
}

/**
 * Extract REST override configuration from .rest({ method, path }) call
 */
function extractRestOverride(arg: ts.Node | undefined): { method?: string; path?: string } | undefined {
  if (!arg || !ts.isObjectLiteralExpression(arg)) {
    return undefined;
  }

  const result: { method?: string; path?: string } = {};

  for (const prop of arg.properties) {
    if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
      const key = prop.name.text;
      if ((key === 'method' || key === 'path') && ts.isStringLiteral(prop.initializer)) {
        result[key] = prop.initializer.text;
      }
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

// ============================================================================
// Regex Fallback Analysis
// ============================================================================

/**
 * Fallback regex-based analysis for files that don't match the standard pattern
 */
function analyzeFileWithRegex(filePath: string, content: string): ParsedCollection | null {
  const procedures: ParsedProcedure[] = [];
  let namespace = '';

  // Extract namespace from procedures() call
  const namespaceMatch = content.match(/procedures\s*\(\s*['"]([^'"]+)['"]/);
  if (namespaceMatch) {
    namespace = namespaceMatch[1];
  } else {
    // Derive from filename
    const filename = basename(filePath, extname(filePath));
    if (filename !== 'index') {
      namespace = filename;
    }
  }

  if (!namespace) {
    return null;
  }

  // Extract procedure names using regex
  const procedurePattern = /(\w+)\s*:\s*procedure\s*[.(]/g;
  let match: RegExpExecArray | null;

  while ((match = procedurePattern.exec(content)) !== null) {
    const name = match[1];

    // Determine type from naming convention
    let type: 'query' | 'mutation' | 'unknown' = 'unknown';
    for (const [prefix, info] of Object.entries(METHOD_PREFIXES)) {
      if (name.toLowerCase().startsWith(prefix)) {
        type = info.type;
        break;
      }
    }

    // Check for explicit .query() or .mutation()
    if (content.includes(`${name}`) && content.includes('.query(')) {
      type = 'query';
    } else if (content.includes(`${name}`) && content.includes('.mutation(')) {
      type = 'mutation';
    }

    procedures.push({
      name,
      type,
      hasInput: content.includes('.input('),
      hasOutput: content.includes('.output('),
      hasGuard: content.includes('.guard('),
      hasMiddleware: content.includes('.use('),
    });
  }

  if (procedures.length === 0) {
    return null;
  }

  return { namespace, procedures, filePath };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert parsed procedure to StaticProcedureInfo
 */
function toProcedureInfo(proc: ParsedProcedure, namespace: string): StaticProcedureInfo {
  const route = inferRestRoute(proc.name, namespace, proc.restOverride);

  return {
    name: proc.name,
    namespace,
    type: proc.type,
    hasInputSchema: proc.hasInput,
    hasOutputSchema: proc.hasOutput,
    hasGuards: proc.hasGuard,
    hasMiddleware: proc.hasMiddleware,
    route,
    restOverride: proc.restOverride,
  };
}

/**
 * Infer REST route from procedure name and namespace
 */
function inferRestRoute(
  procedureName: string,
  namespace: string,
  override?: { method?: string; path?: string }
): { method: string; path: string } {
  const basePath = `/api/${namespace}`;

  // Use override if provided
  if (override?.method && override?.path) {
    return { method: override.method, path: override.path };
  }

  // Infer from naming convention
  for (const [prefix, info] of Object.entries(METHOD_PREFIXES)) {
    if (procedureName.toLowerCase().startsWith(prefix)) {
      // Collection endpoints (no :id)
      if (['list', 'find', 'search', 'create', 'add'].includes(prefix)) {
        return {
          method: override?.method || info.method,
          path: override?.path || basePath,
        };
      }

      // Resource endpoints (with :id)
      return {
        method: override?.method || info.method,
        path: override?.path || `${basePath}/:id`,
      };
    }
  }

  // Default to GET collection
  return { method: 'GET', path: basePath };
}

/**
 * Check if file is a TypeScript file
 */
function isTypeScriptFile(filename: string): boolean {
  const ext = extname(filename);
  return ['.ts', '.tsx', '.mts'].includes(ext);
}

/**
 * Check if file should be excluded
 */
function isExcluded(filename: string): boolean {
  return (
    filename.startsWith('_') ||
    filename.endsWith('.test.ts') ||
    filename.endsWith('.spec.ts') ||
    filename.endsWith('.d.ts') ||
    filename === 'index.ts'
  );
}

// ============================================================================
// Formatting
// ============================================================================

/**
 * Format static analysis result as text
 */
export function formatStaticAnalysisAsText(result: StaticAnalysisResult): string {
  const lines: string[] = [
    '# VeloxTS Procedures',
    '',
    `Total: ${result.procedures.length} procedures`,
    `Namespaces: ${result.namespaces.join(', ') || 'none'}`,
    `Files analyzed: ${result.files.length}`,
    '',
  ];

  if (result.errors.length > 0) {
    lines.push('## Analysis Notes');
    for (const error of result.errors) {
      lines.push(`- ${error}`);
    }
    lines.push('');
  }

  // Group by namespace
  const byNamespace = new Map<string, StaticProcedureInfo[]>();
  for (const proc of result.procedures) {
    const list = byNamespace.get(proc.namespace) ?? [];
    list.push(proc);
    byNamespace.set(proc.namespace, list);
  }

  for (const [namespace, procs] of byNamespace) {
    lines.push(`## ${namespace}`);
    lines.push('');

    for (const proc of procs) {
      const type = proc.type === 'query' ? 'Q' : proc.type === 'mutation' ? 'M' : '?';
      const route = proc.route ? ` -> ${proc.route.method} ${proc.route.path}` : '';
      const guards = proc.hasGuards ? ' [guarded]' : '';
      lines.push(`- [${type}] ${proc.name}${route}${guards}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
