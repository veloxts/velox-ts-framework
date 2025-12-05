# GitHub Workflows Documentation

## Overview

The VeloxTS monorepo uses a **single sequential CI/CD workflow** that handles testing, building, smoke testing, and npm publishing in the correct order.

## Workflow Architecture

### File: `.github/workflows/ci.yml`

This workflow runs on:
- **All branches** when code is pushed (for CI checks)
- **Pull requests** to main (for validation before merge)
- **Main branch** pushes (for CI checks + potential release)

### Job Sequence

The workflow consists of 4 jobs that run sequentially:

```
┌─────────┐
│  Test   │  Job 1: Type-check, lint, unit tests (fail fast)
└────┬────┘
     │ needs: []
     ▼
┌─────────┐
│  Build  │  Job 2: Build all packages with Turborepo
└────┬────┘
     │ needs: [test]
     │ artifacts: Upload build outputs for reuse
     ▼
┌──────────────┐
│  Smoke Test  │  Job 3: End-to-end test of create-velox-app
└──────┬───────┘
       │ needs: [build]
       │ artifacts: Download build outputs
       ▼
┌─────────┐
│ Release │  Job 4: Publish to npm (only on main, only if changesets exist)
└─────────┘
  needs: [test, build, smoke-test]
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
```

## How It Works

### On Feature Branch Pushes

When you push to a feature branch (e.g., `feature/new-api`):

1. **Test job** runs (type-check, lint, tests)
2. **Build job** runs (builds packages)
3. **Smoke Test job** runs (validates scaffolder)
4. **Release job** is **SKIPPED** (not on main branch)

Result: Full CI validation without publishing.

### On Pull Request to Main

When you open a PR to main:

1. **Test job** runs
2. **Build job** runs
3. **Smoke Test job** runs
4. **Release job** is **SKIPPED** (not a push event)

Result: Ensures PR is safe to merge.

### On Main Branch Pushes (After Merge)

When you merge a PR or push directly to main:

#### Scenario A: No Changesets Present

1. **Test job** runs
2. **Build job** runs
3. **Smoke Test job** runs
4. **Release job** runs but:
   - Changesets detects no `.changeset/*.md` files
   - Creates/updates a "Release PR" with pending changes
   - **Does NOT publish to npm**

Result: CI validation + Release PR created.

#### Scenario B: Changesets Present (Merging Release PR)

1. **Test job** runs
2. **Build job** runs
3. **Smoke Test job** runs
4. **Release job** runs and:
   - Changesets detects version bumps in `package.json`
   - Runs `pnpm changeset publish`
   - **Publishes packages to npm**
   - Updates GitHub release notes

Result: Packages published to npm only if versions were bumped.

## Key Features

### 1. Sequential Execution with Dependencies

Each job declares dependencies using `needs: [...]`:

```yaml
build:
  needs: [test]  # Only runs if test succeeds

smoke-test:
  needs: [build]  # Only runs if build succeeds

release:
  needs: [test, build, smoke-test]  # Only runs if ALL previous jobs succeed
```

