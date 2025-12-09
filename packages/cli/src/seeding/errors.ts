/**
 * Seeding Errors
 *
 * Structured error classes for the VeloxTS database seeding system.
 */

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Error codes for seeding errors (for AI/tooling integration)
 */
export enum SeederErrorCode {
  /** Seeder not found in registry */
  SEEDER_NOT_FOUND = 'E3001',

  /** Circular dependency detected between seeders */
  CIRCULAR_DEPENDENCY = 'E3002',

  /** Seeder execution failed */
  EXECUTION_FAILED = 'E3003',

  /** Truncation failed */
  TRUNCATION_FAILED = 'E3004',

  /** Invalid seeder configuration */
  INVALID_CONFIG = 'E3005',

  /** Seeder dependency not found */
  DEPENDENCY_NOT_FOUND = 'E3006',

  /** No seeders found in project */
  NO_SEEDERS_FOUND = 'E3007',

  /** Database connection failed */
  DATABASE_ERROR = 'E3008',

  /** Factory not found in registry */
  FACTORY_NOT_FOUND = 'E3010',

  /** Factory state not found */
  STATE_NOT_FOUND = 'E3011',

  /** Factory creation failed */
  FACTORY_CREATE_FAILED = 'E3012',

  /** Invalid factory configuration */
  INVALID_FACTORY = 'E3013',

  /** File system error during seeder loading */
  FILESYSTEM_ERROR = 'E3020',

  /** Invalid seeder export */
  INVALID_EXPORT = 'E3021',
}

// ============================================================================
// Seeder Error
// ============================================================================

/**
 * Structured error for seeding operations
 */
export class SeederError extends Error {
  constructor(
    public readonly code: SeederErrorCode,
    message: string,
    public readonly fix?: string
  ) {
    super(message);
    this.name = 'SeederError';
  }

  /**
   * Format error for display
   */
  format(): string {
    let output = `SeederError[${this.code}]: ${this.message}`;
    if (this.fix) {
      output += `\n\n  Fix: ${this.fix}`;
    }
    return output;
  }

  /**
   * Convert to JSON for --json output
   */
  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      fix: this.fix,
    };
  }
}

// ============================================================================
// Factory Error
// ============================================================================

/**
 * Structured error for factory operations
 */
export class FactoryError extends Error {
  constructor(
    public readonly code: SeederErrorCode,
    message: string,
    public readonly fix?: string
  ) {
    super(message);
    this.name = 'FactoryError';
  }

  /**
   * Format error for display
   */
  format(): string {
    let output = `FactoryError[${this.code}]: ${this.message}`;
    if (this.fix) {
      output += `\n\n  Fix: ${this.fix}`;
    }
    return output;
  }

  /**
   * Convert to JSON for --json output
   */
  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      fix: this.fix,
    };
  }
}

// ============================================================================
// Error Factory Functions
// ============================================================================

/**
 * Create error for seeder not found
 */
export function seederNotFound(name: string): SeederError {
  return new SeederError(
    SeederErrorCode.SEEDER_NOT_FOUND,
    `Seeder '${name}' not found.`,
    `Check that the seeder exists in src/database/seeders/ and is properly exported.`
  );
}

/**
 * Create error for circular dependency
 */
export function circularDependency(cycle: string[]): SeederError {
  return new SeederError(
    SeederErrorCode.CIRCULAR_DEPENDENCY,
    `Circular dependency detected: ${cycle.join(' -> ')}`,
    `Review seeder dependencies and remove the circular reference.`
  );
}

/**
 * Create error for seeder execution failure
 */
export function executionFailed(name: string, cause: Error): SeederError {
  return new SeederError(
    SeederErrorCode.EXECUTION_FAILED,
    `Seeder '${name}' failed: ${cause.message}`,
    `Check the seeder implementation and database state.`
  );
}

/**
 * Create error for truncation failure
 */
export function truncationFailed(name: string, cause: Error): SeederError {
  return new SeederError(
    SeederErrorCode.TRUNCATION_FAILED,
    `Truncation failed for seeder '${name}': ${cause.message}`,
    `Check for foreign key constraints that may prevent truncation.`
  );
}

/**
 * Create error for dependency not found
 */
export function dependencyNotFound(seederName: string, dependencyName: string): SeederError {
  return new SeederError(
    SeederErrorCode.DEPENDENCY_NOT_FOUND,
    `Seeder '${seederName}' depends on '${dependencyName}' which was not found.`,
    `Ensure '${dependencyName}' exists in src/database/seeders/ and is registered.`
  );
}

/**
 * Create error for no seeders found
 */
export function noSeedersFound(path: string): SeederError {
  return new SeederError(
    SeederErrorCode.NO_SEEDERS_FOUND,
    `No seeders found in ${path}`,
    `Create a seeder with: velox generate seeder <name>`
  );
}

/**
 * Create error for database connection issue
 */
export function seederDatabaseError(operation: string, cause: Error): SeederError {
  return new SeederError(
    SeederErrorCode.DATABASE_ERROR,
    `Database error during ${operation}: ${cause.message}`,
    `Check your database connection and ensure it's running.`
  );
}

/**
 * Create error for factory not found
 */
export function factoryNotFound(name: string): FactoryError {
  return new FactoryError(
    SeederErrorCode.FACTORY_NOT_FOUND,
    `Factory '${name}' not found in registry.`,
    `Ensure the factory is properly instantiated before use.`
  );
}

/**
 * Create error for state not found
 */
export function stateNotFound(
  factoryName: string,
  stateName: string,
  available: string[]
): FactoryError {
  const availableStr = available.length > 0 ? available.join(', ') : 'none';
  return new FactoryError(
    SeederErrorCode.STATE_NOT_FOUND,
    `State '${stateName}' not found on factory '${factoryName}'.`,
    `Available states: ${availableStr}. Register states using registerState().`
  );
}

/**
 * Create error for factory creation failure
 */
export function factoryCreateFailed(modelName: string, cause: Error): FactoryError {
  return new FactoryError(
    SeederErrorCode.FACTORY_CREATE_FAILED,
    `Failed to create '${modelName}': ${cause.message}`,
    `Check the factory definition and ensure all required fields are provided.`
  );
}

/**
 * Create error for invalid seeder export
 */
export function invalidExport(filePath: string, reason: string): SeederError {
  return new SeederError(
    SeederErrorCode.INVALID_EXPORT,
    `Invalid seeder export in '${filePath}': ${reason}`,
    `Ensure the file exports a valid Seeder object with 'name' and 'run' properties.`
  );
}

/**
 * Create error for filesystem issue
 */
export function filesystemError(operation: string, path: string, cause: Error): SeederError {
  return new SeederError(
    SeederErrorCode.FILESYSTEM_ERROR,
    `Filesystem error during ${operation} at '${path}': ${cause.message}`,
    `Check file permissions and path validity.`
  );
}
