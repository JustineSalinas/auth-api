# Auth API

A small Express API that hands authentication off to [Supabase Auth](https://supabase.com/auth)
instead of rolling its own password hashing or token signing. Supports
signup, login, logout, and a couple of protected routes guarded by a
reusable bearer-token middleware.

## What this is

Supabase acts as the Identity Provider: it stores accounts, checks
passwords, and issues signed JWTs. This API is a thin layer on top of it —
it forwards signup/login to Supabase, and verifies the JWT Supabase issued
on every protected request. No secrets, password hashes, or session state
live in this codebase.

| Route | Method | Auth required | Purpose |
|---|---|---|---|
| `/auth/signup` | POST | No | Create a new user account |
| `/auth/login` | POST | No | Authenticate, get back a JWT |
| `/auth/logout` | POST | **Yes** | End the current session |
| `/public/info` | GET | No | Unprotected sample data |
| `/protected/profile` | GET | **Yes** | The logged-in user's id/email/created_at |
| `/protected/dashboard` | GET | **Yes** | Second protected route — proves the middleware is reusable, not one-off |

## Setup

1. Create a free project at [supabase.com](https://supabase.com/) (any name — this
   one was built against a project named "Auth-Practice").
2. In the Supabase dashboard: **Project Settings → API**, copy the **Project URL**
   and the **anon public key**.
3. `cp .env.example .env` and fill in:
   ```
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_KEY=your_anon_key
   PORT=3000
   ```
   `.env` is gitignored — it never gets pushed. `.env.example` is the only
   thing committed, and it has no real values in it.
4. By default, Supabase requires email confirmation before a new account can
   log in. For local testing, either confirm the email from the link
   Supabase sends, or turn off "Confirm email" under **Authentication →
   Providers → Email** in your project settings.
5. Supabase's free-tier auth mailer has a low rate limit (a handful of
   emails per hour) — repeated signup attempts while testing can trip
   `"email rate limit exceeded"` even with confirmation off. If that
   happens, wait it out, or confirm an existing unconfirmed user directly
   via the Admin API (`supabase.auth.admin.updateUserById(id, { email_confirm: true })`)
   using your `service_role` key in a throwaway local script — never put
   that key in `.env` or commit it anywhere.

## Running it

```bash
npm install
npm start
```

Starts on `http://localhost:3000` (or whatever `PORT` is set to). Swagger
docs are at `http://localhost:3000/docs`.

## Trying it end to end

Actually run against a live Supabase project:

```
$ curl -i -X POST http://localhost:3000/auth/signup \
    -H "Content-Type: application/json" \
    -d '{"email":"justine.salinas.test@gmail.com","password":"password123"}'
HTTP/1.1 201 Created
{"user":{"id":"2d4bb742-...","email":"justine.salinas.test@gmail.com", ...}}

$ curl -i -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"justine.salinas.test@gmail.com","password":"password123"}'
HTTP/1.1 200 OK
{"access_token":"eyJhbGciOi...","refresh_token":"632zdevltqb5","user":{...}}

$ curl -i http://localhost:3000/protected/profile \
    -H "Authorization: Bearer eyJhbGciOi..."
HTTP/1.1 200 OK
{"id":"2d4bb742-5a56-4adc-840e-f57e6457dfdc","email":"justine.salinas.test@gmail.com","created_at":"2026-09-08T05:16:33.88291Z"}

$ curl -i http://localhost:3000/protected/profile \
    -H "Authorization: Bearer eyJhbGciOi...TAMPERED"
HTTP/1.1 401 Unauthorized
{"error":"Invalid or expired token"}

$ curl -i -X POST http://localhost:3000/auth/logout \
    -H "Authorization: Bearer eyJhbGciOi..."
HTTP/1.1 204 No Content
```

Access/refresh tokens above are truncated — full JWTs aren't left in this
README even though they were short-lived test tokens.

## Status codes

| Code | When |
|---|---|
| 200 | Successful login, successful read of a protected/public route |
| 201 | Signup succeeded |
| 204 | Logout succeeded (no body) |
| 400 | Missing `email`/`password`, or Supabase rejected the signup |
| 401 | Missing/malformed Authorization header, wrong login credentials, or an invalid/expired token |

## Architecture notes

- **Middleware, not copy-pasted checks:** [`middleware/requireAuth.js`](middleware/requireAuth.js)
  is the only place that reads the `Authorization` header and calls
  `supabase.auth.getUser(token)`. Both `/protected/profile` and
  `/protected/dashboard` just declare `requireAuth` and trust `req.user` —
  neither one contains auth logic itself.
- **Logout's real limitation, stated honestly:** the assignment's checkpoint
  calls for `supabase.auth.signOut(token)`, but supabase-js v2's `signOut()`
  doesn't take a token argument — it signs out whatever session the client
  instance is currently holding, and this server is stateless (one shared
  client, no per-request session). So `POST /auth/logout` here calls
  `supabase.auth.signOut()` with no arguments: it satisfies the route
  contract (204, requires a valid bearer token to reach it) but doesn't
  actually revoke that specific JWT server-side. Fully revoking one token on
  demand needs the `service_role` key's admin API
  (`supabase.auth.admin.signOut(token)`), which isn't in scope here since
  this project only uses the public anon key.

  Confirmed this in testing: with a single user logged in on the shared
  client, calling `/auth/logout` did invalidate that exact token (a
  follow-up `GET /protected/profile` with the same token returned 401).
  That's a coincidence of there being only one active session on the
  process — under concurrent users, one user's logout could invalidate a
  different user's session on this same shared client. A production version
  needs either the admin API per-token revocation, or a client instance
  scoped per-request instead of a module-level singleton.

## Swagger UI

`/docs` is configured with a `bearerAuth` security scheme
(`type: http`, `scheme: bearer`) applied to `/auth/logout` and both
`/protected/*` routes. Clicking **Authorize** and pasting a token lets you
"Try it out" directly from the browser.

![Swagger UI screenshot](swagger-screenshot.png)

Screenshot of `/docs` after clicking **Authorize**, pasting a real access
token, and running "Try it out" on `GET /protected/profile` — the generated
curl command, request URL, and the live `200 OK` response with real user
data from Supabase.

## AI vs me (Stage 7, optional)

<!-- Fill in after running the bonus stage: prompt an AI assistant from
memory to build the same API in a separate folder, then compare how it
handled Bearer-prefix parsing, invalid-token handling, and what your
prompt left underspecified. -->
