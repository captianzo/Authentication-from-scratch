# Authentication From Scratch

A JWT-based authentication system built with Node, Express, and Postgres,
without any auth framework or third-party auth service.

## Stack

- Node.js (ES modules) + Express
- PostgreSQL (via Docker Compose)
- `jsonwebtoken` for access tokens
- `argon2` for password hashing

## How auth works here

**Access tokens** are standard JWTs, signed with HS256, valid for 15
minutes. They only carry `sub`, `iat`, and `exp` — no extra data. Sent as
`Authorization: Bearer <token>` and checked by middleware on protected
routes.

**Refresh tokens** are *not* JWTs. Each one is a random string
(`<uuid>.<64-char-secret>`), and only its hash is stored in the database —
the raw value only ever exists on the client and in the response that
created it. Refresh tokens are single-use: each `/refresh` call rotates
into a brand-new token and invalidates the old one, inside a single
database transaction so concurrent requests can't create a race condition.

## Endpoints

| Method | Path       | Auth required          | Description                          |
|--------|------------|--------------------------|----------------------------------------|
| POST   | `/signup`  | —                        | Create an account                     |
| POST   | `/login`   | —                        | Log in, get an access + refresh token |
| POST   | `/refresh` | refresh token (in body) | Rotate to a new token pair            |
| GET    | `/me`      | access token (Bearer)   | Return the logged-in user's id        |

Errors are always plain JSON (`{ "error": "..." }`) — no stack traces, and
login never reveals whether an email exists or the password was wrong.

### POST /signup

Request body:
```json
{
  "email": "you@example.com",
  "password": "yourpassword"
}
```

Response — `201 Created`:
```json
{
  "id": 1,
  "email": "you@example.com"
}
```

If the email is already registered, returns `409 Conflict`.

### POST /login

Request body:
```json
{
  "email": "you@example.com",
  "password": "yourpassword"
}
```

Response — `200 OK`:
```json
{
  "message": "Login successful",
  "accessToken": "<jwt>",
  "refreshToken": "<uuid>.<secret>",
  "id": 1,
  "email": "you@example.com"
}
```

Wrong email or password both return `401 Unauthorized` with the same
error message.

### POST /refresh

Request body:
```json
{
  "refreshToken": "<uuid>.<secret>"
}
```

Response — `200 OK`:
```json
{
  "accessToken": "<new jwt>",
  "refreshToken": "<new uuid>.<new secret>"
}
```

The old refresh token stops working the moment this call succeeds. Any
invalid, expired, or already-used refresh token returns `401 Unauthorized`.

### GET /me

No request body. Requires the access token from `/login` or `/refresh`:
```
Authorization: Bearer <accessToken>
```

Response — `200 OK`:
```json
{
  "userId": 1
}
```

Missing or invalid token returns `401 Unauthorized`.

## Getting it running locally

```bash
# 1. Clone and install
git clone <your-repo-url>
cd <repo-name>
npm install

# 2. Start Postgres
docker compose up -d

# 3. Set up your environment
cp .env.example .env
```

Then fill in `.env` with your own values:

```
ACCESS_SECRET=   # 32+ random bytes, e.g. crypto.randomBytes(32).toString('hex')
DB_USER=
DB_PASSWORD=
DB_HOST=
DB_NAME=
DB_PORT=
```

```bash
# 4. Run the schema against your database (once)
psql -h localhost -U <DB_USER> -d <DB_NAME> -f src/config/schema.sql

# 5. Start the server
node src/server.js
```

If `ACCESS_SECRET` is missing or too short, or the database isn't
reachable, the server won't start — it'll print the reason instead of
failing later on the first request.

## A few things worth knowing

- **Signup returns a 409 if the email is already taken.** This does mean
  someone can check whether an email is registered — a tradeoff made for
  clearer signup UX over strict enumeration-resistance.
- **Login is not vulnerable to that same enumeration**, on purpose: it
  always returns the same error and takes roughly the same time, whether
  the email doesn't exist or the password is wrong.
- **Refresh tokens use absolute expiry.** Rotating a refresh token doesn't
  extend the session — it just issues a new token that still expires at
  the original login time.

## What's intentionally not here

Left out on purpose, not missed:

- OAuth2 / OIDC
- Any signing algorithm besides HS256
- Rate limiting
- Logout / revoke-all-sessions
- Cleanup of old expired/used refresh tokens

## Project structure

```
src/
├── config/
│   ├── db.js            # Postgres connection pool
│   └── schema.sql       # table definitions
├── middleware/
│   └── authenticate.js  # verifies access tokens on protected routes
├── routes/
│   ├── auth.js          # signup, login, token creation
│   ├── refresh.js        # refresh token rotation
│   └── users.js          # example protected route (/me)
└── server.js
```
