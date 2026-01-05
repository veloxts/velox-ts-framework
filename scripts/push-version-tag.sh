#!/bin/bash
# Create and push a git tag for the current version
#
# Reads version from package.json and creates a v{version} tag
# Then pushes the tag to trigger the GitHub release workflow

set -e

VERSION=$(node -p "require('./package.json').version")
TAG="v$VERSION"

echo "Creating tag: $TAG"
git tag "$TAG"

echo "Pushing tag to origin..."
git push origin "$TAG"

echo "Done! GitHub release workflow should now be triggered."
