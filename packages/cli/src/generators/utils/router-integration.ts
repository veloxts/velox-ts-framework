/**
 * Router Integration Utilities
 *
 * Detects project router patterns and registers new procedures automatically.
 * Supports three patterns:
 * - Object-based: const router = { users: userProcedures }
 * - Array-based: const collections = [userProcedures]
 * - Centralized: exports in src/procedures/index.ts
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { GeneratorError, GeneratorErrorCode } from '../types.js';
import {
  analyzeFile,
  applyModifications,
  type CodeModification,
  createAddExport,
  createAddImport,
  createAddToArray,
  createAddToObject,
} from './ast-helpers.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Detected router pattern in a project
 */
export type RouterPattern =
  | { type: 'object-based'; indexPath: string }
  | { type: 'array-based'; indexPath: string }
  | { type: 'centralized'; indexPath: string; proceduresIndexPath: string }
  | { type: 'unknown'; indexPath: string | null };

/**
 * Result of registering procedures
 */
export interface RegistrationResult {
  /** Whether registration was successful */
  readonly success: boolean;
  /** Files that were modified */
  readonly modifiedFiles: string[];
  /** What was registered */
  readonly registrations: {
    /** Import added to index.ts */
    importAdded: boolean;
    /** Added to collections array */
    addedToArray: boolean;
    /** Added to router object */
    addedToObject: boolean;
    /** Export added to procedures/index.ts */
    exportAdded: boolean;
  };
  /** Error message if failed */
  readonly error?: string;
}

// ============================================================================
// Pattern Detection
// ============================================================================

/**
 * Detect the router pattern used in a project
 */
