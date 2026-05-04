---
'@veloxts/router': minor
---

Add `raw()` response primitive for procedures.

Procedure handlers can now return non-JSON HTTP responses — redirects, cookies, custom headers, raw bodies, streams — without bypassing the procedure system. This closes the gap exposed by the `ara/apps/api` audit, where the OAuth callback at `src/auth/atlassian.routes.ts` had to be a raw `fastify.get(...)` route because procedures couldn't model `reply.redirect()` or cookies.

```typescript
import { procedure, raw } from '@veloxts/router';

export const oauthProcedures = procedures('oauth', {
  authorize: procedure()
    .rest({ method: 'GET', path: '/auth/atlassian' })
    .query(async ({ ctx }) => {
      const { url, state, codeVerifier } = provider.buildAuthorizeUrl();
      return raw({
        cookies: [
          {
            name: 'oauth_state',
            value: pack(state, codeVerifier, secret),
            options: { httpOnly: true, sameSite: 'lax' },
          },
        ],
        redirect: { url, status: 302 },
      });
    }),
});
```

`raw()` accepts:
- `status` — HTTP status (default 200, ignored when `redirect` is set)
- `headers` — response headers
- `cookies` — array of `{ name, value, options }` (requires `@fastify/cookie` to be registered)
- `redirect` — `{ url, status? }` for 301/302/303/307/308 redirects
- `body` — string, Buffer, or Node `Readable` stream

The REST adapter detects `RawResponse` via a brand and short-circuits before applying the auto 201/204 status logic. OpenAPI generation already handles missing response schemas gracefully — `.raw()` procedures without `.output()` document as a response without a body schema (valid OpenAPI).

Also exports `RawResponse`, `RawResponseOptions`, `RawResponseCookie`, `RawResponseCookieOptions`, `RawResponseRedirect`, and `isRawResponse` from `@veloxts/router`.
