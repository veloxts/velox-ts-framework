# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.7.x   | :white_check_mark: |
| < 0.7   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in VeloxTS, please report it responsibly.

**Email:** security@veloxts.dev

Please include:

- A description of the vulnerability
- Steps to reproduce the issue
- The affected package(s) and version(s)
- Any potential impact assessment

**Please do not** open a public GitHub issue for security vulnerabilities.

## Response Timeline

- **Acknowledgment:** Within 48 hours of report
- **Initial assessment:** Within 1 week
- **Fix timeline:** Depends on severity
  - Critical: Patch release within 72 hours
  - High: Patch release within 1 week
  - Medium: Included in next scheduled release
  - Low: Addressed in future release

## Scope

### In scope

- All `@veloxts/*` packages published on npm
- `create-velox-app` scaffolder
- VeloxTS documentation site

### Out of scope

- Third-party dependencies (report to their maintainers directly)
- User applications built with VeloxTS
- Development tooling and test infrastructure

## Security Best Practices

For production deployment guidance, see the [Production Security Checklist](https://veloxts.dev/docs/deployment/security) in our documentation.

## Credit

We appreciate responsible disclosure and will credit reporters in release notes (unless anonymity is preferred).
