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

I wrote a prompt from memory (see [`auth-api-ai-version/PROMPT.md`](https://github.com/JustineSalinas/auth-api-ai-version/blob/main/PROMPT.md)
— same repo structure, kept as a separate project) specifying the
frameworks, routes, status codes, middleware requirement, and Swagger, then
had a fresh AI session build it with no access to this codebase. Tested
the result against the same live Supabase project so it's a fair
comparison, not a guess.

**Bearer-prefix parsing — it got this mostly right, but not fully.** The
AI's middleware does `authHeader.split(" ")[1]` to grab the token, which
correctly extracts it from a well-formed `Bearer <token>` header and
correctly returns 401 when the header is missing entirely. But it never
checks that the first word is literally `"Bearer"`. I tested this
concretely: sending `Authorization: Basic <a real, valid access token>`
returned **200 with the real profile data** — the wrong auth scheme was
silently accepted because the code only looks at whatever comes after the
first space, not what comes before it. My version explicitly checks
`authHeader.startsWith("Bearer ")` before extracting anything, so the same
request correctly returns 401. This is exactly the kind of gap the
assignment's checkpoint ("incorrectly formatted... return 401") was
designed to catch, and a prompt that doesn't spell out "reject anything
that isn't literally the Bearer scheme" leaves room for it.

**A security flaw it introduced — confirmed, not theoretical.** Neither
`/auth/signup` nor `/auth/login` guards against a missing request body.
My version does `const { title } = req.body || {}`-style destructuring
everywhere; the AI's does `const { email, password } = req.body` directly.
Sent a `POST /auth/signup` with no body at all, and it crashed: **500,
with a full stack trace — including local file paths — dumped straight
into the HTTP response.** That's not just a wrong status code, it's an
information-disclosure bug: an attacker probing the API for free would
learn the server's file layout and framework internals from an
unauthenticated endpoint. The assignment explicitly calls for `400` on
missing input; the AI's version fails open into a worse-than-nothing error
page instead.

**What my prompt missed.** I specified the response *shape* loosely —
"the access token and refresh token" for login, without saying whether the
`user` object should also come back, and "the user object" for signup
without specifying whether it should be wrapped (`{ user: {...} }`) or
returned bare. The AI took the literal minimum reading both times: login
came back with only `access_token`/`refresh_token` (no `user`), and signup
returned the raw Supabase user object with no wrapper. Neither is wrong
given what I wrote, but it means a stricter contract (useful once a
frontend depends on the exact shape) needs a more precise prompt than the
one I gave from memory.

**What the AI assumed.** It assumed a single shared Supabase client
instance was fine for both routes and the middleware (same assumption I
made) — so it inherited the same logout caveat documented above without
me asking about it, which suggests that's a natural default for this kind
of prompt rather than something either of us thought carefully about. It
also assumed `supabase.auth.getUser(token)` returning no `error` always
means a usable `user` — it doesn't guard `!data.user` separately the way
mine does, though I didn't manage to actually trigger that path in
testing, so I'm flagging it as a plausible gap rather than a confirmed one.
