/**
 * Storage Generator
 *
 * Scaffolds storage configuration and upload handler files for VeloxTS applications.
 *
 * Usage:
 *   velox make storage <name> [options]
 *
 * Examples:
 *   velox make storage avatar                # Local filesystem storage
 *   velox make storage document --s3         # S3/R2/MinIO storage
 *   velox make storage file --upload         # File upload handler
 */

import { BaseGenerator } from '../base.js';
import {
  getStorageInstructions,
  getStoragePath,
  type StorageOptions,
  storageTemplate,
} from '../templates/storage.js';
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
 * Storage generator - creates storage configuration and upload handlers
 */
export class StorageGenerator extends BaseGenerator<StorageOptions> {
  readonly metadata: GeneratorMetadata = {
    name: 'storage',
    description: 'Generate storage configurations and upload handlers',
    longDescription: `
Scaffold storage configurations and file upload handlers for VeloxTS applications.

Storage configurations support local filesystem, S3-compatible object storage (AWS S3,
Cloudflare R2, MinIO), and complete upload/download handlers with validation.

Examples:
  velox make storage avatar                # Local filesystem storage config
  velox make storage document --s3         # S3/R2/MinIO storage config
  velox make storage file --upload         # Upload handler with storage integration
  velox make storage media --local         # Explicit local storage
`,
    aliases: ['s', 'store'],
    category: 'infrastructure',
  };

  readonly options: ReadonlyArray<GeneratorOption> = [
    {
      name: 'local',
      short: 'l',
      description: 'Generate local filesystem storage configuration (default)',
      type: 'boolean',
      default: false,
    },
    {
      name: 's3',
      description: 'Generate S3/R2/MinIO storage configuration',
      type: 'boolean',
      default: false,
    },
    {
      name: 'upload',
      short: 'u',
      description: 'Generate file upload handler with storage integration',
      type: 'boolean',
      default: false,
    },
  ];

  /**
   * Validate and transform raw options
   */
  validateOptions(raw: Record<string, unknown>): StorageOptions {
    const local = Boolean(raw.local ?? false);
    const s3 = Boolean(raw.s3 ?? false);
    const upload = Boolean(raw.upload ?? false);

    // Validate mutually exclusive options
    const optionCount = [local, s3, upload].filter(Boolean).length;
    if (optionCount > 1) {
      throw new Error('Options --local, --s3, and --upload are mutually exclusive. Choose one.');
    }

    return {
      local,
      s3,
      upload,
    };
  }

  /**
   * Generate storage configuration or upload handler files
   */
  async generate(config: GeneratorConfig<StorageOptions>): Promise<GeneratorOutput> {
    const context = this.createContext(config);
    const files: GeneratedFile[] = [];

    // Generate storage file
    const storageContent = storageTemplate(context);
    files.push({
      path: getStoragePath(config.entityName, config.project, config.options),
      content: storageContent,
    });

    return {
      files,
      postInstructions: getStorageInstructions(config.entityName, config.options),
    };
  }
}

/**
 * Factory function for creating a StorageGenerator instance
 */
export function createStorageGenerator(): StorageGenerator {
  return new StorageGenerator();
}