export function detectRouterPattern(projectRoot: string): RouterPattern {
  // Common entry point locations
  const indexPaths = [
    join(projectRoot, 'src/index.ts'),
    join(projectRoot, 'src/server.ts'),
    join(projectRoot, 'src/app.ts'),
    join(projectRoot, 'index.ts'),
  ];

  // Find index file
  let indexPath: string | null = null;
  for (const path of indexPaths) {
    if (existsSync(path)) {
      indexPath = path;
      break;
    }
  }

  if (!indexPath) {
    return { type: 'unknown', indexPath: null };
  }

  // Check for centralized exports pattern (src/procedures/index.ts)
  const proceduresIndexPath = join(projectRoot, 'src/procedures/index.ts');
  if (existsSync(proceduresIndexPath)) {
    const proceduresContent = readFileSync(proceduresIndexPath, 'utf-8');
    // Check if it has re-exports like: export { userProcedures } from './users.js';
    if (proceduresContent.includes('export {') && proceduresContent.includes('Procedures')) {
      return { type: 'centralized', indexPath, proceduresIndexPath };
    }
  }

  // Read index file to detect pattern
  const indexContent = readFileSync(indexPath, 'utf-8');

  // Check for array-based pattern (const collections = [...])
  if (/const\s+collections\s*=\s*\[/.test(indexContent)) {
    return { type: 'array-based', indexPath };
  }

  // Check for object-based pattern (const router = {...})
  if (/const\s+router\s*=\s*\{/.test(indexContent)) {
    return { type: 'object-based', indexPath };
  }

  return { type: 'unknown', indexPath };
}

// ============================================================================
// Registration Logic
// ============================================================================

/**
 * Register procedures in detected router pattern
 *
 * @param projectRoot - Project root directory
 * @param entityName - Entity name (e.g., 'post', 'users')
 * @param procedureVar - Procedure variable name (e.g., 'postProcedures')
 * @param dryRun - If true, don't write files
 */
export function registerProcedures(
  projectRoot: string,
  entityName: string,
  procedureVar: string,
  dryRun = false
): RegistrationResult {
  const pattern = detectRouterPattern(projectRoot);

  switch (pattern.type) {
    case 'centralized':
      return registerCentralized(pattern, entityName, procedureVar, dryRun);

    case 'array-based':
      return registerArrayBased(pattern, entityName, procedureVar, dryRun);

    case 'object-based':
      return registerObjectBased(pattern, entityName, procedureVar, dryRun);

    case 'unknown':
      return {
        success: false,
        modifiedFiles: [],
        registrations: {
          importAdded: false,
          addedToArray: false,
          addedToObject: false,
          exportAdded: false,
        },
        error: 'Could not detect router pattern. Manual registration required.',
      };
  }
}

/**
 * Register procedures in centralized pattern
 *
 * 1. Add export to src/procedures/index.ts
 * 2. Import from procedures/index.ts in src/index.ts (if needed)
 * 3. Add to collections array in src/index.ts
 */
function registerCentralized(
  pattern: { type: 'centralized'; indexPath: string; proceduresIndexPath: string },
  entityName: string,
  procedureVar: string,
  dryRun: boolean
): RegistrationResult {
  const modifiedFiles: string[] = [];
  const registrations = {
    importAdded: false,
    addedToArray: false,
    addedToObject: false,
    exportAdded: false,
  };

  try {
    // 1. Add export to procedures/index.ts
    const proceduresAnalysis = analyzeFile(pattern.proceduresIndexPath);
    const exportMod = createAddExport(proceduresAnalysis, procedureVar, `./${entityName}.js`);

    if (exportMod) {
      const newContent = applyModifications(proceduresAnalysis.content, [exportMod]);
      if (!dryRun) {
        writeFileSync(pattern.proceduresIndexPath, newContent, 'utf-8');
      }
      modifiedFiles.push(pattern.proceduresIndexPath);
      registrations.exportAdded = true;
    }

    // 2. Update src/index.ts
    const indexAnalysis = analyzeFile(pattern.indexPath);
    const indexMods: CodeModification[] = [];

    // Check if import from procedures/index.ts exists
    // In centralized pattern, imports come from './procedures/index.js'
    // We need to ensure the new procedure is imported
    const importMod = createAddImport(indexAnalysis, procedureVar, './procedures/index.js');
    if (importMod) {
      indexMods.push(importMod);
      registrations.importAdded = true;
    }

    // Add to collections array
    const arrayMod = createAddToArray(indexAnalysis, 'collections', procedureVar);
    if (arrayMod) {
      indexMods.push(arrayMod);
      registrations.addedToArray = true;
    }

    // Add to router object (for types)
    const objectMod = createAddToObject(indexAnalysis, 'router', entityName, procedureVar);
    if (objectMod) {
      indexMods.push(objectMod);
      registrations.addedToObject = true;
    }

    if (indexMods.length > 0) {
      const newContent = applyModifications(indexAnalysis.content, indexMods);
      if (!dryRun) {
        writeFileSync(pattern.indexPath, newContent, 'utf-8');
      }
      modifiedFiles.push(pattern.indexPath);
    }

    return { success: true, modifiedFiles, registrations };
  } catch (err) {
    return {
      success: false,
      modifiedFiles,
      registrations,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Register procedures in array-based pattern
 *
 * 1. Add import to src/index.ts
 * 2. Add to collections array
 * 3. Add to router object (if exists)
 */
function registerArrayBased(
  pattern: { type: 'array-based'; indexPath: string },
  entityName: string,
  procedureVar: string,
  dryRun: boolean
): RegistrationResult {
  const modifiedFiles: string[] = [];
  const registrations = {
    importAdded: false,
    addedToArray: false,
    addedToObject: false,
    exportAdded: false,
  };

  try {
    const analysis = analyzeFile(pattern.indexPath);
    const modifications: CodeModification[] = [];

    // Add import
    const importMod = createAddImport(analysis, procedureVar, `./procedures/${entityName}.js`);
    if (importMod) {
      modifications.push(importMod);
      registrations.importAdded = true;
    }

    // Add to collections array
    const arrayMod = createAddToArray(analysis, 'collections', procedureVar);
    if (arrayMod) {
      modifications.push(arrayMod);
      registrations.addedToArray = true;
    }

    // Add to router object (if exists)
    const objectMod = createAddToObject(analysis, 'router', entityName, procedureVar);
    if (objectMod) {
      modifications.push(objectMod);
      registrations.addedToObject = true;
    }

    if (modifications.length > 0) {
      const newContent = applyModifications(analysis.content, modifications);
      if (!dryRun) {
        writeFileSync(pattern.indexPath, newContent, 'utf-8');
      }
      modifiedFiles.push(pattern.indexPath);
    }

    return { success: true, modifiedFiles, registrations };
  } catch (err) {
    return {
      success: false,
      modifiedFiles,
      registrations,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Register procedures in object-based pattern
 *
 * 1. Add import to src/index.ts
 * 2. Add to router object
 */
function registerObjectBased(
  pattern: { type: 'object-based'; indexPath: string },
  entityName: string,
  procedureVar: string,
  dryRun: boolean
): RegistrationResult {
  const modifiedFiles: string[] = [];
  const registrations = {
    importAdded: false,
    addedToArray: false,
    addedToObject: false,
    exportAdded: false,
  };

  try {
    const analysis = analyzeFile(pattern.indexPath);
    const modifications: CodeModification[] = [];

    // Add import
    const importMod = createAddImport(analysis, procedureVar, `./procedures/${entityName}.js`);
    if (importMod) {
      modifications.push(importMod);
      registrations.importAdded = true;
    }

    // Add to router object
    const objectMod = createAddToObject(analysis, 'router', entityName, procedureVar);
    if (objectMod) {
      modifications.push(objectMod);
      registrations.addedToObject = true;
    }

    if (modifications.length > 0) {
      const newContent = applyModifications(analysis.content, modifications);
      if (!dryRun) {
        writeFileSync(pattern.indexPath, newContent, 'utf-8');
      }
      modifiedFiles.push(pattern.indexPath);
    }

    return { success: true, modifiedFiles, registrations };
  } catch (err) {
    return {
      success: false,
      modifiedFiles,
      registrations,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Check if procedures are already registered
 */
export function isProcedureRegistered(projectRoot: string, procedureVar: string): boolean {
  const pattern = detectRouterPattern(projectRoot);

  if (pattern.type === 'unknown' || !pattern.indexPath) {
    return false;
  }

  try {
    const analysis = analyzeFile(pattern.indexPath);

    // Check if imported
    const isImported = analysis.imports.some((imp) => imp.namedImports.includes(procedureVar));
    if (!isImported) return false;

    // Check if in collections array
    const collectionsVar = analysis.variables.find((v) => v.name === 'collections' && v.isArray);
    if (collectionsVar?.arrayElements.includes(procedureVar)) {
      return true;
    }

    // Check if in router object
    const routerVar = analysis.variables.find((v) => v.name === 'router' && v.isObject);
    if (
      routerVar?.objectProperties.some((p) => analysis.content.includes(`${p}: ${procedureVar}`))
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Validate that registration is possible
 */
export function validateCanRegister(projectRoot: string): void {
  const pattern = detectRouterPattern(projectRoot);

  if (pattern.type === 'unknown') {
    throw new GeneratorError(
      GeneratorErrorCode.PROJECT_STRUCTURE,
      'Could not detect router pattern in project',
      'Ensure src/index.ts exists with a router or collections variable.'
    );
  }
}
