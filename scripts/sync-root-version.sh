#!/bin/bash
# Sync root package.json version from @veloxts/core
#
# After changeset bumps package versions, this script copies
# the version from packages/core/package.json to the root package.json

set -e

CORE_VERSION=$(node -p "require('./packages/core/package.json').version")

echo "Syncing root package.json version to: $CORE_VERSION"

node -e "
const fs = require('fs');
const files = [
  'package.json',
  'apps/docs/package.json',
  'apps/playground/package.json',
];
for (const file of files) {
  const pkg = JSON.parse(fs.readFileSync(file));
  pkg.version = '$CORE_VERSION';
  fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
  console.log('  Updated ' + file);
}
"

echo "Done!"