This ensures:
- Fast failure (test fails = build never runs)
- No broken code is published (smoke test must pass)
- Minimal CI minutes (dependent jobs don't run if prerequisite fails)

### 2. Build Artifact Reuse

Build artifacts are cached between jobs:

```yaml
# In build job
- name: Upload build artifacts
  uses: actions/upload-artifact@v4
  with:
    name: build-artifacts
    path: |
      packages/*/dist
      packages/*/tsconfig.tsbuildinfo
    retention-days: 1

# In smoke-test and release jobs
- name: Download build artifacts
  uses: actions/download-artifact@v4
  with:
    name: build-artifacts
```

Benefits:
- Smoke test doesn't need to rebuild packages
- Release job doesn't need to rebuild packages
- Faster CI execution (build once, reuse twice)

### 3. Conditional Release Job

The release job only runs when:

```yaml
if: github.ref == 'refs/heads/main' && github.event_name == 'push'
```

This prevents:
- Publishing from feature branches
- Publishing from pull request checks
- Duplicate release attempts

### 4. Changesets Smart Publishing

The `changesets/action@v1` is intelligent:

- **No changesets:** Creates/updates Release PR, does NOT publish
- **Changesets exist:** Bumps versions, publishes to npm, creates GitHub releases
- **Already published:** Does nothing (idempotent)

This means:
- Pushing to main without changesets = no publish (safe)
- Merging Release PR = automatic publish (version bump detected)
- No manual intervention needed

## Release Process Workflow

### Step 1: Develop Feature

```bash
git checkout -b feature/new-api
# Make changes
git commit -m "feat: add new API endpoint"
git push origin feature/new-api
```

CI runs: Test → Build → Smoke Test (Release skipped)

### Step 2: Create Changeset

```bash
pnpm changeset
# Select packages to bump
# Choose version bump type (major, minor, patch)
# Write changelog entry
git add .changeset/
git commit -m "chore: add changeset for new API"
git push
```

CI runs again: Test → Build → Smoke Test (Release skipped)

### Step 3: Merge PR to Main

Merge the feature branch PR.

CI runs: Test → Build → Smoke Test → Release
- Release job creates/updates "Release PR" with version bumps
- **Does NOT publish yet**

### Step 4: Merge Release PR

Review and merge the auto-generated "Release PR".

CI runs: Test → Build → Smoke Test → Release
- Release job detects version bumps in package.json
- **Publishes packages to npm**
- Creates GitHub release with changelog

## Troubleshooting

### Build Artifacts Not Found

If smoke-test or release job fails with "artifact not found":

1. Check that the build job completed successfully
2. Verify artifact paths in `upload-artifact` match actual build output
3. Ensure artifact name matches between upload and download steps

### Release Job Publishes Unexpectedly

If packages are published without merging Release PR:

1. Check if there are uncommitted version bumps in package.json files
2. Verify the Release PR was not auto-merged by a bot
3. Review changesets action logs for debugging

### CI Runs Too Long

If CI takes too long:

1. Check Turborepo cache is working (`cache: 'pnpm'` in setup-node)
2. Review artifact upload/download sizes (exclude unnecessary files)
3. Consider splitting test job into parallel jobs (unit, integration, e2e)

## Advanced Customization

### Running Jobs in Parallel

If you need to run some jobs in parallel (e.g., different test suites):

```yaml
jobs:
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps: [...]

  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    steps: [...]

  build:
    needs: [unit-tests, integration-tests]  # Wait for both
    runs-on: ubuntu-latest
    steps: [...]
```

### Adding Manual Approval

To require manual approval before publishing:

```yaml
release:
  needs: [test, build, smoke-test]
  environment:
    name: production
    url: https://www.npmjs.com/org/veloxts
```

Then configure "production" environment protection rules in GitHub Settings.

### Skipping CI

To skip CI on specific commits (e.g., documentation changes):

```bash
git commit -m "docs: update README [skip ci]"
```

The `[skip ci]` tag prevents the workflow from running.

## Comparison: Old vs New

### Old Setup (3 Separate Workflows)

```
Push to main triggers:

┌─────────────────┐
│ ci.yml          │ (runs independently)
│ - Type check    │
│ - Lint          │
│ - Build         │
│ - Test          │
└─────────────────┘

┌─────────────────┐
│ smoke-test.yml  │ (runs independently)
│ - Build         │ (duplicate!)
│ - Smoke test    │
└─────────────────┘

┌─────────────────┐
│ release.yml     │ (runs independently)
│ - Build         │ (duplicate!)
│ - Changesets    │
└─────────────────┘

Problems:
- 3 builds on every main push (wasteful)
- No dependency between jobs (release could run before tests finish)
- No artifact reuse (each workflow rebuilds)
```

### New Setup (1 Sequential Workflow)

```
Push to main triggers:

┌─────────────────┐
│ Test            │ (fail fast)
└────────┬────────┘
         ▼
┌─────────────────┐
│ Build           │ (once, cache artifacts)
└────────┬────────┘
         ▼
┌─────────────────┐
│ Smoke Test      │ (reuse artifacts)
└────────┬────────┘
         ▼
┌─────────────────┐
│ Release         │ (reuse artifacts, conditional on main)
└─────────────────┘

Benefits:
- 1 build per push (efficient)
- Sequential execution (release only after all checks pass)
- Artifact reuse (build once, use twice)
- Conditional release (only on main, only if changesets exist)
```

## Summary

The new workflow architecture provides:

1. **Correctness:** Release only happens after all checks pass
2. **Efficiency:** Build once, reuse artifacts, skip unnecessary jobs
3. **Safety:** Changesets controls when packages are published
4. **Visibility:** Single workflow to monitor, clear job dependencies
5. **Maintainability:** One file to update instead of three

This is the production-ready pattern used by major monorepo projects like Turborepo, Changesets, and tRPC.
