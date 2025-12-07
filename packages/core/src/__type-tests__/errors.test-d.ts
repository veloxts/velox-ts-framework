/**
 * Type tests for error classes
 *
 * These tests verify that VeloxError and subclasses
 * have correct type signatures.
 */

import { expectAssignable, expectType } from 'tsd';

// Import from the compiled dist folder directly
import {
  ConfigurationError,
  type GenericErrorResponse,
  isConfigurationError,
  isNotFoundError,
  isValidationError,
  isVeloxError,
  NotFoundError,
  type NotFoundErrorResponse,
  ValidationError,
  type ValidationErrorResponse,
  type VeloxCoreErrorCode,
  VeloxError,
} from '../../dist/index.js';

// ============================================================================
// VeloxError Type Tests
// ============================================================================

// Basic VeloxError construction
const error = new VeloxError('Test error', 500);
expectType<VeloxError<string>>(error);
expectType<number>(error.statusCode);
expectType<string | undefined>(error.code);
expectType<string>(error.message);

// VeloxError with code
const errorWithCode = new VeloxError('Test', 500, 'CUSTOM_CODE');
expectType<VeloxError<'CUSTOM_CODE'>>(errorWithCode);
expectType<'CUSTOM_CODE' | undefined>(errorWithCode.code);

// VeloxError with catalog code
const catalogError = new VeloxError('Test', 500, 'VELOX-1001');
expectType<string | undefined>(catalogError.fix);
expectType<string | undefined>(catalogError.docsUrl);

// toJSON returns correct type
const jsonResponse = error.toJSON();
expectAssignable<GenericErrorResponse>(jsonResponse);
expectType<string>(jsonResponse.error);
expectType<string>(jsonResponse.message);
expectType<number>(jsonResponse.statusCode);

// ============================================================================
// ValidationError Type Tests
// ============================================================================

// Basic ValidationError
const validationError = new ValidationError('Invalid input');
expectType<ValidationError>(validationError);
expectType<number>(validationError.statusCode);
// Code is set to 'VALIDATION_ERROR' by the constructor
if (validationError.code !== undefined) {
  expectAssignable<'VALIDATION_ERROR'>(validationError.code);
}

// ValidationError with fields
const validationErrorWithFields = new ValidationError('Invalid input', {
  email: 'Invalid email format',
  age: 'Must be a number',
});
expectType<Record<string, string> | undefined>(validationErrorWithFields.fields);

// toJSON returns ValidationErrorResponse
const validationJson = validationError.toJSON();
expectType<ValidationErrorResponse>(validationJson);
expectType<'ValidationError'>(validationJson.error);
expectType<400>(validationJson.statusCode);
expectType<'VALIDATION_ERROR'>(validationJson.code);

// ============================================================================
// NotFoundError Type Tests
// ============================================================================

// Basic NotFoundError
const notFoundError = new NotFoundError('User');
expectType<NotFoundError>(notFoundError);
expectType<number>(notFoundError.statusCode);
// Code is set to 'NOT_FOUND' by the constructor
if (notFoundError.code !== undefined) {
  expectAssignable<'NOT_FOUND'>(notFoundError.code);
}
expectType<string>(notFoundError.resource);

// NotFoundError with resourceId
const notFoundErrorWithId = new NotFoundError('User', '123');
expectType<string | undefined>(notFoundErrorWithId.resourceId);

// toJSON returns NotFoundErrorResponse
const notFoundJson = notFoundError.toJSON();
expectType<NotFoundErrorResponse>(notFoundJson);
expectType<'NotFoundError'>(notFoundJson.error);
expectType<404>(notFoundJson.statusCode);
expectType<'NOT_FOUND'>(notFoundJson.code);
expectType<string>(notFoundJson.resource);

// ============================================================================
// ConfigurationError Type Tests
// ============================================================================

const configError = new ConfigurationError('Missing config');
expectType<ConfigurationError>(configError);
expectType<number>(configError.statusCode);
// Code is set to 'CONFIGURATION_ERROR' by the constructor
if (configError.code !== undefined) {
  expectAssignable<'CONFIGURATION_ERROR'>(configError.code);
}

// ============================================================================
// Type Guard Tests
// ============================================================================

// Test type narrowing with isVeloxError
declare const unknownErr1: unknown;
if (isVeloxError(unknownErr1)) {
  expectType<VeloxError<string>>(unknownErr1);
  expectType<number>(unknownErr1.statusCode);
  expectType<string>(unknownErr1.message);
}

// Test type narrowing with isValidationError
declare const unknownErr2: unknown;
if (isValidationError(unknownErr2)) {
  expectType<ValidationError>(unknownErr2);
  expectType<number>(unknownErr2.statusCode);
  expectType<Record<string, string> | undefined>(unknownErr2.fields);
}

// Test type narrowing with isNotFoundError
declare const unknownErr3: unknown;
if (isNotFoundError(unknownErr3)) {
  expectType<NotFoundError>(unknownErr3);
  expectType<number>(unknownErr3.statusCode);
  expectType<string>(unknownErr3.resource);
}

// Test type narrowing with isConfigurationError
declare const unknownErr4: unknown;
if (isConfigurationError(unknownErr4)) {
  expectType<ConfigurationError>(unknownErr4);
  expectType<number>(unknownErr4.statusCode);
}

// ============================================================================
// Error Code Types
// ============================================================================

// VeloxCoreErrorCode should be a union of string literals
const coreCode: VeloxCoreErrorCode = 'VALIDATION_ERROR';
expectAssignable<VeloxCoreErrorCode>(coreCode);
// The literal type 'VALIDATION_ERROR' should be assignable to VeloxCoreErrorCode
expectType<'VALIDATION_ERROR'>(coreCode);

// ============================================================================
// Inheritance Tests
// ============================================================================

// All error classes should extend Error
expectAssignable<Error>(error);
expectAssignable<Error>(validationError);
expectAssignable<Error>(notFoundError);
expectAssignable<Error>(configError);

// All custom errors should extend VeloxError
expectAssignable<VeloxError>(validationError);
expectAssignable<VeloxError>(notFoundError);
expectAssignable<VeloxError>(configError);
