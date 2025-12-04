# Claude Code Agent Recommendations

This document outlines when and how to use specialized Claude Code agents during VeloxTS framework development.

---

## Overview

Claude Code agents are specialized AI assistants with deep expertise in specific domains. Using the right agent for each task can dramatically improve code quality and development speed.

**General Guidance:**
- Use agents for complex, specialized tasks
- Provide clear context about the VeloxTS framework
- Reference this document when invoking agents
- Combine multiple agents for comprehensive solutions

---

## Agent Directory

### 1. TypeScript Architecture Specialist

**Best For:** Advanced type systems, generic constraints, type inference patterns

**When to Use:**
- **Phase 2-5:** Building @veloxts/core, @veloxts/validation, @veloxts/router, @veloxts/orm
- Designing the procedure builder type system
- Implementing type-safe context decorations
- Creating type inference utilities for @veloxts/client
- Optimizing TypeScript compilation performance

**What They Excel At:**
- Conditional types and mapped types
- Template literal types
- Generic constraints and inference
- Declaration merging patterns
- Type-level programming
- Compiler performance optimization

**Example Prompt:**
```
You are a TypeScript architecture specialist working on the VeloxTS framework.
We're building a procedure builder API that needs to:
1. Infer input types from Zod schemas
2. Infer output types from Zod schemas
3. Thread context types through middleware
4. Provide excellent IDE autocomplete

Current context: [paste relevant code]

Please design the type system for our procedure builder, focusing on:
- Type inference without explicit annotations
- Clear error messages when types don't match
- Performance (avoid overly complex types)

The final API should feel magical but be maintainable.
```

**Value Add:**
- Complex types that "just work"
- Excellent error messages
- Compile-time safety without runtime overhead
- Maintainable type code

---

### 2. API Design & Developer Experience Expert

**Best For:** Developer-facing APIs, fluent interfaces, configuration design

**When to Use:**
- **Phase 2, 4, 7:** Designing @veloxts/core, @veloxts/router, @veloxts/client APIs
- Creating the procedure builder interface
- Designing plugin registration APIs
- Structuring configuration objects
- Improving error messages

**What They Excel At:**
- Fluent interface design
- Progressive disclosure of complexity
- Consistent API patterns
- Self-documenting code
- Error message design
- Onboarding experience

**Example Prompt:**
```
You are an API design expert focused on developer experience.
We're designing the procedure definition API for VeloxTS framework.

Requirements:
- Developers should define business logic with minimal boilerplate
- Type inference should be automatic
- Common cases should be simple, complex cases should be possible
- API should be memorable and consistent

Current design: [paste code]

Please critique this API and suggest improvements focusing on:
1. Discoverability - can developers figure it out without docs?
2. Type safety - are mistakes caught at compile time?
3. Consistency - does it match patterns elsewhere in the framework?
4. Error messages - are errors helpful?
```

**Value Add:**
- Intuitive APIs that are hard to misuse
- Great first-time experience
- Clear error messages
- Consistent patterns

---

### 3. Monorepo & Build Tooling Specialist

**Best For:** Build optimization, monorepo configuration, CI/CD pipelines

**When to Use:**
- **Phase 1:** Initial monorepo setup
- **Ongoing:** Build performance issues
- Configuring Turborepo caching
- Setting up TypeScript project references
- Optimizing CI/CD pipelines
- Debugging build errors

**What They Excel At:**
- Turborepo configuration
- pnpm workspace optimization
- TypeScript project references
- Build caching strategies
- CI/CD pipeline design
- Package publishing workflows

**Example Prompt:**
```
You are a monorepo specialist working with pnpm + Turborepo.
The VeloxTS framework has 8 packages with this dependency graph:
[paste dependency graph]

Goals:
1. Fast local development (< 5 second rebuilds)
2. Efficient CI/CD (maximize cache hits)
3. Correct build order
4. Support for parallel builds where possible

Current turbo.json: [paste config]

Please optimize our Turborepo configuration and suggest:
- Task pipeline improvements
- Caching strategies
- Package.json script organization
- TypeScript project reference setup
```

**Value Add:**
- Fast builds locally and in CI
- Correct dependency handling
- Optimal caching
- Clear build errors

---

### 4. Testing Strategy Specialist

**Best For:** Test architecture, coverage strategies, test utilities

**When to Use:**
- **All phases:** Writing tests for each package
- Designing test infrastructure
- Creating integration tests
- Setting up type testing
- Achieving coverage goals
- Writing test utilities

**What They Excel At:**
- Test pyramid architecture
- Unit vs integration test balance
- Testing async code
- Type testing patterns
- Mock strategies
- Test utilities design

