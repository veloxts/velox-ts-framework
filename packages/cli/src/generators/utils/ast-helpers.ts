/**
 * AST Helpers for TypeScript Code Modification
 *
 * Uses TypeScript Compiler API for safe, syntax-aware code transformations.
 * Enables adding imports, modifying arrays/objects without breaking code structure.
 */

import { readFileSync } from 'node:fs';

import ts from 'typescript';

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a code modification to apply
 */
export interface CodeModification {
  /** Type of modification */
  readonly type: 'add-import' | 'add-to-array' | 'add-to-object' | 'add-export';
  /** Position in file to insert content */
  readonly position: number;
  /** Content to insert */
  readonly content: string;
}

/**
 * Result of analyzing a TypeScript file
 */
export interface FileAnalysis {
  /** The parsed source file */
  readonly sourceFile: ts.SourceFile;
  /** Original file content */
  readonly content: string;
  /** Position after last import statement */
  readonly lastImportEnd: number;
  /** All import declarations found */
  readonly imports: ImportInfo[];
  /** All variable declarations found */
  readonly variables: VariableInfo[];
  /** All export declarations found */
  readonly exports: ExportInfo[];
}

/**
 * Information about an import declaration
 */
export interface ImportInfo {
  /** Module specifier (e.g., './users.js') */
  readonly moduleSpecifier: string;
  /** Named imports (e.g., ['userProcedures', 'UserSchema']) */
  readonly namedImports: string[];
  /** Default import name if present */
  readonly defaultImport: string | undefined;
  /** Whether this is a type-only import */
  readonly isTypeOnly: boolean;
  /** Position in file */
  readonly start: number;
  readonly end: number;
}

/**
 * Information about a variable declaration
 */
export interface VariableInfo {
  /** Variable name */
  readonly name: string;
  /** Whether it's const, let, or var */
  readonly kind: 'const' | 'let' | 'var';
  /** Whether initialized with array literal */
  readonly isArray: boolean;
  /** Whether initialized with object literal */
  readonly isObject: boolean;
  /** Array elements if isArray is true */
  readonly arrayElements: string[];
  /** Object property names if isObject is true */
  readonly objectProperties: string[];
  /** Position in file */
  readonly start: number;
  readonly end: number;
  /** Position of initializer (array/object literal) */
  readonly initializerStart: number;
  readonly initializerEnd: number;
}

/**
 * Information about an export declaration
 */
export interface ExportInfo {
  /** Exported name */
  readonly name: string;
  /** Module specifier if re-export */
  readonly moduleSpecifier: string | undefined;
  /** Position in file */
  readonly start: number;
  readonly end: number;
}

// ============================================================================
// File Parsing
// ============================================================================

/**
 * Parse a TypeScript file into an AST
 */
export function parseTypeScriptFile(filePath: string): ts.SourceFile {
  const content = readFileSync(filePath, 'utf-8');
  return ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
}

/**
 * Parse TypeScript source code into an AST
 */
export function parseTypeScriptSource(content: string, fileName = 'source.ts'): ts.SourceFile {
  return ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true);
}

/**
 * Analyze a TypeScript file for imports, variables, and exports
 */
export function analyzeFile(filePath: string): FileAnalysis {
  const content = readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

  const imports: ImportInfo[] = [];
  const variables: VariableInfo[] = [];
  const exports: ExportInfo[] = [];
  let lastImportEnd = 0;

  // Walk the AST
  ts.forEachChild(sourceFile, (node) => {
    // Collect imports
    if (ts.isImportDeclaration(node)) {
      const importInfo = extractImportInfo(node, sourceFile);
      if (importInfo) {
        imports.push(importInfo);
        lastImportEnd = Math.max(lastImportEnd, node.end);
      }
    }

    // Collect variable declarations
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        const varInfo = extractVariableInfo(declaration, node, sourceFile);
        if (varInfo) {
          variables.push(varInfo);
        }
      }
    }

    // Collect exports
    if (ts.isExportDeclaration(node)) {
      const exportInfo = extractExportInfo(node, sourceFile);
      if (exportInfo) {
        exports.push(...exportInfo);
      }
    }
  });

  return {
    sourceFile,
    content,
    lastImportEnd,
    imports,
    variables,
    exports,
  };
}

