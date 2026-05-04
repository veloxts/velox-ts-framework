---
'@veloxts/core': patch
'@veloxts/orm': patch
'@veloxts/events': patch
'@veloxts/cache': patch
'@veloxts/mail': patch
'@veloxts/queue': patch
'@veloxts/storage': patch
---

Plugin contract fixes — eliminates three workaround `addHook` blocks freehand projects need to write today.

- **`@veloxts/orm`**: `ctx.db` is now writable so middleware (e.g. transactional handlers) can swap in a tx client via `Object.assign(ctx, { db: tx })` without redefining the property.
- **`@veloxts/core`**: registers an empty-JSON-body fallback parser at app construction. POSTs with `Content-Type: application/json` and empty body now reach handlers as `input = {}` instead of being rejected with 400 by Fastify's default parser.
- **`@veloxts/events`, `@veloxts/cache`, `@veloxts/mail`, `@veloxts/queue`, `@veloxts/storage`**: each plugin now mirrors its `request.<name>` decoration onto the procedure context (`request.context.<name>`), matching the existing auth-plugin pattern. `ctx.events`, `ctx.cache`, `ctx.mail`, `ctx.queue`, `ctx.storage` are now populated automatically — no manual bridging hook required.
