# GitHub Workflows

This directory contains the CI/CD workflow for the VeloxTS monorepo.

## Quick Reference

### Single Workflow: `ci.yml`

**Runs on:**
- All branch pushes (CI checks)
- Pull requests to main (validation)
- Main branch pushes (CI + potential release)

**Job Sequence:**

```
Test → Build → Smoke Test → Release
                               ↑
                         (only on main)
```

### What Happens When...

| Event | Test | Build | Smoke Test | Release |
|-------|------|-------|------------|---------|
| Push to feature branch | ✅ | ✅ | ✅ | ❌ Skipped (not main) |
| Open PR to main | ✅ | ✅ | ✅ | ❌ Skipped (not push) |
| Merge PR to main (no changesets) | ✅ | ✅ | ✅ | ✅ Creates Release PR |
| Merge Release PR (with changesets) | ✅ | ✅ | ✅ | ✅ **Publishes to npm** |

### Release Process

1. **Develop:** Create feature branch, make changes
2. **Changeset:** Run `pnpm changeset` to document version bump
3. **PR:** Open PR, CI validates (test + build + smoke test)
4. **Merge:** Merge PR, CI creates "Release PR" with version bumps
5. **Release:** Merge "Release PR", CI publishes to npm

### Key Features

- **Sequential execution:** Each job waits for previous to succeed
- **Artifact reuse:** Build once, reuse in smoke-test and release jobs
- **Conditional release:** Only runs on main, only publishes if changesets exist
- **Fail fast:** Test failures prevent build/release

## Documentation

See [WORKFLOWS.md](./WORKFLOWS.md) for detailed documentation including:
- Architecture explanation
- Job dependencies
- Troubleshooting guide
- Comparison with old setup
- Advanced customization options