/**
 * Extract import information from an import declaration
 */
function extractImportInfo(
  node: ts.ImportDeclaration,
  sourceFile: ts.SourceFile
): ImportInfo | null {
  const moduleSpecifier = node.moduleSpecifier;
  if (!ts.isStringLiteral(moduleSpecifier)) {
    return null;
  }

  const namedImports: string[] = [];
  let defaultImport: string | undefined;
  let isTypeOnly = false;

  const importClause = node.importClause;
  if (importClause) {
    isTypeOnly = importClause.isTypeOnly;

    // Default import
    if (importClause.name) {
      defaultImport = importClause.name.text;
    }

    // Named imports
    const namedBindings = importClause.namedBindings;
    if (namedBindings && ts.isNamedImports(namedBindings)) {
      for (const element of namedBindings.elements) {
        namedImports.push(element.name.text);
      }
    }
  }

  return {
    moduleSpecifier: moduleSpecifier.text,
    namedImports,
    defaultImport,
    isTypeOnly,
    start: node.getStart(sourceFile),
    end: node.getEnd(),
  };
}

/**
 * Extract variable information from a variable declaration
 */
function extractVariableInfo(
  declaration: ts.VariableDeclaration,
  statement: ts.VariableStatement,
  sourceFile: ts.SourceFile
): VariableInfo | null {
  if (!ts.isIdentifier(declaration.name)) {
    return null;
  }

  const name = declaration.name.text;
  const kind = getVariableKind(statement.declarationList);
  const initializer = declaration.initializer;

  let isArray = false;
  let isObject = false;
  const arrayElements: string[] = [];
  const objectProperties: string[] = [];
  let initializerStart = 0;
  let initializerEnd = 0;

  if (initializer) {
    initializerStart = initializer.getStart(sourceFile);
    initializerEnd = initializer.getEnd();

    if (ts.isArrayLiteralExpression(initializer)) {
      isArray = true;
      for (const element of initializer.elements) {
        arrayElements.push(element.getText(sourceFile));
      }
    } else if (ts.isObjectLiteralExpression(initializer)) {
      isObject = true;
      for (const prop of initializer.properties) {
        if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
          objectProperties.push(prop.name.text);
        } else if (ts.isShorthandPropertyAssignment(prop)) {
          objectProperties.push(prop.name.text);
        }
      }
    }
  }

  return {
    name,
    kind,
    isArray,
    isObject,
    arrayElements,
    objectProperties,
    start: statement.getStart(sourceFile),
    end: statement.getEnd(),
    initializerStart,
    initializerEnd,
  };
}

/**
 * Get variable declaration kind (const, let, var)
 */
function getVariableKind(list: ts.VariableDeclarationList): 'const' | 'let' | 'var' {
  if (list.flags & ts.NodeFlags.Const) return 'const';
  if (list.flags & ts.NodeFlags.Let) return 'let';
  return 'var';
}

/**
 * Extract export information from an export declaration
 */
function extractExportInfo(node: ts.ExportDeclaration, sourceFile: ts.SourceFile): ExportInfo[] {
  const exports: ExportInfo[] = [];

  const moduleSpecifier = node.moduleSpecifier;
  const specifierText =
    moduleSpecifier && ts.isStringLiteral(moduleSpecifier) ? moduleSpecifier.text : undefined;

  const exportClause = node.exportClause;
  if (exportClause && ts.isNamedExports(exportClause)) {
    for (const element of exportClause.elements) {
      exports.push({
        name: element.name.text,
        moduleSpecifier: specifierText,
        start: node.getStart(sourceFile),
        end: node.getEnd(),
      });
    }
  }

  return exports;
}

// ============================================================================
// Code Modification Helpers
// ============================================================================

/**
 * Check if an import already exists for a module
 */
export function hasImport(analysis: FileAnalysis, moduleSpecifier: string): boolean {
  return analysis.imports.some((imp) => imp.moduleSpecifier === moduleSpecifier);
}

/**
 * Check if a named import exists in any import declaration
 */
export function hasNamedImport(analysis: FileAnalysis, name: string): boolean {
  return analysis.imports.some((imp) => imp.namedImports.includes(name));
}

/**
 * Check if an item exists in an array variable
 */
