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
const root = JSON.parse(fs.readFileSync('package.json'));
root.version = '$CORE_VERSION';
fs.writeFileSync('package.json', JSON.stringify(root, null, 2) + '\n');
"

echo "Done!"