**Example Prompt:**
```
You are a testing specialist for a TypeScript framework.
We're building @veloxts/router which includes:
- Procedure builder (complex types)
- tRPC integration
- REST adapter with conventions

What testing strategy should we use?
Please design:
1. Unit tests - what to test, how to structure
2. Integration tests - key workflows to validate
3. Type tests - ensuring type inference works
4. Test utilities - what helpers would be useful

Consider:
- Tests should be fast (< 1 second per package)
- Types should be tested, not just runtime behavior
- Tests should catch regressions
```

**Value Add:**
- Comprehensive test coverage
- Fast test execution
- Clear test failures
- Type safety validation

---

### 5. Node.js Performance Engineer

**Best For:** Runtime optimization, async patterns, profiling

**When to Use:**
- **Phase 2, 4, 5:** Optimizing @veloxts/core, @veloxts/router, @veloxts/orm
- Fastify server optimization
- Middleware performance
- Database connection pooling
- Profiling hot paths
- Memory leak investigation

**What They Excel At:**
- Event loop optimization
- Async/await patterns
- Stream processing
- Memory management
- HTTP server tuning
- Database connection optimization

**Example Prompt:**
```
You are a Node.js performance engineer.
Our @veloxts/core package wraps Fastify and provides a plugin system.

Performance requirements:
- Request latency < 10ms (p50) for simple endpoints
- Memory usage < 100MB baseline
- Handle 10k+ req/s on single core

Current implementation: [paste code]

Please analyze and suggest optimizations for:
1. Request handling path (reduce allocations)
2. Plugin registration (avoid unnecessary work)
3. Context creation (minimize overhead)
4. Middleware chain (optimize execution)

Use profiling data to guide suggestions.
```

**Value Add:**
- Low latency
- High throughput
- Efficient memory usage
- Bottleneck identification

---

### 6. CLI & Developer Tooling Expert

**Best For:** Command-line tools, interactive prompts, code generation

**When to Use:**
- **Phase 5:** Building @veloxts/cli and create-velox-app
- Designing command structure
- Creating interactive wizards
- Implementing code generators
- File watching and hot reload
- Terminal UX design

**What They Excel At:**
- CLI framework usage
- Interactive prompt design
- Code generation templates
- File system operations
- Terminal output formatting
- Cross-platform compatibility

**Example Prompt:**
```
You are a CLI tooling expert building developer tools.
We're creating the `velox` CLI with these commands:
- velox dev (hot reload development server)
- velox migrate (run database migrations)
- velox generate <type> <name> (code generation)

Requirements:
- Beautiful terminal output (colors, progress bars, spinners)
- Clear error messages with suggestions
- Fast execution
- Cross-platform (Mac, Linux, Windows)

Please design the CLI architecture and suggest:
1. Command structure (Commander.js setup)
2. Interactive prompts (when to use Clack)
3. Code generation strategy (templates vs AST manipulation)
4. Error handling and recovery
```

**Value Add:**
- Beautiful terminal UX
- Fast, responsive commands
- Helpful error messages
- Great first-time experience

---

### 7. Security & Authentication Specialist

**Best For:** Auth systems, security best practices, vulnerability prevention

**When to Use:**
- **Phase 8 (v1.1):** Building @veloxts/auth
- JWT implementation
- Password hashing
- CSRF protection
- Rate limiting
- Security audit

**What They Excel At:**
- Authentication patterns
- JWT best practices
- Password security
- OWASP top 10
- Rate limiting strategies
- Session management

**Example Prompt:**
```
You are a security engineer specializing in web application authentication.
We're building @veloxts/auth for the VeloxTS framework with:
- JWT-based authentication
- Guards and policies (Laravel-style)
- Password hashing

Security requirements:
- Follow OWASP best practices
- Protect against common attacks (timing, CSRF, etc.)
- Secure defaults
- But maintain good DX

Please design the auth system covering:
1. JWT token generation and validation
2. Password hashing strategy (bcrypt vs argon2)
3. CSRF protection approach
4. Rate limiting integration
5. Security headers

Prioritize security but keep the API developer-friendly.
```

**Value Add:**
- Secure by default
- OWASP compliance
- Protection against common attacks
- Security best practices

---

### 8. Documentation & Technical Writing Specialist

**Best For:** Documentation sites, guides, tutorials, API references

**When to Use:**
- **Phase 6:** Writing MVP documentation
- **Phase 11 (v1.1):** Full documentation site
- Creating getting started guides
- Writing API reference
- Recording video tutorials
- Migration guides

**What They Excel At:**
- Documentation structure
- Clear explanations
- Code examples
- Learning pathways
- Technical writing
- SEO optimization

**Example Prompt:**
```
You are a technical writer specializing in developer documentation.
We're documenting the VeloxTS framework for TypeScript developers.

Target audience:
- Full-stack TypeScript developers
- Solo developers
- Teams migrating from Express/NestJS

Framework concepts to explain:
- Procedure definition (core concept)
- Type safety without codegen (unique value prop)
- Hybrid API (tRPC + REST)
- Convention over configuration

Please create:
1. Documentation site structure (sidebar navigation)
2. Getting started guide (step-by-step)
3. Core concepts section outline
4. API reference format

Reference great docs: Laravel, Prisma, tRPC, Fastify.
Documentation should progress from simple to complex.
```

