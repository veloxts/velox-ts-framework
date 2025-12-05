# CI/CD Workflow Migration Summary

## Changes Made

### Deleted Files

- `.github/workflows/smoke-test.yml` (merged into ci.yml)
- `.github/workflows/release.yml` (merged into ci.yml)

### Modified Files

- `.github/workflows/ci.yml` (complete rewrite with 4 sequential jobs)

### New Files

- `.github/WORKFLOWS.md` (comprehensive documentation)
- `.github/workflows/README.md` (quick reference)

## Problem → Solution

### Problem 1: Release Publishes Without Version Bump

**Old behavior:**
```yaml
# release.yml ran on every push to main
on:
  push:
    branches: [main]

# Always ran build + changesets action
- name: Build
  run: pnpm ci:build
- name: Create Release Pull Request or Publish
  uses: changesets/action@v1
```

**Issue:** Wasted CI minutes building on every push, even when nothing to release.

**New behavior:**
```yaml
# Release job only runs on main, after all tests pass
release:
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  needs: [test, build, smoke-test]
  
  # Reuses build artifacts instead of rebuilding
  - name: Download build artifacts
    uses: actions/download-artifact@v4
```

**Benefits:**
- No duplicate builds (reuses artifacts from build job)
- Changesets still controls when to publish (smart by default)
- Clear conditional logic (only on main pushes)

### Problem 2: Workflows Run Independently Instead of Sequentially

**Old behavior:**
```
Push to main → 3 workflows run in parallel:

ci.yml          smoke-test.yml    release.yml
  ↓                   ↓                ↓
Build             Build            Build
  ↓                   ↓                ↓
Test            Smoke Test      Changesets
```

**Issues:**
- 3 builds on every main push (wasteful)
- No dependency between jobs (could publish broken code)
- No way to prevent release if tests fail

**New behavior:**
```
Push to main → 1 workflow with sequential jobs:

Test
  ↓ (needs: [])
Build
  ↓ (needs: [test])
Smoke Test
  ↓ (needs: [build])
Release (only on main)
  ↓ (needs: [test, build, smoke-test])
Publish (only if changesets exist)
```

**Benefits:**
- 1 build per push (efficient)
- Guaranteed order (release only after all checks pass)
- Artifact reuse (build once, download in smoke-test and release)
- Fail fast (test failure prevents build/release)

## Technical Details

### Job Dependencies

Each job declares prerequisites using `needs: [...]`:

```yaml
jobs:
  test:
    needs: []  # Runs first

  build:
    needs: [test]  # Only runs if test succeeds

  smoke-test:
    needs: [build]  # Only runs if build succeeds

  release:
    needs: [test, build, smoke-test]  # Only runs if ALL succeed
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
```

### Artifact Caching

Build outputs are cached between jobs:

```yaml
# Build job uploads artifacts
- name: Upload build artifacts
  uses: actions/upload-artifact@v4
  with:
    name: build-artifacts
    path: |
      packages/*/dist
      packages/*/tsconfig.tsbuildinfo

# Smoke-test and release jobs download artifacts
- name: Download build artifacts
  uses: actions/download-artifact@v4
  with:
    name: build-artifacts
```

This prevents rebuilding packages 3 times.

### Conditional Execution

The release job uses GitHub Actions conditionals:

```yaml
if: github.ref == 'refs/heads/main' && github.event_name == 'push'
```

This ensures:
- Feature branches skip release (not on main)
- Pull requests skip release (not push event)
- Only direct pushes to main trigger release

### Changesets Integration

The `changesets/action@v1` handles smart publishing:

```yaml
- name: Create Release Pull Request or Publish
  id: changesets
  uses: changesets/action@v1
  with:
    version: pnpm changeset version
    publish: pnpm changeset publish
```

Behavior:
- **No changesets:** Creates/updates Release PR, does NOT publish
- **Changesets exist:** Bumps versions, publishes to npm
- **Already published:** Does nothing (idempotent)

## Workflow Behavior Matrix

| Branch | Event | Test | Build | Smoke | Release | Publish |
|--------|-------|------|-------|-------|---------|---------|
| feature/x | push | ✅ | ✅ | ✅ | ❌ Skip | ❌ No |
| feature/x | PR to main | ✅ | ✅ | ✅ | ❌ Skip | ❌ No |
| main | push (no changesets) | ✅ | ✅ | ✅ | ✅ Run | ❌ No (creates PR) |
| main | push (Release PR merge) | ✅ | ✅ | ✅ | ✅ Run | ✅ Yes |

## Before and After Comparison

### Before (3 workflows)

**Feature branch push:**
- ci.yml runs: test + build
- smoke-test.yml SKIPPED (only on main)
- release.yml SKIPPED (only on main)
- **Total:** 1 build

**Push to main:**
- ci.yml runs: test + build
- smoke-test.yml runs: build + smoke test
- release.yml runs: build + changesets
- **Total:** 3 builds (wasteful!)

### After (1 workflow)

**Feature branch push:**
- Test job runs
- Build job runs (uploads artifacts)
- Smoke Test job runs (downloads artifacts)
- Release job SKIPPED (not on main)
- **Total:** 1 build

**Push to main:**
- Test job runs
- Build job runs (uploads artifacts)
- Smoke Test job runs (downloads artifacts)
- Release job runs (downloads artifacts, conditionally publishes)
- **Total:** 1 build (efficient!)

## Migration Checklist

- [x] Deleted redundant workflow files
- [x] Combined all jobs into single workflow
- [x] Added job dependencies with `needs`
- [x] Implemented artifact caching
- [x] Added conditional release logic
- [x] Validated YAML syntax
- [x] Created documentation

## Testing Recommendations

To test the new workflow:

1. **Feature branch push:**
   ```bash
   git checkout -b test/workflow
   git commit --allow-empty -m "test: workflow validation"
   git push origin test/workflow
   ```
   Expected: Test → Build → Smoke Test (Release skipped)

2. **Pull request:**
   ```bash
   # Open PR from test/workflow to main
   ```
   Expected: Test → Build → Smoke Test (Release skipped)

3. **Main push (no changesets):**
   ```bash
   git checkout main
   git merge test/workflow
   git push origin main
   ```
   Expected: Test → Build → Smoke Test → Release (creates Release PR)

4. **Main push (with changesets):**
   ```bash
   # Merge the auto-generated Release PR
   ```
   Expected: Test → Build → Smoke Test → Release (publishes to npm)

## Rollback Plan

If issues arise, restore old workflows:

```bash
git revert <commit-hash>  # Revert this migration
git push origin main
```

The old workflow files are preserved in git history.

## Additional Notes

- **npm provenance:** Added `id-token: write` permission for npm package provenance
- **GitHub summary:** Release job now outputs published packages to GitHub step summary
- **Artifact retention:** Build artifacts expire after 1 day (configurable)
- **Timeout:** Smoke test has 10-minute timeout (same as before)

## Questions or Issues?

See full documentation in `.github/WORKFLOWS.md` for:
- Detailed architecture explanation
- Troubleshooting guide
- Advanced customization options
- Release process walkthrough
