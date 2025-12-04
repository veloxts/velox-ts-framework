#!/usr/bin/env node
/**
 * Demo script to showcase the CLI's beautiful output
 */

const {
  printBanner,
  success,
  error,
  warning,
  info,
  step,
  instruction,
  formatCommand,
  formatPath,
} = require('./dist/utils/output.js');

console.log('\n=== VeloxTS CLI Output Demo ===\n');

// Banner
printBanner('0.1.0');

// Success message
success('Server started successfully!');

// Info message
info('Detecting entry point...');

// Step messages
step('Loading configuration...');
step('Registering plugins...');
step('Starting server...');

// Warning message
warning('Development mode - not for production use');

// Error message
error('Failed to connect to database');

// Instructions
instruction('Run `velox dev` to start the development server');

// Formatted values
console.log('Entry point:', formatPath('/path/to/src/index.ts'));
console.log('Command:', formatCommand('velox dev --port 8080'));

console.log('\n=== Demo Complete ===\n');