**Value Add:**
- Clear, comprehensive docs
- Great onboarding experience
- Searchable, organized content
- Runnable code examples

---

### 9. Full-Stack Integration Specialist

**Best For:** End-to-end applications, frontend-backend integration, React patterns

**When to Use:**
- **Phase 4, 6-7:** Building playground app, testing @veloxts/client
- Validating type safety end-to-end
- Creating React hooks
- Testing full-stack workflows
- Building example applications

**What They Excel At:**
- Full-stack TypeScript
- React patterns
- State management
- API client integration
- Type safety validation
- Real-world use cases

**Example Prompt:**
```
You are a full-stack TypeScript developer building with VeloxTS.
We need to validate that type safety works end-to-end.

Build a simple playground app that:
1. Defines procedures on backend (users CRUD)
2. Consumes them type-safely on frontend
3. Uses React Query for data fetching
4. Demonstrates the full DX

Please:
- Show complete code for both backend and frontend
- Highlight where type inference happens
- Document any DX friction points
- Suggest improvements to framework APIs

Focus on the developer experience from a user's perspective.
```

**Value Add:**
- Real-world validation
- DX feedback
- Integration testing
- Example applications

---

## Agent Sequencing by Phase

### Week 1: Foundation
- **Primary:** Monorepo & Build Tooling Specialist
- **Support:** TypeScript Architecture Specialist (for tsconfig setup)

### Week 2: Router + Validation
- **Primary:** TypeScript Architecture Specialist (procedure types)
- **Primary:** API Design & DX Expert (procedure API)
- **Support:** Testing Strategy Specialist

### Week 3: ORM + Client
- **Primary:** Node.js Performance Engineer (ORM optimization)
- **Primary:** TypeScript Architecture Specialist (client types)
- **Support:** Testing Strategy Specialist

### Week 4: Playground
- **Primary:** Full-Stack Integration Specialist
- **Support:** API Design & DX Expert (feedback)

### Week 5: CLI + Create
- **Primary:** CLI & Developer Tooling Expert
- **Support:** Monorepo Specialist (build integration)

### Week 6: Polish + Release
- **Primary:** Documentation & Technical Writing Specialist
- **Support:** All specialists (for review)

### Post-MVP (v1.1): Auth
- **Primary:** Security & Authentication Specialist
- **Support:** API Design & DX Expert

---

## How to Invoke Agents

### Via Claude Code

```markdown
I need help from a [specialist type] to [specific task].

Context:
- We're building the VeloxTS framework
- Current phase: [phase]
- Specific challenge: [challenge]

[Provide relevant code/context]

Please [specific request].
```

### Best Practices

1. **Be Specific:** Don't ask "help with types", ask "design the procedure builder type system"
2. **Provide Context:** Share relevant code, requirements, and constraints
3. **State Goals:** What does success look like?
4. **Reference Examples:** Point to similar patterns in other frameworks
5. **Iterate:** Start with high-level design, then refine details

---

## Agent Anti-Patterns

### ❌ Don't Do This:
- Using an agent without providing context about VeloxTS
- Asking for general advice instead of specific solutions
- Not providing current code for review
- Ignoring agent recommendations without discussion
- Using wrong agent for the task (e.g., CLI expert for type system)

### ✅ Do This Instead:
- Provide full context about VeloxTS's goals and architecture
- Ask for specific, actionable solutions
- Share current implementation for critique
- Discuss trade-offs and alternatives
- Choose the right specialist for each task

---

## Combining Multiple Agents

For complex tasks, use multiple agents in sequence:

**Example: Designing Procedure Builder**

1. **API Design Expert:** Design the developer-facing API
2. **TypeScript Specialist:** Implement the type system
3. **Testing Specialist:** Design the test strategy
4. **Performance Engineer:** Optimize hot paths
5. **Documentation Writer:** Document the API

Each agent builds on the previous one's work, creating a comprehensive solution.

---

## Agent Selection Flowchart

```
Is it about types? → TypeScript Architecture Specialist
Is it about API design? → API Design & DX Expert
Is it about build system? → Monorepo & Build Tooling Specialist
Is it about testing? → Testing Strategy Specialist
Is it about performance? → Node.js Performance Engineer
Is it about CLI tools? → CLI & Developer Tooling Expert
Is it about security/auth? → Security & Authentication Specialist
Is it about documentation? → Documentation & Technical Writing Specialist
Is it about full-stack integration? → Full-Stack Integration Specialist
```

---

**Remember:** Agents are tools to accelerate development, not replacements for understanding the code. Always review and understand agent suggestions before implementing them.
