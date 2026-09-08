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

## Running it

```bash
npm install
npm start
```

Starts on `http://localhost:3000` (or whatever `PORT` is set to). Swagger
docs are at `http://localhost:3000/docs`.

## Trying it end to end

```bash
# 1. Sign up
curl -i -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
# -> 201, user object

# 2. Log in
curl -i -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
# -> 200, { access_token, refresh_token, user }

# 3. Call a protected route with that token
curl -i http://localhost:3000/protected/profile \
  -H "Authorization: Bearer <paste access_token here>"
# -> 200, { id, email, created_at }

# 4. Log out
curl -i -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer <paste access_token here>"
# -> 204
```

<!-- Paste your real output from the block above here once you run it against your own Supabase project. -->

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

## Swagger UI

`/docs` is configured with a `bearerAuth` security scheme
(`type: http`, `scheme: bearer`) applied to `/auth/logout` and both
`/protected/*` routes. Clicking **Authorize** and pasting a token lets you
"Try it out" directly from the browser.

![Swagger UI screenshot](swagger-screenshot.png)

<!-- Replace with a screenshot of /docs after clicking Authorize, pasting a
real token, and successfully calling GET /protected/profile. -->

## AI vs me (Stage 7, optional)

<!-- Fill in after running the bonus stage: prompt an AI assistant from
memory to build the same API in a separate folder, then compare how it
handled Bearer-prefix parsing, invalid-token handling, and what your
prompt left underspecified. -->