export function hasArrayItem(analysis: FileAnalysis, variableName: string, item: string): boolean {
  const variable = analysis.variables.find((v) => v.name === variableName && v.isArray);
  if (!variable) return false;
  return variable.arrayElements.includes(item);
}

/**
 * Check if a property exists in an object variable
 */
export function hasObjectProperty(
  analysis: FileAnalysis,
  variableName: string,
  property: string
): boolean {
  const variable = analysis.variables.find((v) => v.name === variableName && v.isObject);
  if (!variable) return false;
  return variable.objectProperties.includes(property);
}

/**
 * Check if an export exists
 */
export function hasExport(analysis: FileAnalysis, name: string): boolean {
  return analysis.exports.some((exp) => exp.name === name);
}

// ============================================================================
// Code Generation
// ============================================================================

/**
 * Create a modification to add an import statement
 */
export function createAddImport(
  analysis: FileAnalysis,
  importName: string,
  moduleSpecifier: string,
  isTypeOnly = false
): CodeModification | null {
  // Check if import already exists
  if (hasNamedImport(analysis, importName)) {
    return null;
  }

  const typePrefix = isTypeOnly ? 'type ' : '';
  const content = `\nimport { ${typePrefix}${importName} } from '${moduleSpecifier}';`;

  return {
    type: 'add-import',
    position: analysis.lastImportEnd,
    content,
  };
}

/**
 * Create a modification to add an item to an array
 */
export function createAddToArray(
  analysis: FileAnalysis,
  variableName: string,
  item: string
): CodeModification | null {
  const variable = analysis.variables.find((v) => v.name === variableName && v.isArray);
  if (!variable) {
    return null;
  }

  // Check if item already exists
  if (variable.arrayElements.includes(item)) {
    return null;
  }

  // Insert before closing bracket
  const insertPosition = variable.initializerEnd - 1;
  const separator = variable.arrayElements.length > 0 ? ', ' : '';
  const content = `${separator}${item}`;

  return {
    type: 'add-to-array',
    position: insertPosition,
    content,
  };
}

/**
 * Create a modification to add a property to an object
 */
export function createAddToObject(
  analysis: FileAnalysis,
  variableName: string,
  key: string,
  value: string
): CodeModification | null {
  const variable = analysis.variables.find((v) => v.name === variableName && v.isObject);
  if (!variable) {
    return null;
  }

  // Check if property already exists
  if (variable.objectProperties.includes(key)) {
    return null;
  }

  // Insert before closing brace
  const insertPosition = variable.initializerEnd - 1;
  const separator = variable.objectProperties.length > 0 ? ', ' : '';
  const content = `${separator}${key}: ${value}`;

  return {
    type: 'add-to-object',
    position: insertPosition,
    content,
  };
}

/**
 * Create a modification to add a named re-export
 */
export function createAddExport(
  analysis: FileAnalysis,
  exportName: string,
  moduleSpecifier: string
): CodeModification | null {
  // Check if export already exists
  if (hasExport(analysis, exportName)) {
    return null;
  }

  // Find last export position, or use end of imports
  const lastExportEnd =
    analysis.exports.length > 0 ? Math.max(...analysis.exports.map((e) => e.end)) : 0;

  const insertPosition = lastExportEnd > 0 ? lastExportEnd : analysis.lastImportEnd;
  const content = `\nexport { ${exportName} } from '${moduleSpecifier}';`;

  return {
    type: 'add-export',
    position: insertPosition,
    content,
  };
}

// ============================================================================
// Apply Modifications
// ============================================================================

/**
 * Apply modifications to file content
 *
 * Modifications are sorted by position (descending) to avoid offset issues
 */
export function applyModifications(content: string, modifications: CodeModification[]): string {
  // Filter out null modifications and sort by position descending
  const validMods = modifications.filter((m): m is CodeModification => m !== null);
  const sortedMods = [...validMods].sort((a, b) => b.position - a.position);

  let result = content;

  for (const mod of sortedMods) {
    result = result.slice(0, mod.position) + mod.content + result.slice(mod.position);
  }

  return result;
}

/**
 * Apply modifications to a file and return the new content
 */
export function modifyFile(filePath: string, modifications: CodeModification[]): string {
  const content = readFileSync(filePath, 'utf-8');
  return applyModifications(content, modifications);
}
